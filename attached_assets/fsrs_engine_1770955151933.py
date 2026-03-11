import sqlite3
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fsrs import Scheduler, Card, Rating, State
import database

scheduler = Scheduler()


def sync_cards():
    conn = database.get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM vocabulary")
    vocab_ids = [row[0] for row in cursor.fetchall()]

    created_count = 0
    for vocab_id in vocab_ids:
        for card_type in ['Recognition', 'Production']:
            cursor.execute(
                """
                SELECT id FROM cards WHERE vocabulary_id = ? AND card_type = ?
            """, (vocab_id, card_type))

            if cursor.fetchone() is None:
                now = datetime.now(timezone.utc).isoformat()
                cursor.execute(
                    """
                    INSERT INTO cards (vocabulary_id, card_type, stability, difficulty,
                                       elapsed_days, scheduled_days, reps, state, due, created_at)
                    VALUES (?, ?, 0.0, 0.0, 0.0, 0.0, 0, 0, ?, ?)
                """, (vocab_id, card_type, now, now))
                created_count += 1

    conn.commit()
    conn.close()
    return created_count


def get_card_by_id(card_id: int) -> Optional[Dict[str, Any]]:
    conn = database.get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM cards WHERE id = ?", (card_id, ))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def db_card_to_fsrs_card(db_card: Dict[str, Any]) -> Card:
    card = Card()

    card.card_id = db_card.get('id', 0)

    stability = db_card.get('stability')
    if stability is not None and stability > 0:
        card.stability = stability

    difficulty = db_card.get('difficulty')
    if difficulty is not None and difficulty > 0:
        card.difficulty = difficulty

    step = db_card.get('reps', 0) or 0
    card.step = step

    state_val = db_card.get('state', 0) or 0
    if state_val == 0:
        card.state = State.Learning
    else:
        card.state = State(state_val)

    if db_card.get('last_review'):
        try:
            card.last_review = datetime.fromisoformat(
                db_card['last_review'].replace('Z', '+00:00'))
        except:
            card.last_review = None

    if db_card.get('due'):
        try:
            card.due = datetime.fromisoformat(db_card['due'].replace(
                'Z', '+00:00'))
        except:
            card.due = datetime.now(timezone.utc)
    else:
        card.due = datetime.now(timezone.utc)

    return card


def update_card(card_id: int, rating: int) -> bool:
    if rating < 1 or rating > 4:
        return False

    db_card = get_card_by_id(card_id)
    if not db_card:
        return False

    fsrs_card = db_card_to_fsrs_card(db_card)

    rating_map = {
        1: Rating.Again,
        2: Rating.Hard,
        3: Rating.Good,
        4: Rating.Easy
    }
    fsrs_rating = rating_map[rating]

    now = datetime.now(timezone.utc)
    try:
        updated_card, review_log = scheduler.review_card(
            fsrs_card, fsrs_rating, now)
    except Exception as e:
        print(f"FSRS review_card error: {e}")
        return False

    conn = database.get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE cards
        SET stability = ?, difficulty = ?, reps = ?, state = ?, last_review = ?, due = ?
        WHERE id = ?
    """, (updated_card.stability, updated_card.difficulty, updated_card.step,
          updated_card.state.value, now.isoformat(),
          updated_card.due.isoformat(), card_id))
    conn.commit()
    conn.close()

    # Update review streak after successful card review
    reviewed_today = get_cards_reviewed_today()
    database.update_review_streak(reviewed_today)

    return True


def get_due_cards(limit: int = 25) -> List[Dict[str, Any]]:
    conn = database.get_connection()
    cursor = conn.cursor()

    now = datetime.now(timezone.utc).isoformat()
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0).isoformat()
    twenty_four_hours_ago = (datetime.now(timezone.utc) -
                             timedelta(hours=24)).isoformat()

    cursor.execute(
        """
        SELECT c.*, v.simplified, v.pinyin, v.english, v.lesson_number
        FROM cards c
        JOIN vocabulary v ON c.vocabulary_id = v.id
        WHERE c.due <= ? AND (v.buried IS NULL OR v.buried = 0)
        ORDER BY c.due ASC
    """, (now, ))

    all_due_cards = [dict(row) for row in cursor.fetchall()]

    cursor.execute(
        """
        SELECT DISTINCT vocabulary_id FROM cards
        WHERE last_review >= ?
    """, (twenty_four_hours_ago, ))
    recently_reviewed_vocab_ids = {row[0] for row in cursor.fetchall()}

    cursor.execute("""
        SELECT DISTINCT vocabulary_id FROM cards WHERE last_review IS NOT NULL
    """)
    ever_reviewed_vocab_ids = {row[0] for row in cursor.fetchall()}

    conn.close()

    max_new = get_max_new_cards_per_day()
    max_due = get_max_due_cards_per_day()
    new_cards_today = get_new_cards_introduced_today()
    new_cards_remaining = max(0, max_new - new_cards_today)

    result = []
    vocab_ids_in_result = set()
    new_cards_added = 0

    effective_limit = min(limit, max_due)

    for card in all_due_cards:
        vocab_id = card['vocabulary_id']

        if vocab_id in recently_reviewed_vocab_ids:
            continue

        if vocab_id in vocab_ids_in_result:
            continue

        is_new_card = vocab_id not in ever_reviewed_vocab_ids

        if is_new_card:
            if new_cards_added >= new_cards_remaining:
                continue
            new_cards_added += 1

        result.append(card)
        vocab_ids_in_result.add(vocab_id)

        if len(result) >= effective_limit:
            break

    return result


def get_due_cards_count() -> int:
    conn = database.get_connection()
    cursor = conn.cursor()

    now = datetime.now(timezone.utc).isoformat()
    twenty_four_hours_ago = (datetime.now(timezone.utc) -
                             timedelta(hours=24)).isoformat()

    cursor.execute(
        """
        SELECT c.vocabulary_id, c.card_type
        FROM cards c
        JOIN vocabulary v ON c.vocabulary_id = v.id
        WHERE c.due <= ? AND (v.buried IS NULL OR v.buried = 0)
    """, (now, ))

    all_due = [dict(row) for row in cursor.fetchall()]

    cursor.execute(
        """
        SELECT DISTINCT vocabulary_id FROM cards
        WHERE last_review >= ?
    """, (twenty_four_hours_ago, ))
    recently_reviewed_vocab_ids = {row[0] for row in cursor.fetchall()}

    cursor.execute("""
        SELECT DISTINCT vocabulary_id FROM cards WHERE last_review IS NOT NULL
    """)
    ever_reviewed_vocab_ids = {row[0] for row in cursor.fetchall()}

    conn.close()

    max_new = get_max_new_cards_per_day()
    max_due = get_max_due_cards_per_day()
    new_cards_today = get_new_cards_introduced_today()
    new_cards_remaining = max(0, max_new - new_cards_today)

    vocab_ids_counted = set()
    review_count = 0
    new_count = 0

    for card in all_due:
        vocab_id = card['vocabulary_id']
        if vocab_id in recently_reviewed_vocab_ids or vocab_id in vocab_ids_counted:
            continue

        is_new_card = vocab_id not in ever_reviewed_vocab_ids

        if is_new_card:
            if new_count < new_cards_remaining:
                new_count += 1
                vocab_ids_counted.add(vocab_id)
        else:
            review_count += 1
            vocab_ids_counted.add(vocab_id)

    return min(review_count + new_count, max_due)


def get_total_cards_count() -> int:
    conn = database.get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT COUNT(*) FROM cards c
        JOIN vocabulary v ON c.vocabulary_id = v.id
        WHERE v.buried IS NULL OR v.buried = 0
    """)
    count = cursor.fetchone()[0]
    conn.close()
    return count


