/**
 * Import CC-CEDICT into `cedict_entries`.
 *
 * Download `cedict_ts.u8` from MDBG CC-CEDICT and place at:
 *   data/cc-cedict/cedict_ts.u8
 *
 * Usage:
 *   npx tsx --env-file=.env script/import-cc-cedict.ts [path-to-cedict_ts.u8]
 */
import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { db } from "../server/db";
import { cedictEntries } from "../shared/schema";
import { cedictLineToDbRow } from "../server/lexicon/cc-cedict";

const DEFAULT_PATH = path.join(process.cwd(), "data/cc-cedict/cedict_ts.u8");
const BATCH_SIZE = 500;

async function main() {
  const filePath = process.argv[2] ?? DEFAULT_PATH;
  if (!fs.existsSync(filePath)) {
    console.error(
      `CC-CEDICT file not found: ${filePath}\n` +
        "Download cedict_ts.u8 from https://www.mdbg.net/chinese/dictionary?page=cc-cedict\n" +
        "and save it to data/cc-cedict/cedict_ts.u8 (or pass the path as argv[2])."
    );
    process.exit(1);
  }

  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let lineNum = 0;
  let parsed = 0;
  let skipped = 0;
  let batch: { traditional: string; simplified: string; pinyin: string; english: string }[] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    try {
      await db
        .insert(cedictEntries)
        .values(batch)
        .onConflictDoNothing({ target: [cedictEntries.simplified, cedictEntries.pinyin] });
    } catch (e) {
      for (const row of batch) {
        try {
          await db
            .insert(cedictEntries)
            .values(row)
            .onConflictDoNothing({ target: [cedictEntries.simplified, cedictEntries.pinyin] });
        } catch {
          skipped++;
        }
      }
    }
    parsed += batch.length;
    batch = [];
  };

  for await (const line of rl) {
    lineNum++;
    const row = cedictLineToDbRow(line);
    if (!row) {
      skipped++;
      continue;
    }
    batch.push(row);
    if (batch.length >= BATCH_SIZE) {
      await flush();
      if (lineNum % 5000 === 0) {
        process.stdout.write(`\rProcessed ~${lineNum} lines, inserted attempts: ${parsed}`);
      }
    }
  }
  await flush();

  console.log(`\nDone. Lines read: ${lineNum}, insert batches (rows attempted): ${parsed}, parse skips: ${skipped}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
