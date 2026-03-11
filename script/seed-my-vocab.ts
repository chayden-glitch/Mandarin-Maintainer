/**
 * One-time script: copies template@local vocabulary to an existing user account.
 * Usage: npm run seed-my-vocab
 */
import "dotenv/config";
import { db } from "../server/db";
import { users, vocabulary, cards } from "../shared/schema";
import { eq } from "drizzle-orm";

const TARGET_EMAIL = "cthayden9@gmail.com";
const TEMPLATE_EMAIL = "template@local";

async function main() {
  const [templateUser] = await db.select().from(users).where(eq(users.email, TEMPLATE_EMAIL)).limit(1);
  if (!templateUser) {
    console.error("Template user not found. Run `npm run seed-template-user` first.");
    process.exit(1);
  }

  const [targetUser] = await db.select().from(users).where(eq(users.email, TARGET_EMAIL)).limit(1);
  if (!targetUser) {
    console.error(`User ${TARGET_EMAIL} not found.`);
    process.exit(1);
  }

  const sourceVocab = await db.select().from(vocabulary).where(eq(vocabulary.userId, templateUser.id));
  if (sourceVocab.length === 0) {
    console.log("Template user has no vocabulary. Exiting.");
    process.exit(0);
  }
  console.log(`Copying ${sourceVocab.length} words to ${TARGET_EMAIL}...`);

  let copied = 0;
  let skipped = 0;
  for (const row of sourceVocab) {
    const [inserted] = await db
      .insert(vocabulary)
      .values({
        userId: targetUser.id,
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

    if (inserted) {
      copied++;
      for (const cardType of ["Recognition", "Production"]) {
        await db
          .insert(cards)
          .values({
            vocabularyId: inserted.id,
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

  console.log(`Done. Copied ${copied} new words, skipped ${skipped} already-existing words.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
