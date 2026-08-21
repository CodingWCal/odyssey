/**
 * One-off fix: correct a stale display name directly in the database.
 * Run locally (uses your local DATABASE_URL) with:
 *   npx tsx scripts/fix-mandy-name.ts
 * Safe to delete after running once.
 */
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient();

async function main() {
  // Adjust the email below to Mandy's real sign-in email if this doesn't match.
  const email = "mandy.wong@example.com";

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email ${email} — check the address and try again.`);
    process.exit(1);
  }

  console.log(`Found user ${user.id} — current name: "${user.name}"`);
  const updated = await db.user.update({
    where: { id: user.id },
    data: { name: "Mandy Wong" },
  });
  console.log(`Updated name to: "${updated.name}"`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
