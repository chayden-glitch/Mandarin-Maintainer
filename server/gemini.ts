import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export async function batchTranslateWords(words: string[]): Promise<Map<string, { pinyin: string; english: string }>> {
  const gemini = getClient();
  if (!gemini || words.length === 0) return new Map();

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
      model: "gemini-2.0-flash",
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

    return result;
  } catch (e) {
    console.error("Gemini translation error:", e);
    return new Map();
  }
}

export async function batchTranslateTitles(titles: string[]): Promise<Map<string, string>> {
  const gemini = getClient();
  if (!gemini || titles.length === 0) return new Map();

  try {
    const titlesText = titles.map((t, i) => `${i + 1}. ${t}`).join("\n");
    const prompt = `Translate each Chinese headline below to English.
Format each response as:
[number]. [english translation]

Headlines:
${titlesText}`;

    const response = await gemini.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    const result = new Map<string, string>();
    const text = response.text || "";
    const lines = text.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const parts = trimmed.split(".", 2);
        if (parts.length < 2) continue;
        const idx = parseInt(parts[0].trim()) - 1;
        const english = parts[1].trim();
        if (idx >= 0 && idx < titles.length) {
          result.set(titles[idx], english);
        }
      } catch {
        continue;
      }
    }

    return result;
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
      model: "gemini-2.0-flash",
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
