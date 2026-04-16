import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

/** News title batch + single-title calls. Override with GEMINI_NEWS_MODEL if needed (e.g. gemini-2.0-flash). */
function newsTitleModel(): string {
  return process.env.GEMINI_NEWS_MODEL?.trim() || "gemini-2.5-flash";
}

/** Parse JSON or numbered lines; accepts partial array length vs titles. */
function translationsFromModelText(text: string, titles: string[]): Map<string, string> {
  const result = new Map<string, string>();
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1].trim();
  const braceStart = raw.indexOf("{");
  const braceEnd = raw.lastIndexOf("}");
  if (braceStart >= 0 && braceEnd > braceStart) {
    raw = raw.slice(braceStart, braceEnd + 1);
  }
  try {
    const parsed = JSON.parse(raw) as { translations?: unknown };
    if (Array.isArray(parsed.translations)) {
      const arr = parsed.translations;
      const n = Math.min(arr.length, titles.length);
      for (let i = 0; i < n; i++) {
        const english = String(arr[i] ?? "").trim();
        if (english) result.set(titles[i], english);
      }
      if (result.size > 0) return result;
    }
  } catch {
    // fall through to line parsing
  }

  const numberedLine = /^(\d+)\s*[\.\)）．、:：]\s*(.+)$/;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const normalized = trimmed.replace(/\*\*/g, "").trim();
    const m = normalized.match(numberedLine);
    if (!m) continue;
    const idx = parseInt(m[1], 10) - 1;
    const english = m[2].trim();
    if (!english || idx < 0 || idx >= titles.length) continue;
    result.set(titles[idx], english);
  }
  return result;
}

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export async function batchTranslateWords(
  words: string[],
  debugContext: string = "article",
  debugRunId?: string
): Promise<Map<string, { pinyin: string; english: string }>> {
  const gemini = getClient();
  if (!gemini || words.length === 0) {
    if (debugRunId) {
      // #region agent log
      fetch('http://127.0.0.1:7426/ingest/ba001716-ae58-4601-9004-23d73d76048a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8aa294'},body:JSON.stringify({sessionId:'8aa294',runId:debugRunId,hypothesisId:'D_model_unavailable',location:'server/gemini.ts:64',message:'Skipped batchTranslateWords',data:{debugContext,wordCount:words.length,hasGeminiClient:!!gemini},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    }
    return new Map();
  }

  try {
    const wordsText = words.map((w, i) => `${i + 1}. ${w}`).join("\n");
    const prompt = `For each Chinese word/phrase below, provide:
1. Pinyin with tone marks
2. Concise English translation (2-5 words max)

Format each response as:
[number]. [pinyin] | [english]

Words:
${wordsText}`;

    const response = await gemini.models.generateContent({
      model: newsTitleModel(),
      contents: prompt,
    });

    const result = new Map<string, { pinyin: string; english: string }>();
    const text = response.text || "";
    const lines = text.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.includes("|")) continue;

      try {
        const parts = trimmed.split(".", 2);
        if (parts.length < 2) continue;
        const idx = parseInt(parts[0].trim()) - 1;
        const rest = parts[1].trim();
        if (rest.includes("|")) {
          const [pinyin, english] = rest.split("|", 2);
          if (idx >= 0 && idx < words.length) {
            result.set(words[idx], {
              pinyin: pinyin.replace(/\*\*/g, "").trim(),
              english: english.replace(/\*\*/g, "").trim(),
            });
          }
        }
      } catch {
        continue;
      }
    }

    if (debugRunId) {
      // #region agent log
      fetch('http://127.0.0.1:7426/ingest/ba001716-ae58-4601-9004-23d73d76048a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8aa294'},body:JSON.stringify({sessionId:'8aa294',runId:debugRunId,hypothesisId:'D_gemini_partial_parse',location:'server/gemini.ts:108',message:'Gemini batchTranslateWords parsed response',data:{debugContext,requestedCount:words.length,parsedCount:result.size,missingCount:words.length-result.size,responsePreview:text.replace(/\s+/g,' ').slice(0,180)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    }

    return result;
  } catch (e) {
    if (debugRunId) {
      const err = e as any;
      // #region agent log
      fetch('http://127.0.0.1:7426/ingest/ba001716-ae58-4601-9004-23d73d76048a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8aa294'},body:JSON.stringify({sessionId:'8aa294',runId:debugRunId,hypothesisId:'D_gemini_request_failed',location:'server/gemini.ts:114',message:'Gemini batchTranslateWords request failed',data:{debugContext,wordCount:words.length,errorMessage:err?.message||String(err),status:err?.status},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    }
    console.error("Gemini translation error:", e);
    return new Map();
  }
}

export async function batchTranslateTitles(titles: string[]): Promise<Map<string, string>> {
  const gemini = getClient();
  if (!gemini || titles.length === 0) {
    return new Map();
  }

  const model = newsTitleModel();
  const merged = new Map<string, string>();
  const chunkSize = titles.length <= 32 ? titles.length : 24;

  try {
    for (let start = 0; start < titles.length; start += chunkSize) {
      const chunk = titles.slice(start, start + chunkSize);
      const titlesText = chunk.map((t, i) => `${i + 1}. ${t}`).join("\n");
      const instruction = `Translate each Chinese headline below to concise English. Preserve meaning; keep recognizable proper nouns.

Headlines:
${titlesText}`;

      let chunkMap = new Map<string, string>();

      try {
        const response = await gemini.models.generateContent({
          model,
          contents: `${instruction}

Return JSON only: an object with key "translations" whose value is an array of exactly ${chunk.length} English headline strings in the same order.`,
          config: {
            responseMimeType: "application/json",
            responseJsonSchema: {
              type: "object",
              properties: {
                translations: {
                  type: "array",
                  items: { type: "string" },
                  minItems: chunk.length,
                  maxItems: chunk.length,
                },
              },
              required: ["translations"],
            },
          },
        });
        const text = response.text || "";
        chunkMap = translationsFromModelText(text, chunk);
      } catch {
        // fall through to plain JSON prompt
      }

      if (chunkMap.size === 0) {
        try {
          const response = await gemini.models.generateContent({
            model,
            contents: `${instruction}

Return ONLY valid JSON: {"translations":["..."]} with exactly ${chunk.length} strings in order. No markdown.`,
          });
          const text = response.text || "";
          chunkMap = translationsFromModelText(text, chunk);
        } catch (e) {
          console.error("Batch title translation chunk error:", e);
        }
      }

      chunkMap.forEach((v, k) => merged.set(k, v));
    }

    return merged;
  } catch (e) {
    console.error("Batch title translation error:", e);
    return new Map();
  }
}

export async function translateTitle(title: string): Promise<{ pinyin: string; english: string; englishOnly: string } | null> {
  const gemini = getClient();
  if (!gemini) return null;

  try {
    const prompt = `Translate this Chinese headline to English. Also provide pinyin with tone marks.
Format: [pinyin] | [english translation]

Headline: ${title}`;

    const response = await gemini.models.generateContent({
      model: newsTitleModel(),
      contents: prompt,
    });

    const text = response.text || "";
    if (text.includes("|")) {
      const [pinyin, english] = text.split("|", 2);
      return { 
        pinyin: pinyin.replace(/\*\*/g, "").trim(), 
        english: english.replace(/\*\*/g, "").trim(),
        englishOnly: english.replace(/\*\*/g, "").trim()
      };
    }
    return null;
  } catch (e) {
    console.error("Title translation error:", e);
    return null;
  }
}
