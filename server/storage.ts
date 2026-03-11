import {
  vocabulary, cards, hskWords, settings, reviewStreaks, articleCache as articleCacheTable,
  type Vocabulary, type InsertVocabulary,
  type Card, type InsertCard,
  type HskWord, type InsertHskWord,
  type CardWithVocabulary,
  type ReviewStats,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, lte, lt, gte, sql, desc, isNull, or, not, inArray, count } from "drizzle-orm";

function getTodayStart(tzOffset?: number): Date {
  const now = new Date();
  if (tzOffset !== undefined && !isNaN(tzOffset)) {
    const clientTime = new Date(now.getTime() - tzOffset * 60 * 1000);
    const clientDateStr = clientTime.toISOString().split("T")[0];
    return new Date(new Date(clientDateStr + "T00:00:00.000Z").getTime() + tzOffset * 60 * 1000);
  }
  const utcDateStr = now.toISOString().split("T")[0];
  return new Date(utcDateStr + "T00:00:00.000Z");
}

function getTodayStr(tzOffset?: number): string {
  const now = new Date();
  if (tzOffset !== undefined && !isNaN(tzOffset)) {
    const clientTime = new Date(now.getTime() - tzOffset * 60 * 1000);
    return clientTime.toISOString().split("T")[0];
  }
  return now.toISOString().split("T")[0];
}

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

export interface IStorage {
  addVocabulary(word: InsertVocabulary): Promise<{ vocab: Vocabulary | null; merged: boolean }>;
  addVocabularyBatch(words: InsertVocabulary[]): Promise<{ added: number; merged: number; skipped: number; skippedWords: string[] }>;
  getAllVocabulary(): Promise<Vocabulary[]>;
  getVocabularyById(id: number): Promise<Vocabulary | undefined>;
  updateVocabulary(id: number, updates: Partial<InsertVocabulary>): Promise<void>;
  deleteVocabulary(id: number): Promise<void>;
  buryVocabulary(id: number, buried: boolean): Promise<void>;
  getVocabularySet(): Promise<Set<string>>;
  getVocabularyMap(): Promise<Map<string, { pinyin: string; english: string }>>;

  syncCards(): Promise<number>;
  getDueCards(limit: number, tzOffset?: number): Promise<CardWithVocabulary[]>;
  getPracticeCards(limit: number): Promise<CardWithVocabulary[]>;
  getCustomPracticeCards(sources: string[], lessons: number[]): Promise<CardWithVocabulary[]>;
  getCardById(id: number): Promise<Card | undefined>;
  updateCard(id: number, updates: Partial<Card>): Promise<void>;
  buryCardVocabulary(cardId: number): Promise<void>;

  getDueCardsCount(tzOffset?: number): Promise<number>;
  getTotalCardsCount(): Promise<number>;
  getCardsReviewedToday(tzOffset?: number): Promise<number>;
  getNewCardsIntroducedToday(tzOffset?: number): Promise<number>;
  getReviewStats(tzOffset?: number): Promise<ReviewStats>;

