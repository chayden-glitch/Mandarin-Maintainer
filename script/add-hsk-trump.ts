/**
 * One-time script: add 特朗普 (Donald Trump) to the HSK cache.
 * Usage: npx tsx --env-file=.env script/add-hsk-trump.ts
 */
import "dotenv/config";
import { db } from "../server/db";
import { hskWords } from "../shared/schema";

const ENTRY = {
  simplified: "特朗普",
  pinyin: "tè lǎng pǔ",
  english: "Donald Trump",
};

async function main() {
  const [inserted] = await db
    .insert(hskWords)
    .values(ENTRY)
    .onConflictDoNothing({ target: hskWords.simplified })
    .returning();

  if (inserted) {
    console.log(`Added to HSK cache: ${ENTRY.simplified} ${ENTRY.pinyin} → ${ENTRY.english}`);
  } else {
    console.log(`HSK cache already contains "${ENTRY.simplified}". No change.`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
