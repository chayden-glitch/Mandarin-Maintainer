import { storage } from "./storage";
import { batchTranslateWords } from "./gemini";

interface SegmentedWord {
  text: string;
  isVocab: boolean;
  translation?: { pinyin: string; english: string };
}

const CHINESE_CHAR_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;

const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });

/** Max Han characters in one dictionary token for greedy match (place names, etc.). */
const MAX_COMPOUND_LEN = 8;
const LOOKUP_CHUNK = 500;

/** All length-2..MAX_COMPOUND_LEN substrings inside each maximal Chinese run (for dictionary lookup). */
function extractCompoundCandidatesFromText(text: string, maxLen: number = MAX_COMPOUND_LEN): string[] {
  const out = new Set<string>();
  let i = 0;
  while (i < text.length) {
    if (!CHINESE_CHAR_REGEX.test(text[i]!)) {
      i++;
      continue;
    }
    let j = i;
    while (j < text.length && CHINESE_CHAR_REGEX.test(text[j]!)) j++;
    const run = text.slice(i, j);
    const L = run.length;
    for (let a = 0; a < L; a++) {
      for (let len = 2; len <= Math.min(maxLen, L - a); len++) {
        const slice = run.slice(a, a + len);
        if ([...slice].every((c) => CHINESE_CHAR_REGEX.test(c))) {
          out.add(slice);
        }
      }
    }
    i = j;
  }
  return Array.from(out);
}

/** Greedy longest-match segmentation within a Chinese-only run using known dictionary keys. */
function greedySegmentChineseRun(run: string, dictKeys: Set<string>, maxLen: number = MAX_COMPOUND_LEN): string[] {
  const parts: string[] = [];
  let p = 0;
  while (p < run.length) {
    const maxL = Math.min(maxLen, run.length - p);
    let matched = false;
    for (let len = maxL; len >= 2; len--) {
      const s = run.slice(p, p + len);
      if (dictKeys.has(s)) {
        parts.push(s);
        p += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      parts.push(run[p]!);
      p += 1;
    }
  }
  return parts;
}

/** Split text into segments: non-Chinese runs preserved; Chinese runs split by greedy dictionary match. */
function segmentTextWithGreedyChinese(text: string, dictKeys: Set<string>): string[] {
  const segments: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (!CHINESE_CHAR_REGEX.test(text[i]!)) {
      let buf = "";
      while (i < text.length && !CHINESE_CHAR_REGEX.test(text[i]!)) {
        buf += text[i]!;
        i++;
      }
      if (buf) segments.push(buf);
      continue;
    }
    let run = "";
    while (i < text.length && CHINESE_CHAR_REGEX.test(text[i]!)) {
      run += text[i]!;
      i++;
    }
    for (const piece of greedySegmentChineseRun(run, dictKeys)) {
      segments.push(piece);
    }
  }
  return segments;
}

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

export async function processArticleText(
  text: string,
  debugContext: string = "article",
  debugRunId?: string
): Promise<{
  segments: SegmentedWord[];
  vocabMatches: string[];
}> {
  const vocabSet = await storage.getVocabularySet();
  const vocabMap = await storage.getVocabularyMap();
  const segmentsRough = segmentChineseText(text);

  const roughChinese = new Set<string>();
  for (const seg of segmentsRough) {
    if (CHINESE_CHAR_REGEX.test(seg) && seg.length >= 1) {
      roughChinese.add(seg);
    }
  }
  const compoundCandidates = extractCompoundCandidatesFromText(text);
  const allLookupTokens = Array.from(new Set([...roughChinese, ...compoundCandidates]));

  const hskTranslations = new Map<string, { pinyin: string; english: string }>();
  for (let i = 0; i < allLookupTokens.length; i += LOOKUP_CHUNK) {
    const chunk = allLookupTokens.slice(i, i + LOOKUP_CHUNK);
    const batch = await storage.getHskTranslationsBatch(chunk);
    for (const [k, v] of Array.from(batch.entries())) {
      hskTranslations.set(k, v);
    }
  }

  for (const word of allLookupTokens) {
    if (!hskTranslations.has(word) && vocabMap.has(word)) {
      const vocab = vocabMap.get(word)!;
      if (vocab.pinyin && vocab.english) {
        hskTranslations.set(word, { pinyin: vocab.pinyin, english: vocab.english });
      }
    }
  }

  const missingForCedict = allLookupTokens.filter((w) => !hskTranslations.has(w));
  for (let i = 0; i < missingForCedict.length; i += LOOKUP_CHUNK) {
    const chunk = missingForCedict.slice(i, i + LOOKUP_CHUNK);
    const cedictMap = await storage.getCedictTranslationsBatch(chunk);
    for (const [w, t] of Array.from(cedictMap.entries())) {
      hskTranslations.set(w, t);
    }
  }

  const dictKeys = new Set<string>(Array.from(hskTranslations.keys()));
  const segments = segmentTextWithGreedyChinese(text, dictKeys);

  const finalChineseTokens = new Set<string>();
  for (const seg of segments) {
    if (CHINESE_CHAR_REGEX.test(seg) && seg.length >= 1) {
      finalChineseTokens.add(seg);
    }
  }
  const chineseWordsArr = Array.from(finalChineseTokens);

  const unknownWords = chineseWordsArr.filter((w) => !hskTranslations.has(w));
  const geminiTranslations = new Map<string, { pinyin: string; english: string }>();

  if (debugRunId) {
    // #region agent log
    fetch('http://127.0.0.1:7426/ingest/ba001716-ae58-4601-9004-23d73d76048a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8aa294'},body:JSON.stringify({sessionId:'8aa294',runId:debugRunId,hypothesisId:'C_segmentation_or_lookup_gap',location:'server/segmenter.ts:71',message:'Segmented article text',data:{debugContext,textLength:text.length,segmentCount:segments.length,chineseSegmentCount:chineseWordsArr.length,knownTranslationCount:hskTranslations.size,unknownWordCount:unknownWords.length,unknownWordSample:unknownWords.slice(0,5)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }

  if (unknownWords.length > 0) {
    const batchSize = 50;
    for (let i = 0; i < unknownWords.length; i += batchSize) {
      const batch = unknownWords.slice(i, i + batchSize);
      try {
        const batchResult = await batchTranslateWords(batch, `${debugContext}:batch:${Math.floor(i / batchSize) + 1}`, debugRunId);
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

  if (debugRunId) {
    const translatedChineseSegments = result.filter((seg) => CHINESE_CHAR_REGEX.test(seg.text) && !!seg.translation).length;
    const untranslatedChineseSegments = result.filter((seg) => CHINESE_CHAR_REGEX.test(seg.text) && !seg.translation).length;
    // #region agent log
    fetch('http://127.0.0.1:7426/ingest/ba001716-ae58-4601-9004-23d73d76048a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8aa294'},body:JSON.stringify({sessionId:'8aa294',runId:debugRunId,hypothesisId:'E_payload_missing_translations',location:'server/segmenter.ts:141',message:'Built segmented response payload',data:{debugContext,vocabMatchCount:vocabMatches.length,geminiTranslationCount:geminiTranslations.size,translatedChineseSegments,untranslatedChineseSegments},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }

  return { segments: result, vocabMatches };
}
