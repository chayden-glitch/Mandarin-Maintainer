import { sql } from "drizzle-orm";
import { pgTable, text, integer, real, serial, timestamp, boolean, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const vocabulary = pgTable("vocabulary", {
  id: serial("id").primaryKey(),
  simplified: text("simplified").notNull(),
  pinyin: text("pinyin").notNull(),
  english: text("english").notNull(),
  source: text("source").array(),
  lessonNumber: integer("lesson_number").array(),
  exampleSentence: text("example_sentence"),
  buried: boolean("buried").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("vocab_simplified_pinyin_idx").on(table.simplified, table.pinyin),
]);

export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  vocabularyId: integer("vocabulary_id").notNull().references(() => vocabulary.id, { onDelete: "cascade" }),
  cardType: text("card_type").notNull(),
  stability: real("stability").default(0),
  difficulty: real("difficulty").default(0),
  elapsedDays: real("elapsed_days").default(0),
  scheduledDays: real("scheduled_days").default(0),
  reps: integer("reps").default(0),
  state: integer("state").default(0),
  lastReview: timestamp("last_review"),
  due: timestamp("due").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("cards_vocab_type_idx").on(table.vocabularyId, table.cardType),
]);

export const hskWords = pgTable("hsk_words", {
  id: serial("id").primaryKey(),
  simplified: text("simplified").notNull().unique(),
  pinyin: text("pinyin").notNull(),
  english: text("english").notNull(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const reviewStreaks = pgTable("review_streaks", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().unique(),
  cardsReviewed: integer("cards_reviewed").default(0),
  streakCount: integer("streak_count").default(0),
});

export const articleCache = pgTable("article_cache", {
  id: serial("id").primaryKey(),
  url: text("url").notNull().unique(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vocabularyRelations = relations(vocabulary, ({ many }) => ({
  cards: many(cards),
}));

export const cardsRelations = relations(cards, ({ one }) => ({
  vocabulary: one(vocabulary, {
    fields: [cards.vocabularyId],
    references: [vocabulary.id],
  }),
}));

export const insertVocabularySchema = createInsertSchema(vocabulary).omit({
  id: true,
  createdAt: true,
});

export const insertCardSchema = createInsertSchema(cards).omit({
  id: true,
  createdAt: true,
});

export const insertHskWordSchema = createInsertSchema(hskWords).omit({
  id: true,
});

export const insertSettingSchema = createInsertSchema(settings);

export type Vocabulary = typeof vocabulary.$inferSelect;
export type InsertVocabulary = z.infer<typeof insertVocabularySchema>;
export type Card = typeof cards.$inferSelect;
export type InsertCard = z.infer<typeof insertCardSchema>;
export type HskWord = typeof hskWords.$inferSelect;
export type InsertHskWord = z.infer<typeof insertHskWordSchema>;
export type Setting = typeof settings.$inferSelect;

export interface ReviewStats {
  dueCount: number;
  totalCards: number;
  reviewedToday: number;
  streak: number;
  newCardsToday: number;
  maxNewPerDay: number;
  maxDuePerDay: number;
  priorityKeywords: string[];
}

export type ArticleCache = typeof articleCache.$inferSelect;

export type CardWithVocabulary = Card & {
  vocabulary: Vocabulary;
};

export type ReviewRating = 1 | 2 | 3 | 4;

export interface ArticleFeed {
  title: string;
  translatedTitle?: string;
  link: string;
  summary: string;
  published: string;
  source: string;
  feedName: string;
  isFree: boolean;
  priority: number;
  matchedKeywords?: string[];
  vocabCount?: number;
}

export interface ArticleContent {
  title: string;
  text: string;
  topImage: string;
}

export interface TranslationResult {
  pinyin: string;
  english: string;
}
