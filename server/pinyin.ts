/**
 * Converts pinyin with number tones (e.g. ni3 hao3) to tone marks (e.g. nǐ hǎo).
 * Supports neutral tone (5 or no number). Leaves already-accented text unchanged.
 */

const TONE_MARKS: Record<string, Record<number, string>> = {
  a: { 1: "ā", 2: "á", 3: "ǎ", 4: "à", 5: "a" },
  e: { 1: "ē", 2: "é", 3: "ě", 4: "è", 5: "e" },
  i: { 1: "ī", 2: "í", 3: "ǐ", 4: "ì", 5: "i" },
  o: { 1: "ō", 2: "ó", 3: "ǒ", 4: "ò", 5: "o" },
  u: { 1: "ū", 2: "ú", 3: "ǔ", 4: "ù", 5: "u" },
  ü: { 1: "ǖ", 2: "ǘ", 3: "ǚ", 4: "ǜ", 5: "ü" },
};

const VOWELS = "aeiouüv";

/** Check if string has any Unicode tone marks (combining or precomposed). */
function hasToneMarks(s: string): boolean {
  return /[\u0300-\u036f\u0101\u00e1\u01ce\u00e0\u0113\u00e9\u011b\u00e8\u012b\u00ed\u01d0\u00ec\u014d\u00f3\u01d2\u00f2\u016b\u00fa\u01d4\u00f9\u01d6\u01d8\u01da\u01dc\u00fc]/.test(s);
}

/**
 * For a syllable without the trailing number, pick which vowel gets the tone.
 * Priority: a, e, then in "ou" use o, in "iu" use u, in "ui" use i, else last vowel.
 */
function toneVowelIndex(syllable: string): number {
  const lower = syllable.toLowerCase();
  const a = lower.indexOf("a");
  if (a >= 0) return a;
  const e = lower.indexOf("e");
  if (e >= 0) return e;
  if (lower.includes("ou")) return lower.indexOf("o");
  if (lower.includes("iu")) return lower.indexOf("u");
  if (lower.includes("ui")) return lower.indexOf("i");
  for (let i = lower.length - 1; i >= 0; i--) {
    if (VOWELS.includes(lower[i])) return i;
  }
  return -1;
}

/**
 * Convert a single syllable with optional trailing digit 1-5 to tone-mark form.
 * e.g. "ni3" -> "nǐ", "hao3" -> "hǎo", "ma5" -> "ma"
 */
function convertSyllable(syllable: string): string {
  const trimmed = syllable.trim();
  if (!trimmed) return trimmed;
  const last = trimmed.slice(-1);
  const toneNum = last >= "1" && last <= "5" ? parseInt(last, 10) : 0;
  const base = toneNum ? trimmed.slice(0, -1) : trimmed;
  if (!base) return trimmed;
  if (hasToneMarks(base)) return trimmed;
  const idx = toneVowelIndex(base);
  if (idx < 0) return trimmed;
  const char = base[idx];
  const lower = char.toLowerCase();
  const key = lower === "v" ? "ü" : lower;
  const marks = TONE_MARKS[key as keyof typeof TONE_MARKS];
  if (!marks) return trimmed;
  const tone = toneNum || 5;
  const replacement = marks[tone] ?? marks[5];
  const isUpper = char !== lower;
  const newChar = isUpper ? replacement.toUpperCase() : replacement;
  return base.slice(0, idx) + newChar + base.slice(idx + 1);
}

/**
 * Convert full pinyin string: numbered syllables to tone marks.
 * Preserves spaces between syllables. Pass-through if already has tone marks.
 */
export function numberedPinyinToToneMarks(pinyin: string): string {
  if (!pinyin || typeof pinyin !== "string") return pinyin;
  const trimmed = pinyin.trim();
  if (hasToneMarks(trimmed)) return trimmed;
  return trimmed
    .split(/\s+/)
    .map(convertSyllable)
    .join(" ");
}