  getSetting(key: string, defaultValue?: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;

  getHskTranslation(simplified: string): Promise<{ pinyin: string; english: string } | null>;
  getHskTranslationsBatch(words: string[]): Promise<Map<string, { pinyin: string; english: string }>>;
  importHskWords(words: InsertHskWord[]): Promise<number>;
  getHskWordCount(): Promise<number>;

  updateReviewStreak(cardsReviewed: number, tzOffset?: number): Promise<void>;
  getReviewStreak(tzOffset?: number): Promise<number>;

  getArticleCache(url: string): Promise<any | null>;
  setArticleCache(url: string, data: any): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async addVocabulary(word: InsertVocabulary): Promise<{ vocab: Vocabulary | null; merged: boolean }> {
    try {
      const [existing] = await db.select().from(vocabulary)
        .where(eq(vocabulary.simplified, word.simplified));
      if (existing) {
        const existingSources = existing.source || [];
        const existingLessons = existing.lessonNumber || [];
        const newSources = word.source || [];
        const newLessons = word.lessonNumber || [];
        let didMerge = false;
        const mergedSources = [...existingSources];
        const mergedLessons = [...existingLessons];
        for (let i = 0; i < newSources.length; i++) {
          if (!mergedSources.includes(newSources[i])) {
            mergedSources.push(newSources[i]);
            mergedLessons.push(newLessons[i] ?? null);
            didMerge = true;
          }
        }
        if (didMerge) {
          await db.update(vocabulary).set({ source: mergedSources, lessonNumber: mergedLessons }).where(eq(vocabulary.id, existing.id));
          return { vocab: { ...existing, source: mergedSources, lessonNumber: mergedLessons }, merged: true };
        }
        return { vocab: existing, merged: false };
      }

      const [result] = await db.insert(vocabulary).values(word).returning();
      return { vocab: result, merged: false };
    } catch (e) {
      return { vocab: null, merged: false };
    }
  }

  async addVocabularyBatch(words: InsertVocabulary[]): Promise<{ added: number; merged: number; skipped: number; skippedWords: string[] }> {
    let added = 0;
    let merged = 0;
    let skipped = 0;
    const skippedWords: string[] = [];

    const existingSimplified = new Set(
      (await db.select({ simplified: vocabulary.simplified }).from(vocabulary)).map(r => r.simplified)
    );

    for (const word of words) {
      const isNew = !existingSimplified.has(word.simplified);
      const result = await this.addVocabulary(word);
      if (result.vocab && isNew) {
        added++;
        existingSimplified.add(word.simplified);
      } else if (result.merged) {
        merged++;
      } else if (result.vocab) {
        skipped++;
        skippedWords.push(word.simplified);
      } else {
        skipped++;
        skippedWords.push(word.simplified);
      }
    }

    if (added > 0) {
      await this.syncCards();
    }

    return { added, merged, skipped, skippedWords };
  }

  async getAllVocabulary(): Promise<Vocabulary[]> {
    return db.select().from(vocabulary).orderBy(vocabulary.lessonNumber, vocabulary.id);
  }

  async getVocabularyById(id: number): Promise<Vocabulary | undefined> {
    const [result] = await db.select().from(vocabulary).where(eq(vocabulary.id, id));
    return result;
  }

  async updateVocabulary(id: number, updates: Partial<InsertVocabulary>): Promise<void> {
    await db.update(vocabulary).set(updates).where(eq(vocabulary.id, id));
  }

  async deleteVocabulary(id: number): Promise<void> {
    await db.delete(vocabulary).where(eq(vocabulary.id, id));
  }

  async buryVocabulary(id: number, buried: boolean): Promise<void> {
    await db.update(vocabulary).set({ buried }).where(eq(vocabulary.id, id));
  }

  async getVocabularySet(): Promise<Set<string>> {
    const words = await db.select({ simplified: vocabulary.simplified }).from(vocabulary);
    return new Set(words.map((w) => w.simplified));
  }

  async getVocabularyMap(): Promise<Map<string, { pinyin: string; english: string }>> {
    const words = await db.select({
      simplified: vocabulary.simplified,
      pinyin: vocabulary.pinyin,
      english: vocabulary.english,
    }).from(vocabulary);
    const map = new Map<string, { pinyin: string; english: string }>();
    for (const w of words) {
      map.set(w.simplified, { pinyin: w.pinyin, english: w.english });
    }
    return map;
  }

  async syncCards(): Promise<number> {
    const vocabIds = await db.select({ id: vocabulary.id }).from(vocabulary);
    let created = 0;

    for (const { id: vocabId } of vocabIds) {
      for (const cardType of ["Recognition", "Production"]) {
        const [existing] = await db.select().from(cards)
          .where(and(eq(cards.vocabularyId, vocabId), eq(cards.cardType, cardType)));

        if (!existing) {
          const now = new Date();
          await db.insert(cards).values({
            vocabularyId: vocabId,
            cardType,
            stability: 0,
            difficulty: 0,
            elapsedDays: 0,
            scheduledDays: 0,
            reps: 0,
            state: 0,
            due: now,
          });
          created++;
        }
      }
    }

    return created;
  }

  async getDueCards(limit: number, tzOffset?: number): Promise<CardWithVocabulary[]> {
    const now = new Date();
    const todayStart = getTodayStart(tzOffset);

    const allDueCards = await db
      .select({
        card: cards,
        vocab: vocabulary,
      })
      .from(cards)
      .innerJoin(vocabulary, eq(cards.vocabularyId, vocabulary.id))
      .where(
        and(
          lte(cards.due, now),
          or(eq(vocabulary.buried, false), isNull(vocabulary.buried)),
          // Exclude cards reviewed today (unless New) to prevent them from staying in the due pile
          or(
            lt(cards.lastReview, todayStart),
            isNull(cards.lastReview),
            eq(cards.state, 0) // State.New
          )
        )
      )
      .orderBy(sql`RANDOM()`);

    const recentlyReviewedResult = await db
      .select({ vocabularyId: cards.vocabularyId })
      .from(cards)
      .where(gte(cards.lastReview, todayStart));
    const recentlyReviewedVocabIds = new Set(recentlyReviewedResult.map((r) => r.vocabularyId));

    const everReviewedResult = await db
      .select({ vocabularyId: cards.vocabularyId })
      .from(cards)
      .where(not(isNull(cards.lastReview)));
    const everReviewedVocabIds = new Set(everReviewedResult.map((r) => r.vocabularyId));

    const maxNew = parseInt(await this.getSetting("max_new_cards_per_day", "5") || "5");
    const maxDue = parseInt(await this.getSetting("max_due_cards_per_day", "30") || "30");
    const newCardsToday = await this.getNewCardsIntroducedToday(tzOffset);
    const newCardsRemaining = Math.max(0, maxNew - newCardsToday);

    // Group cards by vocabulary ID to handle sibling burial (pick one random type)
    const vocabGroups = new Map<number, typeof allDueCards>();
    for (const item of allDueCards) {
      if (recentlyReviewedVocabIds.has(item.card.vocabularyId)) continue;
      if (!vocabGroups.has(item.card.vocabularyId)) {
        vocabGroups.set(item.card.vocabularyId, []);
      }
      vocabGroups.get(item.card.vocabularyId)!.push(item);
    }

    const selectedCards: typeof allDueCards = [];
    for (const group of Array.from(vocabGroups.values())) {
      const picked = group[Math.floor(Math.random() * group.length)];
      selectedCards.push(picked);
    }

    const newCards: typeof allDueCards = [];
    const reviewCards: typeof allDueCards = [];
    for (const item of selectedCards) {
      const isNew = !everReviewedVocabIds.has(item.card.vocabularyId);
      if (isNew) {
        newCards.push(item);
      } else {
        reviewCards.push(item);
      }
    }

    const sessionLimit = maxDue;
    const result: CardWithVocabulary[] = [];
    let newCardsAdded = 0;

    for (const item of reviewCards) {
      if (result.length >= sessionLimit) break;
      result.push({ ...item.card, vocabulary: item.vocab });
    }

    for (const item of newCards) {
      if (result.length >= sessionLimit) break;
      if (newCardsAdded < newCardsRemaining) {
        result.push({ ...item.card, vocabulary: item.vocab });
        newCardsAdded++;
      }
    }

    if (result.length < sessionLimit) {
      for (const item of newCards) {
        if (result.length >= sessionLimit) break;
        if (!result.some(r => r.id === item.card.id)) {
          result.push({ ...item.card, vocabulary: item.vocab });
        }
      }
    }

    // Final shuffle to randomize the session
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  async getPracticeCards(limit: number): Promise<CardWithVocabulary[]> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentlyReviewedResult = await db
      .select({ vocabularyId: cards.vocabularyId })
      .from(cards)
      .where(gte(cards.lastReview, twentyFourHoursAgo));
    const recentlyReviewedVocabIds = new Set(recentlyReviewedResult.map((r) => r.vocabularyId));

    const allCards = await db
      .select({
        card: cards,
        vocab: vocabulary,
      })
      .from(cards)
      .innerJoin(vocabulary, eq(cards.vocabularyId, vocabulary.id))
      .where(or(eq(vocabulary.buried, false), isNull(vocabulary.buried)))
      .orderBy(sql`RANDOM()`);

    const vocabGroups = new Map<number, typeof allCards>();
    for (const item of allCards) {
      if (recentlyReviewedVocabIds.has(item.card.vocabularyId)) continue;
      if (!vocabGroups.has(item.card.vocabularyId)) {
        vocabGroups.set(item.card.vocabularyId, []);
      }
      vocabGroups.get(item.card.vocabularyId)!.push(item);
    }

    const result: CardWithVocabulary[] = [];
    const shuffledGroups = Array.from(vocabGroups.values());
    for (let i = shuffledGroups.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledGroups[i], shuffledGroups[j]] = [shuffledGroups[j], shuffledGroups[i]];
    }

    for (const group of shuffledGroups) {
      const picked = group[Math.floor(Math.random() * group.length)];
      result.push({ ...picked.card, vocabulary: picked.vocab });
      if (result.length >= limit) break;
    }

    return result;
  }

