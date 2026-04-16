/**
 * Deterministic checks for CC-CEDICT gloss scoring and parsing.
 * Run: npx tsx script/test-cc-cedict-gloss.ts
 */
import assert from "node:assert/strict";
import { chooseLearnerGloss, parseCedictLine, cedictLineToDbRow } from "../server/lexicon/cc-cedict";

function assertEq<T>(actual: T, expected: T, msg: string) {
  assert.equal(actual, expected, msg);
}

// Gloss scoring (inputs are per-slash gloss strings, as after CC-CEDICT split)
assertEq(chooseLearnerGloss(["to accept", "to receive", "CL:個|个[ge4]"]), "accept", "prefers short verb over classifier");
assertEq(chooseLearnerGloss(["surname Wang", "king", "monarch"]), "king", "skips surname-tagged sense when another exists");
assertEq(chooseLearnerGloss(["variant of 見|见[jian4]", "to see"]), "see", "skips variant-of");
assertEq(
  chooseLearnerGloss(["literary archaism (rare)", "cat", "CL:隻|只[zhi1]"]),
  "cat",
  "prefers plain short gloss over literary and classifier junk"
);

// Full line → DB row
const line1 = "中國 中国 [Zhong1 guo2] /China/Middle Kingdom/";
const row1 = cedictLineToDbRow(line1);
assert.ok(row1, "parses China line");
assertEq(row1!.simplified, "中国");
assert.ok(row1!.pinyin.includes("Zhōng") || row1!.pinyin.includes("zhōng"), "pinyin has tone marks");
assert.ok(row1!.english.length > 0, "english non-empty");

const line2 = "的 的 [de5] /of/possessive particle/";
const row2 = cedictLineToDbRow(line2);
assert.ok(row2);
assertEq(row2!.simplified, "的");

const bad = parseCedictLine("not a dict line");
assert.equal(bad, null);

console.log("cc-cedict gloss tests: OK");
process.exit(0);
