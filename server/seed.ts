import { db } from "./db";
import { vocabulary, cards, hskWords } from "@shared/schema";
import { sql } from "drizzle-orm";
import seedData from "./seed-data.json";

function log(message: string) {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [seed] ${message}`);
}

const BATCH_SIZE = 200;

async function seedVocabulary() {
  const [vocabCount] = await db.select({ count: sql<number>`count(*)` }).from(vocabulary);
  if (Number(vocabCount.count) > 0) {
    log(`Vocabulary already has ${vocabCount.count} entries — skipping`);
    return false;
  }

  log("Vocabulary table is empty — seeding...");
  const vocabRows = seedData.vocabulary as Array<{
    simplified: string;
    pinyin: string;
    english: string;
    source: string[] | null;
    lesson_number: number[] | null;
    example_sentence: string | null;
    buried: boolean;
    created_at: string;
  }>;

  for (let i = 0; i < vocabRows.length; i += BATCH_SIZE) {
    const batch = vocabRows.slice(i, i + BATCH_SIZE).map((v) => ({
      simplified: v.simplified,
      pinyin: v.pinyin,
      english: v.english,
      source: v.source,
      lessonNumber: v.lesson_number,
      exampleSentence: v.example_sentence,
      buried: v.buried,
      createdAt: v.created_at ? new Date(v.created_at) : new Date(),
    }));
    await db.insert(vocabulary).values(batch).onConflictDoNothing();
  }
  log(`Seeded ${vocabRows.length} vocabulary entries`);
  return true;
}

async function seedCards() {
  const [cardCount] = await db.select({ count: sql<number>`count(*)` }).from(cards);
  if (Number(cardCount.count) > 0) {
    log(`Cards already has ${cardCount.count} entries — skipping`);
    return;
  }

  log("Cards table is empty — seeding...");
  const allVocab = await db.select({ id: vocabulary.id, simplified: vocabulary.simplified, pinyin: vocabulary.pinyin }).from(vocabulary);
  const vocabLookup = new Map<string, number>();
  for (const v of allVocab) {
    vocabLookup.set(`${v.simplified}||${v.pinyin}`, v.id);
  }

  const cardRows = seedData.cards as Array<{
    simplified: string;
    pinyin: string;
    card_type: string;
    stability: number;
    difficulty: number;
    elapsed_days: number;
    scheduled_days: number;
    reps: number;
    state: number;
    last_review: string | null;
    due: string | null;
    created_at: string;
  }>;

  let insertedCards = 0;
  for (let i = 0; i < cardRows.length; i += BATCH_SIZE) {
    const batch = cardRows.slice(i, i + BATCH_SIZE)
      .map((c) => {
        const vocabId = vocabLookup.get(`${c.simplified}||${c.pinyin}`);
        if (!vocabId) return null;
        return {
          vocabularyId: vocabId,
          cardType: c.card_type,
          stability: c.stability,
          difficulty: c.difficulty,
          elapsedDays: c.elapsed_days,
          scheduledDays: c.scheduled_days,
          reps: c.reps,
          state: c.state,
          lastReview: c.last_review ? new Date(c.last_review) : null,
          due: c.due ? new Date(c.due) : new Date(),
          createdAt: c.created_at ? new Date(c.created_at) : new Date(),
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
    if (batch.length > 0) {
      await db.insert(cards).values(batch).onConflictDoNothing();
      insertedCards += batch.length;
    }
  }
  log(`Seeded ${insertedCards} cards`);
}

async function seedHskWords() {
  const [hskCount] = await db.select({ count: sql<number>`count(*)` }).from(hskWords);
  const currentHskCount = Number(hskCount.count);

  if (currentHskCount >= 7000) {
    log(`HSK table already has ${currentHskCount} entries — skipping`);
    return;
  }

  log(`HSK table has ${currentHskCount} entries — seeding...`);
  const hskRows = seedData.hskWords as Array<{
    simplified: string;
    pinyin: string;
    english: string;
  }>;

  for (let i = 0; i < hskRows.length; i += BATCH_SIZE) {
    const batch = hskRows.slice(i, i + BATCH_SIZE).map((h) => ({
      simplified: h.simplified,
      pinyin: h.pinyin,
      english: h.english,
    }));
    await db.insert(hskWords).values(batch).onConflictDoNothing();
  }
  log(`Seeded ${hskRows.length} HSK words`);
}

export async function seedDatabase() {
  try {
    await seedVocabulary();
    await seedCards();
    await seedHskWords();
  } catch (err) {
    log(`Seed error: ${err}`);
  }
}
