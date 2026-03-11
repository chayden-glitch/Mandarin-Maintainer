import sqlite3
from datetime import datetime
from typing import Optional

DATABASE_PATH = "chinese_tutor.db"


def get_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS vocabulary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            simplified TEXT NOT NULL,
            pinyin TEXT NOT NULL,
            english TEXT NOT NULL,
            lesson_number INTEGER,
            example_sentence TEXT,
            buried INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(simplified, pinyin)
        )
    """)

    # Add buried column if it doesn't exist (for existing databases)
    try:
        cursor.execute("ALTER TABLE vocabulary ADD COLUMN buried INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass  # Column already exists

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vocabulary_id INTEGER NOT NULL,
            card_type TEXT NOT NULL CHECK(card_type IN ('Recognition', 'Production')),
            stability REAL DEFAULT 0.0,
            difficulty REAL DEFAULT 0.0,
            elapsed_days REAL DEFAULT 0.0,
            scheduled_days REAL DEFAULT 0.0,
            reps INTEGER DEFAULT 0,
            state INTEGER DEFAULT 0,
            last_review TEXT,
            due TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (vocabulary_id) REFERENCES vocabulary(id) ON DELETE CASCADE,
            UNIQUE(vocabulary_id, card_type)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)

    cursor.execute("""
        INSERT OR IGNORE INTO settings (key, value) VALUES ('max_new_cards_per_day', '5')
    """)

    cursor.execute("""
        INSERT OR IGNORE INTO settings (key, value) VALUES ('max_due_cards_per_day', '30')
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS word_cache (
            simplified TEXT PRIMARY KEY,
            pinyin TEXT NOT NULL,
            english TEXT NOT NULL,
            source TEXT DEFAULT 'gemini',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS review_streaks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL UNIQUE,
            cards_reviewed INTEGER DEFAULT 0,
            streak_count INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()


def get_setting(key: str, default: str = None) -> Optional[str]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else default


def set_setting(key: str, value: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
    """, (key, value))
    conn.commit()
    conn.close()


def add_word(simplified: str, pinyin: str, english: str, lesson_number: Optional[int] = None, example_sentence: Optional[str] = None):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM vocabulary WHERE simplified = ?", (simplified,))
    existing = cursor.fetchone()

    if existing:
        conn.close()
        return {'status': 'skipped', 'reason': 'duplicate'}

    try:
        cursor.execute("""
            INSERT INTO vocabulary (simplified, pinyin, english, lesson_number, example_sentence)
            VALUES (?, ?, ?, ?, ?)
        """, (simplified, pinyin, english, lesson_number, example_sentence))
        conn.commit()
        return {'status': 'added', 'id': cursor.lastrowid}
    except sqlite3.IntegrityError:
        conn.close()
        return {'status': 'skipped', 'reason': 'duplicate'}
    finally:
        conn.close()


def get_all_words():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM vocabulary ORDER BY lesson_number, id")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_words_without_examples():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM vocabulary
        WHERE example_sentence IS NULL OR example_sentence = ''
        ORDER BY id
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def update_example_sentence(word_id: int, example_sentence: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE vocabulary SET example_sentence = ? WHERE id = ?
    """, (example_sentence, word_id))
    conn.commit()
    conn.close()


def get_word_count():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM vocabulary")
    count = cursor.fetchone()[0]
    conn.close()
    return count


def get_words_with_examples_count():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT COUNT(*) FROM vocabulary
        WHERE example_sentence IS NOT NULL AND example_sentence != ''
    """)
    count = cursor.fetchone()[0]
    conn.close()
    return count


def update_review_streak(cards_reviewed: int):
    """Update streak upon daily review. A day counts if at least 5 cards reviewed."""
    from datetime import date
    conn = get_connection()
    cursor = conn.cursor()
    today = date.today().isoformat()

    # Get yesterday's streak info
    cursor.execute("SELECT streak_count FROM review_streaks ORDER BY date DESC LIMIT 1")
    last_row = cursor.fetchone()
    last_streak = last_row[0] if last_row else 0

    # Get today's entry if it exists
    cursor.execute("SELECT cards_reviewed, streak_count FROM review_streaks WHERE date = ?", (today,))
    today_row = cursor.fetchone()

    if today_row:
        # Update today's count
        new_count = today_row[0] + cards_reviewed
        cursor.execute("UPDATE review_streaks SET cards_reviewed = ? WHERE date = ?", (new_count, today))
    else:
        # Create today's entry with incremented streak if yesterday's count >= 5
        new_streak = last_streak + 1 if last_streak > 0 and last_row else 1
        cursor.execute(
            "INSERT INTO review_streaks (date, cards_reviewed, streak_count) VALUES (?, ?, ?)",
            (today, cards_reviewed, new_streak)
        )

    conn.commit()
    conn.close()


def get_review_streak() -> int:
    """Get current review streak (only counts days with >= 5 cards reviewed)."""
    from datetime import date
    conn = get_connection()
    cursor = conn.cursor()
    today = date.today().isoformat()

    # Get today's entry
    cursor.execute("SELECT cards_reviewed FROM review_streaks WHERE date = ?", (today,))
    today_row = cursor.fetchone()

    # Only count as a review day if >= 5 cards
    if today_row and today_row[0] >= 5:
        cursor.execute("SELECT streak_count FROM review_streaks WHERE date = ?", (today,))
        result = cursor.fetchone()
        conn.close()
        return result[0] if result else 0

    # If today doesn't count, get the last valid streak
    cursor.execute("""
        SELECT streak_count FROM review_streaks
        WHERE cards_reviewed >= 5
        ORDER BY date DESC LIMIT 1
    """)
    result = cursor.fetchone()
    conn.close()
    return result[0] if result else 0


def clear_database():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM vocabulary")
    conn.commit()
    conn.close()


def update_word(word_id: int, simplified: str, pinyin: str, english: str,
                lesson_number: Optional[int] = None, example_sentence: Optional[str] = None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE vocabulary
        SET simplified = ?, pinyin = ?, english = ?, lesson_number = ?, example_sentence = ?
        WHERE id = ?
    """, (simplified.strip(), pinyin.strip(), english.strip(), lesson_number, example_sentence, word_id))
    conn.commit()
    conn.close()


