# CC-CEDICT data

Place the **simplified** CC-CEDICT dictionary file here as:

`cedict_ts.u8`

## Download

1. Open [CC-CEDICT / MDBG](https://www.mdbg.net/chinese/dictionary?page=cc-cedict).
2. Download the current `cedict_ts.u8` (or equivalent UTF-8 simplified release).
3. Save it to `data/cc-cedict/cedict_ts.u8`.

## Import into PostgreSQL

After schema is applied (`npm run db:push`):

```bash
npx tsx --env-file=.env script/import-cc-cedict.ts
```

Optional: pass a custom path:

```bash
npx tsx --env-file=.env script/import-cc-cedict.ts /path/to/cedict_ts.u8
```

## Verify gloss logic (no DB)

```bash
npx tsx script/test-cc-cedict-gloss.ts
```

## Runtime validation (after import)

1. Apply schema: `npm run db:push`
2. Import dictionary (this repo): `npm run import:cedict`
3. Start app and open a long Chinese news article.
4. Confirm more Chinese tokens show translation popovers than before import (CC-CEDICT covers most common characters).
5. Confirm feed list English headlines still work (unchanged `batchTranslateTitles` / `translateTitle` paths).
6. Optional: watch server logs for fewer `batchTranslateWords` calls / fewer `429` errors under normal reading.
