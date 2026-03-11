import type { ArticleFeed, ArticleContent } from "@shared/schema";
import RssParser from "rss-parser";
import * as cheerio from "cheerio";
import * as OpenCC from "opencc-js";
import { batchTranslateTitles, translateTitle } from "./gemini";
import { storage } from "./storage";
import { processArticleText } from "./segmenter";

const rssParser = new RssParser({
  timeout: 10000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

const RSS_FEEDS: Record<string, string> = {
  "BBC Top Stories": "http://www.bbc.co.uk/zhongwen/simp/index.xml",
  "BBC Business": "http://www.bbc.co.uk/zhongwen/simp/business/index.xml",
  "BBC Science": "http://www.bbc.co.uk/zhongwen/simp/science/index.xml",
  "BBC China": "http://www.bbc.co.uk/zhongwen/simp/index.xml",
  "BBC World":"http://www.bbc.co.uk/zhongwen/simp/world/index.xml",
};

const PAYWALLED_FEEDS: Record<string, string> = {
  "NYT Chinese": "https://cn.nytimes.com/rss/",
};

async function getPriorityKeywords(): Promise<string[]> {
  const setting = await storage.getSetting("priority_keywords");
  if (setting) {
    try {
      const parsed = JSON.parse(setting);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.error("Failed to parse priority_keywords setting:", e);
    }
  }
  // Fallback to empty array if no settings are found, as the UI handles defaults
  return [];
}

const NEEDS_CONVERSION = new Set(["BBC Business", "BBC Science", "BBC China"]);

const t2sConverter = (OpenCC as any).Converter({ from: "tw", to: "cn" });

function convertTraditionalToSimplified(text: string): string {
  if (!text) return text;
  try {
    return t2sConverter(text);
  } catch {
    return text;
  }
}

function isRecentArticle(dateStr: string, maxAgeDays: number = 7): boolean {
  if (!dateStr) return false;
  try {
    const articleDate = new Date(dateStr);
    if (isNaN(articleDate.getTime())) return false;
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
    return articleDate >= cutoff;
  } catch {
    return false;
  }
}

function calculatePriority(article: { title: string; summary: string }, keywords: string[]): { score: number; matched: string[] } {
  const text = article.title + " " + article.summary;
  let score = 0;
  const matched: string[] = [];
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      score += 10;
      matched.push(keyword);
    }
  }
  return { score, matched };
}

function stripHtml(html: string): string {
  if (!html) return "";
  const $ = cheerio.load(html);
  return $.text().trim();
}

async function parseFeed(url: string, feedName: string): Promise<any[]> {
  try {
    const feed = await rssParser.parseURL(url);
    return (feed.items || []).slice(0, 25);
  } catch (e: any) {
    console.error(`Error parsing feed ${feedName} (${url}):`, e.message);
    return [];
  }
}

