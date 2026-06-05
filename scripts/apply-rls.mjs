// One-off: apply prisma/rls.sql to the database using DIRECT_URL from .env.local.
// Usage: node scripts/apply-rls.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Minimal .env.local loader (same convention as prisma.config.ts).
for (const line of readFileSync(join(root, ".env.local"), "utf-8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i === -1) continue;
  const k = t.slice(0, i).trim();
  if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) throw new Error("DIRECT_URL / DATABASE_URL not set");

const sql = readFileSync(join(root, "prisma", "rls.sql"), "utf-8");
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(sql);

// Report RLS status for confirmation.
const { rows } = await client.query(
  `select tablename, rowsecurity from pg_tables where schemaname='public' order by tablename`
);
console.log("RLS status:");
for (const r of rows) console.log(`  ${r.rowsecurity ? "ON " : "off"}  ${r.tablename}`);
await client.end();
console.log("Done.");
