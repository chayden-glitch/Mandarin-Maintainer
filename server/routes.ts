import type { Express, Request, Response } from "express";
import type { Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { reviewCard } from "./fsrs-engine";
import { fetchAllFeeds, fetchArticleContent } from "./rss-reader";
import { processArticleText } from "./segmenter";
import { generateTTS } from "./tts";
import { translateTitle } from "./gemini";
import type { InsertVocabulary, ArticleFeed } from "@shared/schema";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

let rssFeedCache: { data: ArticleFeed[]; timestamp: number; hasMissingTranslations: boolean } | null = null;
const RSS_CACHE_TTL = 30 * 60 * 1000;
const RETRY_CACHE_TTL = 2 * 60 * 1000;

export async function registerRoutes(server: Server, app: Express): Promise<void> {

  app.get("/api/vocabulary", async (_req: Request, res: Response) => {
    const words = await storage.getAllVocabulary();
    res.json(words);
  });

  app.post("/api/vocabulary/upload", upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileName = req.file.originalname || "";
      const isExcel = /\.(xlsx|xls)$/i.test(fileName);

      let rows: string[][];

      if (isExcel) {
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        rows = rawRows.map((row) => row.map((cell: any) => String(cell).trim()));
      } else {
        const text = req.file.buffer.toString("utf-8").replace(/^\ufeff/, "");
        const lines = text.split("\n").filter((l) => l.trim());
        const separator = lines[0]?.includes("\t") ? "\t" : ",";
        rows = lines.map((line) =>
          line.split(separator).map((p) => p.trim().replace(/^["']|["']$/g, ""))
        );
      }

      if (rows.length === 0) {
        return res.status(400).json({ message: "File is empty" });
      }

      const firstRow = rows[0];
      const isHeader = /simplified|chinese|hanzi|pinyin/i.test(firstRow.join(" "));
      const dataRows = isHeader ? rows.slice(1) : rows;

      const words: InsertVocabulary[] = [];
      for (const parts of dataRows) {
        if (parts.length < 3) continue;

        const simplified = parts[0];
        const pinyin = parts[1];
        const english = parts[2];
        const source = parts[3] ? [parts[3]] : null;
        const rawLesson = parts[4] ? parseInt(parts[4]) : null;
        const lessonNumber = rawLesson && !isNaN(rawLesson) ? [rawLesson] : null;

        if (!simplified || !pinyin || !english) continue;

        words.push({
          simplified,
          pinyin,
          english,
          source,
          lessonNumber,
          exampleSentence: parts[5] || null,
          buried: false,
        });
      }

      if (words.length === 0) {
        return res.status(400).json({ message: "No valid vocabulary entries found in file" });
      }

      const result = await storage.addVocabularyBatch(words);
      res.json({ ...result, total: words.length });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Upload failed" });
    }
  });

  app.delete("/api/vocabulary/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    await storage.deleteVocabulary(id);
    res.json({ success: true });
  });

  app.patch("/api/vocabulary/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    const { buried, simplified, pinyin, english, exampleSentence } = req.body;
    if (typeof buried === "boolean") {
      await storage.buryVocabulary(id, buried);
    }
    const fieldUpdates: Partial<InsertVocabulary> = {};
    if (typeof simplified === "string") fieldUpdates.simplified = simplified;
    if (typeof pinyin === "string") fieldUpdates.pinyin = pinyin;
    if (typeof english === "string") fieldUpdates.english = english;
    if (typeof exampleSentence === "string" || exampleSentence === null) fieldUpdates.exampleSentence = exampleSentence;
    if (Object.keys(fieldUpdates).length > 0) {
      await storage.updateVocabulary(id, fieldUpdates);
    }
    const updated = await storage.getVocabularyById(id);
    res.json({ success: true, vocabulary: updated });
  });

  app.get("/api/review/stats", async (req: Request, res: Response) => {
    const tzOffset = req.query.tzOffset !== undefined ? parseInt(req.query.tzOffset as string) : undefined;
    const stats = await storage.getReviewStats(tzOffset);
    res.json(stats);
  });

  app.get("/api/review/due", async (req: Request, res: Response) => {
    const tzOffset = req.query.tzOffset !== undefined ? parseInt(req.query.tzOffset as string) : undefined;
    const maxDue = parseInt(await storage.getSetting("max_due_cards_per_day", "30") || "30");
    const cards = await storage.getDueCards(maxDue, tzOffset);
    res.json(cards);
  });

  app.get("/api/review/practice", async (_req: Request, res: Response) => {
    const cards = await storage.getPracticeCards(10);
    res.json(cards);
  });

  app.post("/api/review/custom", async (req: Request, res: Response) => {
    const body = req.body as { sourceLessons?: Record<string, number[]> };
    const sourceLessons = body?.sourceLessons ?? {};
    if (typeof sourceLessons !== "object" || Array.isArray(sourceLessons)) {
      res.status(400).json({ message: "sourceLessons object required" });
      return;
    }
    const normalized: Record<string, number[]> = {};
    for (const [source, lessons] of Object.entries(sourceLessons)) {
      if (typeof source !== "string") continue;
      const arr = Array.isArray(lessons) ? lessons : [];
      normalized[source] = arr.map((l) => Number(l)).filter((n) => !isNaN(n));
    }
    const cards = await storage.getCustomPracticeCards(normalized);
    res.json(cards);
  });

  app.post("/api/review/rate", async (req: Request, res: Response) => {
    const { cardId, rating } = req.body;
    const numCardId = Number(cardId);
    const numRating = Number(rating);
    if (!numCardId || isNaN(numCardId) || isNaN(numRating) || numRating < 1 || numRating > 4) {
      return res.status(400).json({ message: "Valid cardId and rating (1-4) required" });
    }
    const tzOffset = req.body.tzOffset !== undefined ? parseInt(req.body.tzOffset) : undefined;
    const success = await reviewCard(numCardId, Math.round(numRating) as 1 | 2 | 3 | 4, tzOffset);
    if (!success) {
      return res.status(400).json({ message: "Failed to rate card" });
    }
    res.json({ success: true });
  });

  app.post("/api/review/bury", async (req: Request, res: Response) => {
    const { cardId } = req.body;
    if (!cardId) return res.status(400).json({ message: "cardId required" });
    await storage.buryCardVocabulary(cardId);
    res.json({ success: true });
  });

  app.get("/api/news/feeds", async (_req: Request, res: Response) => {
    try {
      if (rssFeedCache) {
        const now = Date.now();
        const ttl = rssFeedCache.hasMissingTranslations ? RETRY_CACHE_TTL : RSS_CACHE_TTL;
        if (now - rssFeedCache.timestamp < ttl) {
          return res.json(rssFeedCache.data);
        }
      }
      
      const { articles, hasMissingTranslations } = await fetchAllFeeds();
      rssFeedCache = { data: articles, timestamp: Date.now(), hasMissingTranslations };
      res.json(articles);
    } catch (e: any) {
      if (rssFeedCache) {
        return res.json(rssFeedCache.data);
      }
      res.status(500).json({ message: e.message || "Failed to fetch feeds" });
    }
  });

  app.post("/api/news/article", async (req: Request, res: Response) => {
    const { url, needsConversion } = req.body;
    if (!url) return res.status(400).json({ message: "URL required" });

    const cached = await storage.getArticleCache(url);
    if (cached) {
      console.log(`Cache hit for article: ${url}`);
      return res.json(cached);
    }

    try {
      const content = await fetchArticleContent(url, needsConversion);
      if (!content || !content.text) {
        return res.status(404).json({ message: "Could not extract article content" });
      }

      const translation = await translateTitle(content.title);
      const { segments: titleSegments, vocabMatches: titleVocab } = await processArticleText(content.title);
      const { segments, vocabMatches: textVocab } = await processArticleText(content.text);
      
      const vocabMatches = Array.from(new Set([...titleVocab, ...textVocab]));
      const result = { 
        content: { ...content, translatedTitle: translation?.englishOnly }, 
        titleSegments, 
        segments, 
        vocabMatches 
      };
      
      await storage.setArticleCache(url, result);
      
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Failed to process article" });
    }
  });

  app.post("/api/tts", async (req: Request, res: Response) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: "Text required" });

    try {
      const audioBuffer = await generateTTS(text);
      res.set({
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
      });
      res.send(audioBuffer);
    } catch (e: any) {
      console.error("TTS error:", e);
      res.status(500).json({ message: e.message || "TTS generation failed" });
    }
  });

  app.post("/api/settings", async (req: Request, res: Response) => {
    const { maxNewCardsPerDay, maxDueCardsPerDay, priorityKeywords } = req.body;
    if (maxNewCardsPerDay !== undefined) {
      await storage.setSetting("max_new_cards_per_day", maxNewCardsPerDay.toString());
    }
    if (maxDueCardsPerDay !== undefined) {
      await storage.setSetting("max_due_cards_per_day", maxDueCardsPerDay.toString());
    }
    if (priorityKeywords !== undefined) {
      await storage.setSetting("priority_keywords", JSON.stringify(priorityKeywords));
      // Clear RSS cache when interests change
      rssFeedCache = null;
    }
    res.json({ success: true });
  });

  app.get("/api/hsk/count", async (_req: Request, res: Response) => {
    const count = await storage.getHskWordCount();
    res.json({ count });
  });
}
