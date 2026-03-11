/**
 * Deletes a user and all their associated data (vocab, cards, settings, streaks, cache).
 * Cascade deletes handle everything automatically.
 *
 * Usage: npm run delete-user -- <email>
 * Example: npm run delete-user -- cthayden9@gmail.com
 */
import "dotenv/config";
import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

const email = process.argv[2];
if (!email) {
  console.error("Usage: npm run delete-user -- <email>");
  process.exit(1);
}

async function main() {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
  if (!user) {
    console.log(`No user found with email: ${email}`);
    process.exit(0);
  }

  await db.delete(users).where(eq(users.id, user.id));
  console.log(`Deleted user id=${user.id} (${email}) and all associated data.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
