import { storage } from "./storage";
import { batchTranslateWords } from "./gemini";

interface SegmentedWord {
  text: string;
  isVocab: boolean;
  translation?: { pinyin: string; english: string };
}

const CHINESE_CHAR_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;

const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });

function segmentChineseText(text: string): string[] {
  const segments: string[] = [];
  const parts = Array.from(segmenter.segment(text));

  let nonChineseBuf = "";

  for (const part of parts) {
    const seg = part.segment;
    if (CHINESE_CHAR_REGEX.test(seg)) {
      if (nonChineseBuf) {
        segments.push(nonChineseBuf);
        nonChineseBuf = "";
      }
      segments.push(seg);
    } else {
      nonChineseBuf += seg;
    }
  }

  if (nonChineseBuf) {
    segments.push(nonChineseBuf);
  }

  return segments;
}

export async function processArticleText(text: string): Promise<{
  segments: SegmentedWord[];
  vocabMatches: string[];
}> {
  const vocabSet = await storage.getVocabularySet();
  const vocabMap = await storage.getVocabularyMap();
  const segments = segmentChineseText(text);

  const chineseWords = new Set<string>();
  for (const seg of segments) {
    if (CHINESE_CHAR_REGEX.test(seg) && seg.length >= 1) {
      chineseWords.add(seg);
    }
  }

  const chineseWordsArr = Array.from(chineseWords);
  const hskTranslations = await storage.getHskTranslationsBatch(chineseWordsArr);

  for (const word of chineseWordsArr) {
    if (!hskTranslations.has(word) && vocabMap.has(word)) {
      const vocab = vocabMap.get(word)!;
      if (vocab.pinyin && vocab.english) {
        hskTranslations.set(word, { pinyin: vocab.pinyin, english: vocab.english });
      }
    }
  }

  const unknownWords = chineseWordsArr.filter((w) => !hskTranslations.has(w));
  const geminiTranslations = new Map<string, { pinyin: string; english: string }>();

  if (unknownWords.length > 0) {
    const batchSize = 50;
    for (let i = 0; i < unknownWords.length; i += batchSize) {
      const batch = unknownWords.slice(i, i + batchSize);
      try {
        const batchResult = await batchTranslateWords(batch);
        const entries = Array.from(batchResult.entries());
        for (const [key, val] of entries) {
          geminiTranslations.set(key, val);
        }
      } catch (e) {
        console.error("Gemini batch translate error:", e);
      }
    }

    if (geminiTranslations.size > 0) {
      const toCache = Array.from(geminiTranslations.entries()).map(([simplified, t]) => ({
        simplified,
        pinyin: t.pinyin,
        english: t.english,
      }));
      try {
        await storage.importHskWords(toCache);
      } catch (e) {
        console.error("Failed to cache translations:", e);
      }
    }
  }

  const vocabMatches: string[] = [];
  const result: SegmentedWord[] = [];

  for (const seg of segments) {
    if (!CHINESE_CHAR_REGEX.test(seg)) {
      if (seg.includes("\n")) {
        const parts = seg.split(/(\n+)/);
        for (const part of parts) {
          if (/\n/.test(part)) {
            result.push({ text: "\n\n", isVocab: false });
          } else if (part) {
            result.push({ text: part, isVocab: false });
          }
        }
      } else {
        result.push({ text: seg, isVocab: false });
      }
      continue;
    }

    const isVocab = vocabSet.has(seg);
    if (isVocab && !vocabMatches.includes(seg)) {
      vocabMatches.push(seg);
    }

    const translation = hskTranslations.get(seg) || geminiTranslations.get(seg);

    result.push({
      text: seg,
      isVocab,
      translation: translation || undefined,
    });
  }

  return { segments: result, vocabMatches };
}
