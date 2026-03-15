# Lingua Boost - Chinese Vocabulary Learning App

## Overview
A personal Chinese (Mandarin) learning app that helps maintain and grow vocabulary after formal study, using spaced repetition flashcards and a Chinese news reader.

## Architecture
- **Frontend:** React + Vite + Tailwind CSS, served from `client/` directory
- **Backend:** Node.js + Express, in `server/` directory
- **Database:** PostgreSQL with Drizzle ORM, schema in `shared/schema.ts`
- **Build:** Single server serves both API and frontend (Vite in dev mode, static in prod)

## Key Features
- Vocabulary library with CSV upload support
- Daily flashcard review using FSRS spaced repetition algorithm (ts-fsrs)
- Chinese news reader (BBC, VOA, NYT, WSJ Chinese via RSS) with vocabulary highlighting
- Google Gemini AI for translations
- Edge TTS via WebSocket for Chinese audio pronunciation
- Chinese text segmentation for vocabulary matching in articles
- HSK word list integration

## Project Structure
- `shared/schema.ts` - Drizzle ORM schema (vocabulary, cards, hskWords, settings, reviewStreaks, articleCache)
- `server/index.ts` - Express app entry point, serves on port 5000
- `server/routes.ts` - All API endpoints
- `server/storage.ts` - Database CRUD operations
- `server/db.ts` - PostgreSQL connection pool via Drizzle
- `server/fsrs-engine.ts` - FSRS spaced repetition logic
- `server/rss-reader.ts` - RSS feed aggregator with article caching
- `server/gemini.ts` - Google Gemini AI integration
- `server/tts.ts` - Edge TTS WebSocket integration
- `server/segmenter.ts` - Chinese text segmentation
- `server/vite.ts` - Vite dev server middleware integration
- `client/src/pages/` - React pages (review, news, library, settings)
- `vite.config.ts` - Vite config (root: client/, outDir: dist/public/)
- `drizzle.config.ts` - Drizzle Kit config

## Development
- Run: `npm run dev` (starts Express + Vite middleware on port 5000)
- Database push: `npm run db:push`
- Build: `npm run build`
- Start (prod): `npm run start`

## Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string (auto-set by Replit database)
- `GEMINI_API_KEY` - Google Gemini AI API key (optional, for translations)

## Deployment
- Target: autoscale
- Build command: `npm run build`
- Run command: `node dist/index.cjs`

## Notes
- The dev script does NOT use a `.env` file; all env vars come from Replit's environment
- Vite runs in middleware mode (embedded in Express) in development
- `allowedHosts: true` is set in vite.ts to support Replit's proxy setup
- Database backup is in `backup.sql` (restored during initial import)