def bury_card_vocabulary(card_id: int) -> bool:
    """Bury the vocabulary associated with a card"""
    db_card = get_card_by_id(card_id)
    if not db_card:
        return False
    database.bury_vocabulary(db_card['vocabulary_id'])
    return True


def get_cards_reviewed_today() -> int:
    conn = database.get_connection()
    cursor = conn.cursor()

    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0).isoformat()

    cursor.execute(
        """
        SELECT COUNT(*) FROM cards WHERE last_review >= ?
    """, (today_start, ))
    count = cursor.fetchone()[0]
    conn.close()
    return count


def get_new_cards_introduced_today() -> int:
    conn = database.get_connection()
    cursor = conn.cursor()

    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0).isoformat()

    cursor.execute(
        """
        SELECT COUNT(DISTINCT c.vocabulary_id) FROM cards c
        WHERE c.last_review >= ?
        AND NOT EXISTS (
            SELECT 1 FROM cards c2
            WHERE c2.vocabulary_id = c.vocabulary_id
            AND c2.last_review < ?
        )
    """, (today_start, today_start))
    count = cursor.fetchone()[0]
    conn.close()
    return count


def get_max_new_cards_per_day() -> int:
    value = database.get_setting('max_new_cards_per_day', '5')
    return int(value)


def set_max_new_cards_per_day(limit: int):
    database.set_setting('max_new_cards_per_day', str(limit))


def get_max_due_cards_per_day() -> int:
    value = database.get_setting('max_due_cards_per_day', '30')
    return int(value)


def set_max_due_cards_per_day(limit: int):
    database.set_setting('max_due_cards_per_day', str(limit))


def get_practice_cards(limit: int = 20) -> List[Dict[str, Any]]:
    conn = database.get_connection()
    cursor = conn.cursor()

    twenty_four_hours_ago = (datetime.now(timezone.utc) -
                             timedelta(hours=24)).isoformat()

    cursor.execute(
        """
        SELECT DISTINCT vocabulary_id FROM cards
        WHERE last_review >= ?
    """, (twenty_four_hours_ago, ))
    recently_reviewed_vocab_ids = {row[0] for row in cursor.fetchall()}

    cursor.execute("""
        SELECT c.*, v.simplified, v.pinyin, v.english, v.lesson_number
        FROM cards c
        JOIN vocabulary v ON c.vocabulary_id = v.id
        WHERE v.buried IS NULL OR v.buried = 0
        ORDER BY RANDOM()
    """)

    all_cards = [dict(row) for row in cursor.fetchall()]
    conn.close()

    result = []
    vocab_ids_in_result = set()

    for card in all_cards:
        vocab_id = card['vocabulary_id']

        if vocab_id in recently_reviewed_vocab_ids:
            continue

        if vocab_id in vocab_ids_in_result:
            continue

        result.append(card)
        vocab_ids_in_result.add(vocab_id)

        if len(result) >= limit:
            break

    return result
