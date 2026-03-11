import "dotenv/config";
import { db } from "../server/db";
import { vocabulary } from "../shared/schema";
import { sql } from "drizzle-orm";

async function main() {
  const total = await db.select({ count: sql<number>`count(*)` }).from(vocabulary);
  console.log("Total vocab rows:", total[0].count);

  const sources = await db.execute(
    sql`SELECT source, user_id, COUNT(*) as cnt FROM vocabulary GROUP BY source, user_id ORDER BY cnt DESC LIMIT 30`
  );
  console.log("Sources/users breakdown:");
  for (const row of sources.rows as any[]) {
    console.log(` userId=${row.user_id}  count=${row.cnt}  source=${JSON.stringify(row.source)}`);
  }
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