  async getCustomPracticeCards(sources: string[], lessons: number[]): Promise<CardWithVocabulary[]> {
    if (sources.length === 0) return [];
    const allVocab = await db.select().from(vocabulary).where(or(eq(vocabulary.buried, false), isNull(vocabulary.buried)));
    const filteredVocab = allVocab.filter((w) => {
      const wSources = w.source || [];
      const wLessons = w.lessonNumber || [];
      const hasMatchingSource = wSources.some((s) => sources.includes(s));
      if (!hasMatchingSource) return false;
      if (lessons.length === 0) return true;
      for (let i = 0; i < wSources.length; i++) {
        if (sources.includes(wSources[i]) && wLessons[i] != null && lessons.includes(wLessons[i])) return true;
      }
      return false;
    });
    const vocabIds = filteredVocab.map((w) => w.id);
    if (vocabIds.length === 0) return [];

    const allCards = await db
      .select({ card: cards, vocab: vocabulary })
      .from(cards)
      .innerJoin(vocabulary, eq(cards.vocabularyId, vocabulary.id))
      .where(inArray(vocabulary.id, vocabIds));

    const vocabGroups = new Map<number, typeof allCards>();
    for (const item of allCards) {
      if (!vocabGroups.has(item.card.vocabularyId)) vocabGroups.set(item.card.vocabularyId, []);
      vocabGroups.get(item.card.vocabularyId)!.push(item);
    }
    const result: CardWithVocabulary[] = [];
    for (const group of vocabGroups.values()) {
      const picked = group[Math.floor(Math.random() * group.length)];
      result.push({ ...picked.card, vocabulary: picked.vocab });
    }
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  async getCardById(id: number): Promise<Card | undefined> {
    const [result] = await db.select().from(cards).where(eq(cards.id, id));
    return result;
  }

  async updateCard(id: number, updates: Partial<Card>): Promise<void> {
    // Ensure all dates are stored as UTC to avoid timezone jitter
    const finalUpdates = { ...updates };
    if (finalUpdates.due instanceof Date) {
      finalUpdates.due = new Date(finalUpdates.due.getTime());
    }
    if (finalUpdates.lastReview instanceof Date) {
      finalUpdates.lastReview = new Date(finalUpdates.lastReview.getTime());
    }
    await db.update(cards).set(finalUpdates).where(eq(cards.id, id));
  }

  async buryCardVocabulary(cardId: number): Promise<void> {
    const card = await this.getCardById(cardId);
    if (card) {
      await this.buryVocabulary(card.vocabularyId, true);
    }
  }

  async getDueCardsCount(tzOffset?: number): Promise<number> {
    const now = new Date();
    const todayStart = getTodayStart(tzOffset);

    const allDue = await db
      .select({ vocabularyId: cards.vocabularyId })
      .from(cards)
      .innerJoin(vocabulary, eq(cards.vocabularyId, vocabulary.id))
      .where(
        and(
          lte(cards.due, now),
          or(eq(vocabulary.buried, false), isNull(vocabulary.buried))
        )
      );

    const uniqueVocabIds = new Set(allDue.map((r) => r.vocabularyId));
    const totalDueInDatabase = uniqueVocabIds.size;

    const reviewedToday = await this.getCardsReviewedToday(tzOffset);
    const maxDue = parseInt(await this.getSetting("max_due_cards_per_day", "30") || "30");

    return Math.max(0, Math.min(totalDueInDatabase, maxDue - reviewedToday));
  }

  async getTotalCardsCount(): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(cards)
      .innerJoin(vocabulary, eq(cards.vocabularyId, vocabulary.id))
      .where(or(eq(vocabulary.buried, false), isNull(vocabulary.buried)));
    return result?.count ?? 0;
  }

