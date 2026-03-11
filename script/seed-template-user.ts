/**
 * One-time script: creates the template user and seeds their vocabulary
 * from existing vocab rows with source "China from Different Perspectives"
 * or "Digital Chinese".
 *
 * Usage: npm run seed-template-user
 * Safe to re-run: skips if template user already exists.
 */
import "dotenv/config";
import bcrypt from "bcrypt";
import { db } from "../server/db";
import { users, vocabulary, cards } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

const TEMPLATE_EMAIL = "template@local";
const TEMPLATE_SOURCES = ["China from Different Perspectives", "Digital Chinese"];

async function main() {
  let templateUser = (await db.select().from(users).where(eq(users.email, TEMPLATE_EMAIL)).limit(1))[0];

  if (templateUser) {
    const existingVocab = await db.select().from(vocabulary).where(eq(vocabulary.userId, templateUser.id)).limit(1);
    if (existingVocab.length > 0) {
      console.log(`Template user already exists (id=${templateUser.id}) and has vocabulary. Skipping.`);
      process.exit(0);
    }
    console.log(`Template user exists (id=${templateUser.id}) but has no vocabulary — seeding now.`);
  } else {
    const passwordHash = await bcrypt.hash(Math.random().toString(36), 10);
    const [created] = await db.insert(users).values({ email: TEMPLATE_EMAIL, passwordHash }).returning();
    if (!created) {
      console.error("Failed to create template user.");
      process.exit(1);
    }
    templateUser = created;
    console.log(`Created template user id=${templateUser.id}`);
  }

  // Find all vocabulary rows that have any of the target sources in their source array
  // Include rows with userId IS NULL (legacy data) or any userId
  const sourceRows = await db
    .select()
    .from(vocabulary)
    .where(sql`${vocabulary.source} && ARRAY[${TEMPLATE_SOURCES[0]}, ${TEMPLATE_SOURCES[1]}]::text[]`);

  console.log(`Found ${sourceRows.length} source vocabulary rows (all users/null) matching target sources.`);
  if (sourceRows.length === 0) {
    console.log("No vocabulary found for the specified sources. Exiting.");
    process.exit(0);
  }

  let inserted = 0;
  let skipped = 0;
  for (const row of sourceRows) {
    if (row.userId === templateUser.id) { skipped++; continue; } // already belongs to template user
    const [newRow] = await db
      .insert(vocabulary)
      .values({
        userId: templateUser.id,
        simplified: row.simplified,
        pinyin: row.pinyin,
        english: row.english,
        source: row.source,
        lessonNumber: row.lessonNumber,
        exampleSentence: row.exampleSentence,
        buried: false,
      })
      .onConflictDoNothing()
      .returning();

    if (newRow) {
      inserted++;
      for (const cardType of ["Recognition", "Production"]) {
        await db
          .insert(cards)
          .values({
            vocabularyId: newRow.id,
            cardType,
            stability: 0,
            difficulty: 0,
            elapsedDays: 0,
            scheduledDays: 0,
            reps: 0,
            state: 0,
            due: new Date(),
          })
          .onConflictDoNothing();
      }
    } else {
      skipped++;
    }
  }

  console.log(`Done. Inserted ${inserted} new vocab rows for template user id=${templateUser.id} (${skipped} skipped).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
