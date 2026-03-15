# Lingua Boost

A personal Chinese (Mandarin) learning app to **maintain and grow vocabulary** after formal study—using your own word list, daily flashcard review, and real Chinese news with your known words highlighted.

## What it does (in plain terms)

- **Vocabulary library**  
  You upload a spreadsheet (CSV) of words you’ve already learned (e.g. from MIT or other courses). The app stores this as your personal “corpus”—the set of words it will help you keep sharp and build on.

- **Daily flashcard review (spaced repetition)**  
  The app shows you flashcards on a schedule designed so you see each word right when you’re about to forget it (this is called *spaced repetition*). It uses the **FSRS** algorithm—a modern, research-backed way to decide *when* to show each card. You can review in both directions: see the Chinese and recall the English, or see the English and recall the Chinese.

- **Chinese news reader**  
  The app pulls articles from Chinese-language news (e.g. BBC, VOA, NYT Chinese, WSJ Chinese). When you read an article, **words that are in your vocabulary list are highlighted**. Tapping a word shows your saved definition; you can also “mine” new words from the article and add them to your deck for future review. Reading real content helps you notice and reinforce the words you know.

So in practice: you do a short review session when cards are due, and you read news when you want—with your known vocabulary surfaced in context.

## Who it’s for

Intermediate to advanced learners (e.g. after formal coursework) who want to retain and expand their vocabulary without relying on generic apps that don’t use *their* existing word list or that overuse gamification. The app is built to grow with you and to fit into daily life (commute, short sessions, reading when you have time).

## Tech stack (for reference)

- **Frontend:** React, Vite, Tailwind CSS  
- **Backend:** Node.js, Express  
- **Data:** PostgreSQL with Drizzle ORM  
- **Spaced repetition:** ts-fsrs (FSRS)  
- **News:** RSS feeds (feedparser-promised, rss-parser), article fetching and caching  
- **Other:** Google Gemini for translations/nuance, text-to-speech (TTS), Chinese text segmentation for matching your vocabulary in articles  

## Getting started

- Install dependencies: `npm install`
- Configure environment (e.g. `.env` for `DATABASE_URL`, `GEMINI_API_KEY` if you use translations)
- Run the app: `npm run dev`

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