  async getCardsReviewedToday(tzOffset?: number): Promise<number> {
    const todayStart = getTodayStart(tzOffset);

    const [result] = await db
      .select({ count: count() })
      .from(cards)
      .where(gte(cards.lastReview, todayStart));
    return Number(result?.count ?? 0);
  }

  async getNewCardsIntroducedToday(tzOffset?: number): Promise<number> {
    const todayStart = getTodayStart(tzOffset);

    const result = await db
      .select({ vocabularyId: cards.vocabularyId })
      .from(cards)
      .where(gte(cards.lastReview, todayStart));

    const todayVocabIds = new Set(result.map((r) => r.vocabularyId));
    const vocabIdsList = Array.from(todayVocabIds);
    let newCount = 0;
    for (const vocabId of vocabIdsList) {
      const [hasOlderReview] = await db
        .select({ id: cards.id })
        .from(cards)
        .where(
          and(
            eq(cards.vocabularyId, vocabId),
            lt(cards.lastReview, todayStart)
          )
        )
        .limit(1);
      if (!hasOlderReview) newCount++;
    }

    return newCount;
  }

  async getReviewStats(tzOffset?: number): Promise<ReviewStats> {
    const [dueCount, totalCards, reviewedToday, streak, newCardsToday] = await Promise.all([
      this.getDueCardsCount(tzOffset),
      this.getTotalCardsCount(),
      this.getCardsReviewedToday(tzOffset),
      this.getReviewStreak(tzOffset),
      this.getNewCardsIntroducedToday(tzOffset),
    ]);

    const maxNewPerDay = parseInt(await this.getSetting("max_new_cards_per_day", "5") || "5");
    const maxDuePerDay = parseInt(await this.getSetting("max_due_cards_per_day", "30") || "30");
    const keywordsSetting = await this.getSetting("priority_keywords");
    let priorityKeywords: string[] = ["关税", "特朗普", "金融", "财经", "科技", "经济", "贸易", "市场", "投资", "商业", "科学", "技术"];
    if (keywordsSetting) {
      try {
        priorityKeywords = JSON.parse(keywordsSetting);
      } catch (e) {
        console.error("Failed to parse priority_keywords setting:", e);
      }
    }

    return {
      dueCount,
      totalCards,
      reviewedToday,
      streak,
      newCardsToday,
      maxNewPerDay,
      maxDuePerDay,
      priorityKeywords,
    };
  }

