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

  // Try to extract a JSON object or array block from mixed text.
  const objectStart = raw.indexOf("{");
  const objectEnd = raw.lastIndexOf("}");
  const arrayStart = raw.indexOf("[");
  const arrayEnd = raw.lastIndexOf("]");
  if (objectStart >= 0 && objectEnd > objectStart) {
    raw = raw.slice(objectStart, objectEnd + 1);
  } else if (arrayStart >= 0 && arrayEnd > arrayStart) {
    raw = raw.slice(arrayStart, arrayEnd + 1);
  }

  const setFromArray = (arr: unknown[]) => {
    const n = Math.min(arr.length, titles.length);
    for (let i = 0; i < n; i++) {
      const english = String(arr[i] ?? "").trim();
      if (english) result.set(titles[i], english);
    }
  };

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (Array.isArray(parsed)) {
      setFromArray(parsed);
      if (result.size > 0) return result;
    } else if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;

      // Preferred key first; fallback keys are defensive for model drift.
      const candidateKeys = ["translations", "headlines", "results", "data", "items"];
      for (const key of candidateKeys) {
        if (Array.isArray(obj[key])) {
          setFromArray(obj[key] as unknown[]);
          break;
        }
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

<<<<<<< HEAD
export async function batchTranslateWords(
  words: string[],
  debugContext: string = "article",
  debugRunId?: string
): Promise<Map<string, { pinyin: string; english: string }>> {
=======
/** Parse a structured JSON word-translation response into a Map keyed by word index. */
function wordTranslationsFromModelText(text: string, words: string[]): Map<string, { pinyin: string; english: string }> {
  const result = new Map<string, { pinyin: string; english: string }>();
  let raw = text.trim();

  // Strip markdown code fences.
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1].trim();

  // Isolate the outermost JSON object or array.
  const objectStart = raw.indexOf("{");
  const objectEnd = raw.lastIndexOf("}");
  const arrayStart = raw.indexOf("[");
  const arrayEnd = raw.lastIndexOf("]");
  if (objectStart >= 0 && objectEnd > objectStart) {
    raw = raw.slice(objectStart, objectEnd + 1);
  } else if (arrayStart >= 0 && arrayEnd > arrayStart) {
    raw = raw.slice(arrayStart, arrayEnd + 1);
  }

  const applyArray = (arr: unknown[]) => {
    const n = Math.min(arr.length, words.length);
    for (let i = 0; i < n; i++) {
      const item = arr[i];
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const pinyin = String(obj.pinyin ?? "").replace(/\*\*/g, "").trim();
      const english = String(obj.english ?? "").replace(/\*\*/g, "").trim();
      if (pinyin && english) {
        result.set(words[i], { pinyin, english });
      }
    }
  };

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      applyArray(parsed);
      if (result.size > 0) return result;
    } else if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const candidateKeys = ["translations", "results", "items", "data"];
      for (const key of candidateKeys) {
        if (Array.isArray(obj[key])) {
          applyArray(obj[key] as unknown[]);
          break;
        }
      }
    }
  } catch {
    // fall through — return whatever was collected (possibly empty)
  }

  return result;
}

/** Legacy line parser kept as last-resort fallback for `N. pinyin | english` format. */
function wordTranslationsFromLines(text: string, words: string[]): Map<string, { pinyin: string; english: string }> {
  const result = new Map<string, { pinyin: string; english: string }>();
  for (const line of text.split("\n")) {
    const trimmed = line.trim().replace(/\*\*/g, "");
    if (!trimmed || !trimmed.includes("|")) continue;
    const dotIdx = trimmed.indexOf(".");
    if (dotIdx < 0) continue;
    const idx = parseInt(trimmed.slice(0, dotIdx).trim()) - 1;
    const rest = trimmed.slice(dotIdx + 1).trim();
    const pipeIdx = rest.indexOf("|");
    if (pipeIdx < 0 || idx < 0 || idx >= words.length) continue;
    const pinyin = rest.slice(0, pipeIdx).trim();
    const english = rest.slice(pipeIdx + 1).trim();
    if (pinyin && english) {
      result.set(words[idx], { pinyin, english });
    }
  }
  return result;
}

export async function batchTranslateWords(words: string[]): Promise<Map<string, { pinyin: string; english: string }>> {
>>>>>>> bug/traditional
  const gemini = getClient();
  if (!gemini || words.length === 0) {
    if (debugRunId) {
      // #region agent log
      fetch('http://127.0.0.1:7426/ingest/ba001716-ae58-4601-9004-23d73d76048a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8aa294'},body:JSON.stringify({sessionId:'8aa294',runId:debugRunId,hypothesisId:'D_model_unavailable',location:'server/gemini.ts:64',message:'Skipped batchTranslateWords',data:{debugContext,wordCount:words.length,hasGeminiClient:!!gemini},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    }
    return new Map();
  }

  const model = newsTitleModel();
  const wordsText = words.map((w, i) => `${i + 1}. ${w}`).join("\n");
  const instruction = `For each Chinese word/phrase below, provide pinyin with tone marks and a concise English gloss (2-5 words).

Words:
${wordsText}`;

  // Primary: structured JSON schema — forces model to return exactly one object per word.
  try {
    const response = await gemini.models.generateContent({
      model,
      contents: `${instruction}

Return JSON only: { "translations": [ { "pinyin": "...", "english": "..." }, ... ] } with exactly ${words.length} objects in the same order.`,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          properties: {
            translations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  pinyin: { type: "string" },
                  english: { type: "string" },
                },
                required: ["pinyin", "english"],
              },
              minItems: words.length,
              maxItems: words.length,
            },
          },
          required: ["translations"],
        },
      },
    });
    const parsed = wordTranslationsFromModelText(response.text || "", words);
    if (parsed.size > 0) return parsed;
  } catch {
    // fall through to plain JSON fallback
  }

  // Fallback 1: plain JSON prompt without schema enforcement.
  try {
    const response = await gemini.models.generateContent({
      model,
      contents: `${instruction}

Return ONLY valid JSON: {"translations":[{"pinyin":"...","english":"..."},...]} with exactly ${words.length} objects in order. No markdown.`,
    });
    const parsed = wordTranslationsFromModelText(response.text || "", words);
    if (parsed.size > 0) return parsed;
  } catch {
    // fall through to legacy parser
  }

  // Fallback 2: legacy free-form line parser (N. pinyin | english).
  try {
    const response = await gemini.models.generateContent({
      model,
      contents: `${instruction}

<<<<<<< HEAD
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
=======
Format each response as:
[number]. [pinyin] | [english]`,
    });
    return wordTranslationsFromLines(response.text || "", words);
  } catch (e) {
    console.error("Gemini word translation error:", e);
>>>>>>> bug/traditional
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
