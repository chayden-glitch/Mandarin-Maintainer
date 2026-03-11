# Chinese Tutor

## Overview
A mobile-first Chinese language learning web app with two core features:
1. **FSRS-based flashcard review** for vocabulary retention with spaced repetition
2. **News reader** that pulls native Chinese articles with inline word translations

The app uses a CSV-uploaded vocabulary corpus as its foundation and features a clean, minimalist UI with Chinese-inspired design (red/gold color palette).

## Recent Changes
- 2026-02-16: Migrated vocabulary `source` field from single text to text array to support multi-source tracking; duplicate handling now merges sources instead of skipping; Library UI displays multiple source badges per word and supports filtering by any source; upload feedback reports added/merged/skipped counts separately
- 2026-02-16: RSS feed caching (30-min in-memory TTL), article cache moved from in-memory Map to persistent database table (article_cache), metadata-first article rendering, background news prefetching, Markdown cleanup in Gemini translations, responsive navigation header
- 2026-02-13: Initial build - schema, frontend (review/news/library/settings pages), backend (storage, FSRS engine, RSS reader, Gemini translation, TTS, segmenter), full API routes

## User Preferences
- Uses GEMINI_API_KEY secret for Gemini AI translations
- Edge TTS via WebSocket for Chinese pronunciation (zh-CN-XiaoxiaoNeural voice)
- Top navigation bar layout (not sidebar) optimized for mobile
- Clean minimalist aesthetic with Chinese-inspired colors
- Noto Sans SC and Noto Serif SC fonts for Chinese typography
- FSRS algorithm for spaced repetition with sibling burial (24-hour exclusion)

## Project Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui components
- **Backend**: Express.js with PostgreSQL via Drizzle ORM
- **Key Libraries**: ts-fsrs (spaced repetition), feedparser-promised (RSS), opencc-js (Traditional→Simplified), ws (TTS WebSocket)
- **Design Tokens**: Primary red (HSL 4° 65% 48%), Gold accent (HSL 38° 75% 55%), warm neutral backgrounds

### Key Files
- `shared/schema.ts` - Database schema (vocabulary, cards, hskWords, settings, reviewStreaks, articleCache)
- `server/storage.ts` - Database CRUD operations with IStorage interface
- `server/fsrs-engine.ts` - FSRS spaced repetition algorithm integration
- `server/rss-reader.ts` - RSS feed aggregator (BBC, VOA, NYT, WSJ Chinese)
- `server/gemini.ts` - Gemini AI translation service
- `server/tts.ts` - Edge TTS via WebSocket for Chinese audio
- `server/segmenter.ts` - Chinese text segmentation with vocabulary matching
- `server/routes.ts` - All API endpoints
- `client/src/pages/review.tsx` - Flashcard review page
- `client/src/pages/news.tsx` - News reader with article viewer
- `client/src/pages/library.tsx` - Vocabulary management with CSV upload
- `client/src/pages/settings.tsx` - App settings
- `client/src/components/navigation.tsx` - Top navigation bar
- `client/src/components/theme-provider.tsx` - Light/dark theme support

### Database Tables
- `vocabulary` - User's vocabulary corpus (simplified, pinyin, english, lesson_number)
- `cards` - FSRS flashcards linked to vocabulary (Recognition + Production types)
- `hsk_words` - HSK translation cache for inline word lookups
- `settings` - App configuration key-value store
- `review_streaks` - Daily review streak tracking
- `article_cache` - Persistent cache for processed articles (survives server restarts)
