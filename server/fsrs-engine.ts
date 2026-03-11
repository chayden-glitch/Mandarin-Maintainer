import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card as FSRSCard, type Grade } from "ts-fsrs";
import { storage } from "./storage";
import type { Card } from "@shared/schema";

const params = generatorParameters();
const scheduler = fsrs(params);

function dbCardToFsrsCard(dbCard: Card): FSRSCard {
  const card = createEmptyCard();

  if (dbCard.stability && dbCard.stability > 0) {
    card.stability = dbCard.stability;
  }
  if (dbCard.difficulty && dbCard.difficulty > 0) {
    card.difficulty = dbCard.difficulty;
  }

  card.reps = dbCard.reps || 0;
  card.elapsed_days = dbCard.elapsedDays || 0;
  card.scheduled_days = dbCard.scheduledDays || 0;

  const stateVal = dbCard.state || 0;
  if (stateVal === 0) {
    card.state = State.New;
  } else {
    card.state = stateVal as State;
  }

  if (dbCard.lastReview) {
    card.last_review = new Date(dbCard.lastReview);
  }

  if (dbCard.due) {
    card.due = new Date(dbCard.due);
  }

  return card;
}

export async function reviewCard(cardId: number, rating: number, tzOffset?: number): Promise<boolean> {
  if (rating < 1 || rating > 4) return false;

  const dbCard = await storage.getCardById(cardId);
  if (!dbCard) return false;

  const fsrsCard = dbCardToFsrsCard(dbCard);

  const ratingMap: Record<number, Grade> = {
    1: Rating.Again,
    2: Rating.Hard,
    3: Rating.Good,
    4: Rating.Easy,
  };

  const now = new Date();

  try {
    const result = scheduler.repeat(fsrsCard, now);
    const updatedCard = result[ratingMap[rating]].card;

    // Ensure due date is a valid Date object for storage
    const nextDue = new Date(updatedCard.due);
    console.log(`[FSRS] Card ${cardId} review: Rating ${rating}, Next Due: ${nextDue.toISOString()}, Now: ${now.toISOString()}, Valid: ${nextDue > now}`);

    await storage.updateCard(cardId, {
      stability: updatedCard.stability,
      difficulty: updatedCard.difficulty,
      reps: updatedCard.reps,
      state: updatedCard.state as number,
      lastReview: now,
      due: nextDue,
      elapsedDays: updatedCard.elapsed_days,
      scheduledDays: updatedCard.scheduled_days,
    });

    await storage.updateReviewStreak(1, tzOffset);
    return true;
  } catch (e) {
    console.error("FSRS review error:", e);
    return false;
  }
}
