/**
 * CC-CEDICT line parsing and learner-friendly gloss selection.
 * Used by import script and (indirectly) by runtime via DB rows produced from this logic.
 */

import { numberedPinyinToToneMarks } from "../pinyin";

export interface ParsedCedictLine {
  traditional: string;
  simplified: string;
  pinyinNumbered: string;
  definitions: string[];
}

/** Tiny allowlist boost for very common English gloss roots (optional +1). */
const LEARNER_GLOSS_ALLOWLIST = new Set([
  "go",
  "come",
  "have",
  "make",
  "take",
  "get",
  "government",
  "china",
  "people",
  "time",
  "day",
  "year",
  "country",
  "world",
  "war",
  "peace",
]);

const REJECT_SUBSTRINGS = [
  "cl:",
  "variant of",
  "see also",
  "surname",
  "abbr.",
] as const;

const META_SUBSTRINGS = ["classifier", "particle", "dialect", "literary"] as const;

/**
 * Parse one CC-CEDICT dictionary line (excluding comment lines).
 * Format: Traditional Simplified [pinyin] /def1/def2/
 */
export function parseCedictLine(line: string): ParsedCedictLine | null {
  const t = line.trim();
  if (!t || t.startsWith("#")) return null;

  const bracket = t.indexOf("[");
  const bracketEnd = t.indexOf("]", bracket + 1);
  const slashStart = t.indexOf("/", bracketEnd + 1);
  if (bracket < 0 || bracketEnd < 0 || slashStart < 0) return null;

  const head = t.slice(0, bracket).trim();
  const pinyinNumbered = t.slice(bracket + 1, bracketEnd).trim();
  const defsPart = t.slice(slashStart);

  const headParts = head.split(/\s+/);
  if (headParts.length < 2) return null;
  const traditional = headParts[0]!;
  const simplified = headParts[1]!;

  const defsRaw = defsPart.replace(/^\/+|\/+$/g, "");
  const definitions = defsRaw
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!traditional || !simplified || !pinyinNumbered || definitions.length === 0) return null;

  return { traditional, simplified, pinyinNumbered, definitions };
}

function normalizeCandidate(raw: string): string {
  let s = raw.trim().replace(/^\/+|\/+$/g, "").trim();
  s = s.replace(/\s+/g, " ");
  return s;
}

function shouldHardReject(candidate: string): boolean {
  const c = candidate.toLowerCase();
  if (!c) return true;
  if (c.length > 40) return true;
  for (const sub of REJECT_SUBSTRINGS) {
    if (c.includes(sub)) return true;
  }
  return false;
}

function wordCount(candidate: string): number {
  return candidate.split(/\s+/).filter(Boolean).length;
}

function scoreCandidate(candidate: string, orderIndex: number): number {
  let score = 0;
  const lower = candidate.toLowerCase();
  const wc = wordCount(candidate);

  if (wc === 1) score += 4;
  else if (wc === 2) score += 3;
  else if (wc === 3) score += 1;
  else score -= 2;

  if (/[,;]/.test(candidate)) score -= 2;
  if (/[()]/.test(candidate)) score -= 2;

  if (/^[a-z][a-z\s-]*$/i.test(candidate.trim())) score += 2;

  let hasMeta = false;
  for (const m of META_SUBSTRINGS) {
    if (lower.includes(m)) {
      hasMeta = true;
      break;
    }
  }
  if (hasMeta) score -= 2;

  const firstWord = lower.split(/\s+/)[0] ?? "";
  if (firstWord && LEARNER_GLOSS_ALLOWLIST.has(firstWord)) score += 1;

  score -= orderIndex * 0.001;
  return score;
}

/**
 * Deterministic learner-friendly gloss from CC-CEDICT definition list.
 */
export function chooseLearnerGloss(definitions: string[]): string {
  const normalized = definitions.map(normalizeCandidate).filter(Boolean);

  type Scored = { text: string; score: number; order: number; len: number };
  const scored: Scored[] = [];

  for (let i = 0; i < normalized.length; i++) {
    const cand = normalized[i]!;
    if (shouldHardReject(cand)) continue;
    let display = cand;
    if (/^to\s+/i.test(display)) {
      display = display.replace(/^to\s+/i, "").trim();
    }
    if (!display) continue;
    const score = scoreCandidate(display, i);
    scored.push({ text: display, score, order: i, len: display.length });
  }

  if (scored.length === 0) {
    const fallback = normalized.find((c) => c.length > 0);
    return fallback ? normalizeCandidate(fallback.replace(/^to\s+/i, "").trim()) || fallback : "";
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.len !== b.len) return a.len - b.len;
    return a.order - b.order;
  });

  return scored[0]!.text;
}

export interface CedictDbRow {
  traditional: string;
  simplified: string;
  pinyin: string;
  english: string;
}

export function cedictLineToDbRow(line: string): CedictDbRow | null {
  const parsed = parseCedictLine(line);
  if (!parsed) return null;
  const english = chooseLearnerGloss(parsed.definitions);
  if (!english) return null;
  const pinyin = numberedPinyinToToneMarks(parsed.pinyinNumbered.replace(/\u00a0/g, " "));
  if (!pinyin) return null;
  return {
    traditional: parsed.traditional,
    simplified: parsed.simplified,
    pinyin,
    english,
  };
}