def delete_word(word_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM vocabulary WHERE id = ?", (word_id,))
    conn.commit()
    conn.close()


def get_word_by_id(word_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM vocabulary WHERE id = ?", (word_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def bury_vocabulary(vocab_id: int):
    """Mark a vocabulary item as buried (won't appear in reviews)"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE vocabulary SET buried = 1 WHERE id = ?", (vocab_id,))
    conn.commit()
    conn.close()


def unbury_vocabulary(vocab_id: int):
    """Unbury a vocabulary item (will appear in reviews again)"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE vocabulary SET buried = 0 WHERE id = ?", (vocab_id,))
    conn.commit()
    conn.close()


def get_buried_count():
    """Get count of buried vocabulary items"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM vocabulary WHERE buried = 1")
    count = cursor.fetchone()[0]
    conn.close()
    return count


def get_cached_translation(simplified: str):
    """Get a translation from the word cache"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT pinyin, english FROM word_cache WHERE simplified = ?", (simplified,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {'pinyin': row[0], 'english': row[1]}
    return None


def get_cached_translations_batch(words: list):
    """Get multiple translations from cache in a single query"""
    if not words:
        return {}
    conn = get_connection()
    cursor = conn.cursor()
    placeholders = ','.join('?' * len(words))
    cursor.execute(f"SELECT simplified, pinyin, english FROM word_cache WHERE simplified IN ({placeholders})", words)
    rows = cursor.fetchall()
    conn.close()
    return {row[0]: {'pinyin': row[1], 'english': row[2]} for row in rows}


def cache_translation(simplified: str, pinyin: str, english: str, source: str = 'gemini'):
    """Cache a single translation"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO word_cache (simplified, pinyin, english, source)
        VALUES (?, ?, ?, ?)
    """, (simplified, pinyin, english, source))
    conn.commit()
    conn.close()


def cache_translations_batch(translations: dict, source: str = 'gemini'):
    """Cache multiple translations at once"""
    if not translations:
        return
    conn = get_connection()
    cursor = conn.cursor()
    for word, trans in translations.items():
        cursor.execute("""
            INSERT OR REPLACE INTO word_cache (simplified, pinyin, english, source)
            VALUES (?, ?, ?, ?)
        """, (word, trans.get('pinyin', ''), trans.get('english', ''), source))
    conn.commit()
    conn.close()


def get_word_cache_count():
    """Get the number of words in the cache"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM word_cache")
    count = cursor.fetchone()[0]
    conn.close()
    return count


def import_hsk_vocabulary():
    """Import HSK vocabulary from CSV into word_cache table (runs once on startup)"""
    import os
    csv_path = "attached_assets/HSK_Simplified_English_1768849766516.csv"

    if not os.path.exists(csv_path):
        return 0

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM word_cache WHERE source = 'hsk'")
    existing_count = cursor.fetchone()[0]

    if existing_count > 1000:
        conn.close()
        return existing_count

    imported = 0
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        header = f.readline()
        for line in f:
            parts = line.strip().split('\t')
            if len(parts) >= 3:
                simplified = parts[0].strip().replace('\ufeff', '')
                pinyin = parts[1].strip()
                english = parts[2].strip()
                if simplified and pinyin and english:
                    cursor.execute("""
                        INSERT OR IGNORE INTO word_cache (simplified, pinyin, english, source)
                        VALUES (?, ?, ?, 'hsk')
                    """, (simplified, pinyin, english))
                    if cursor.rowcount > 0:
                        imported += 1

    conn.commit()
    conn.close()
    return imported