export async function fetchAllFeeds(): Promise<{ articles: ArticleFeed[]; hasMissingTranslations: boolean }> {
  const allArticles: ArticleFeed[] = [];
  const priorityKeywords = await getPriorityKeywords();

  const feedEntries = [
    ...Object.entries(RSS_FEEDS).map(([name, url]) => ({ name, url, isFree: true })),
    ...Object.entries(PAYWALLED_FEEDS).map(([name, url]) => ({ name, url, isFree: false })),
  ];

  const results = await Promise.allSettled(
    feedEntries.map(async ({ name, url, isFree }) => {
      const items = await parseFeed(url, name);
      const articles: ArticleFeed[] = [];

      for (const item of items) {
        const published = item.isoDate || item.pubDate || "";
        if (published && !isRecentArticle(published)) continue;

        let title = item.title || "No title";
        let summary = item.contentSnippet || item.content || item.summary || "";

        if (NEEDS_CONVERSION.has(name)) {
          title = convertTraditionalToSimplified(title);
          summary = convertTraditionalToSimplified(summary);
        }

        summary = stripHtml(summary).slice(0, 200);

        const { score, matched } = calculatePriority({ title, summary }, priorityKeywords);
        const article: ArticleFeed = {
          title,
          link: item.link || "",
          summary,
          published,
          source: name,
          feedName: name,
          isFree,
          priority: score,
          matchedKeywords: matched.length > 0 ? matched : undefined,
        };

        articles.push(article);
      }

      return articles;
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      allArticles.push(...result.value);
    }
  }

  const freeArticles = allArticles.filter((a) => a.isFree).sort((a, b) => b.priority - a.priority);
  const paidArticles = allArticles.filter((a) => !a.isFree).sort((a, b) => b.priority - a.priority);

  const sortedArticles = [...freeArticles, ...paidArticles];
  let hasMissingTranslations = false;

  // Batch translate titles
  try {
    const titlesToTranslate = sortedArticles.map(a => a.title);
    const translations = await batchTranslateTitles(titlesToTranslate);
    
    for (const article of sortedArticles) {
      const translation = translations.get(article.title);
      if (translation) {
        article.translatedTitle = translation;
      } else {
        hasMissingTranslations = true;
      }
    }
  } catch (e) {
    console.error("Failed to batch translate titles:", e);
    hasMissingTranslations = true;
  }

  for (const article of sortedArticles) {
    try {
      const cached = await storage.getArticleCache(article.link);
      if (cached && cached.vocabMatches) {
        article.vocabCount = cached.vocabMatches.length;
      }
    } catch {}
  }

  const topArticles = freeArticles.slice(0, 5);
  for (const article of topArticles) {
    (async () => {
      try {
        const cached = await storage.getArticleCache(article.link);
        if (cached) return;
        const needsConversion = NEEDS_CONVERSION.has(article.feedName || "");
        const content = await fetchArticleContent(article.link, needsConversion);
        if (content && content.text) {
          const translation = await translateTitle(content.title);
          const { segments: titleSegments, vocabMatches: titleVocab } = await processArticleText(content.title);
          const { segments, vocabMatches: textVocab } = await processArticleText(content.text);
          const vocabMatches = Array.from(new Set([...titleVocab, ...textVocab]));
          await storage.setArticleCache(article.link, { 
            content: { ...content, translatedTitle: translation?.englishOnly }, 
            titleSegments, 
            segments, 
            vocabMatches 
          });
          console.log(`Background warmed article: ${article.link}`);
        }
      } catch (e) {
        console.error(`Error warming cache for ${article.link}:`, e);
      }
    })();
  }

  return { articles: sortedArticles, hasMissingTranslations };
}

export async function fetchArticleContent(url: string, needsConversion: boolean = false): Promise<ArticleContent | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    $("script, style, nav, header, footer, .ad, .advertisement, .social-share, .related-articles, noscript").remove();

    let title = $("h1").first().text().trim();
    if (!title) {
      title = $("title").text().trim();
    }

    let paragraphs: string[] = [];

    const articleEl = $("article").first();
    const mainEl = $("main").first();
    const contentEl = $(".story-body, .article-body, .post-content, .entry-content, .article-content, .wsj-article-body").first();

    let container: cheerio.Cheerio<any>;
    if (articleEl.length) {
      container = articleEl;
    } else if (contentEl.length) {
      container = contentEl;
    } else if (mainEl.length) {
      container = mainEl;
    } else {
      container = $("body");
    }

    container.find("p").each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 5) {
        paragraphs.push(text);
      }
    });

    if (paragraphs.length === 0) {
      $("body p").each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 5) {
          paragraphs.push(text);
        }
      });
    }

    let text = paragraphs.join("\n\n").slice(0, 5000);

    let topImage = "";
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage) {
      topImage = ogImage;
    } else {
      const firstImg = container.find("img").first().attr("src");
      if (firstImg) {
        topImage = firstImg.startsWith("http") ? firstImg : new URL(firstImg, url).href;
      }
    }

    if (needsConversion) {
      title = convertTraditionalToSimplified(title);
      text = convertTraditionalToSimplified(text);
    }

    if (!text || text.length < 20) {
      return null;
    }

    return { title, text, topImage };
  } catch (e: any) {
    console.error("Error fetching article:", e.message);
    return null;
  }
}