  async getSetting(key: string, defaultValue?: string): Promise<string | undefined> {
    const [result] = await db.select().from(settings).where(eq(settings.key, key));
    return result?.value ?? defaultValue;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }

  async getHskTranslation(simplified: string): Promise<{ pinyin: string; english: string } | null> {
    const [result] = await db.select().from(hskWords).where(eq(hskWords.simplified, simplified));
    return result ? { pinyin: result.pinyin, english: result.english } : null;
  }

  async getHskTranslationsBatch(words: string[]): Promise<Map<string, { pinyin: string; english: string }>> {
    if (words.length === 0) return new Map();

    const results = await db.select().from(hskWords).where(inArray(hskWords.simplified, words));
    const map = new Map<string, { pinyin: string; english: string }>();
    for (const r of results) {
      map.set(r.simplified, { pinyin: r.pinyin, english: r.english });
    }
    return map;
  }

  async importHskWords(words: InsertHskWord[]): Promise<number> {
    let imported = 0;
    const batchSize = 100;

    for (let i = 0; i < words.length; i += batchSize) {
      const batch = words.slice(i, i + batchSize);
      try {
        await db
          .insert(hskWords)
          .values(batch)
          .onConflictDoNothing({ target: hskWords.simplified });
        imported += batch.length;
      } catch (e) {
        for (const word of batch) {
          try {
            await db.insert(hskWords).values(word).onConflictDoNothing({ target: hskWords.simplified });
            imported++;
          } catch (_) {}
        }
      }
    }

    return imported;
  }

  async getHskWordCount(): Promise<number> {
    const [result] = await db.select({ count: count() }).from(hskWords);
    return result?.count ?? 0;
  }

  async updateReviewStreak(cardsReviewed: number, tzOffset?: number): Promise<void> {
    const today = getTodayStr(tzOffset);

    const [existing] = await db.select().from(reviewStreaks).where(eq(reviewStreaks.date, today));

    if (existing) {
      await db
        .update(reviewStreaks)
        .set({ cardsReviewed: (existing.cardsReviewed || 0) + cardsReviewed })
        .where(eq(reviewStreaks.date, today));
    } else {
      const [lastStreak] = await db.select().from(reviewStreaks).orderBy(desc(reviewStreaks.date)).limit(1);
      const newStreak = lastStreak ? (lastStreak.streakCount || 0) + 1 : 1;

      await db.insert(reviewStreaks).values({
        date: today,
        cardsReviewed,
        streakCount: newStreak,
      });
    }
  }

  async getReviewStreak(tzOffset?: number): Promise<number> {
    const today = getTodayStr(tzOffset);

    const [todayRow] = await db.select().from(reviewStreaks).where(eq(reviewStreaks.date, today));
    if (todayRow && (todayRow.cardsReviewed || 0) >= 5) {
      return todayRow.streakCount || 0;
    }

    const [lastValid] = await db
      .select()
      .from(reviewStreaks)
      .where(gte(reviewStreaks.cardsReviewed, 5))
      .orderBy(desc(reviewStreaks.date))
      .limit(1);

    return lastValid?.streakCount || 0;
  }
  async getArticleCache(url: string): Promise<any | null> {
    const [result] = await db.select().from(articleCacheTable).where(eq(articleCacheTable.url, url));
    return result ? result.data : null;
  }

  async setArticleCache(url: string, data: any): Promise<void> {
    await db
      .insert(articleCacheTable)
      .values({ url, data })
      .onConflictDoUpdate({ target: articleCacheTable.url, set: { data, createdAt: new Date() } });
  }
}

export const storage = new DatabaseStorage();
