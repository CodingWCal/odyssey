-- Defense-in-depth: enable Row Level Security on every app table.
--
-- The app NEVER queries Supabase from the browser — all data access goes through
-- Next.js server actions using Prisma over a privileged (table-owner) connection,
-- which BYPASSES RLS. But the public anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY) ships
-- in the client bundle, so without RLS anyone could read/write through Supabase's
-- auto-generated REST API.
--
-- Enabling RLS with NO policies makes the `anon` and `authenticated` PostgREST roles
-- deny-all, while the Prisma connection (table owner / BYPASSRLS) keeps full access.
-- NOTE: we intentionally do NOT use FORCE ROW LEVEL SECURITY, so the owning role
-- Prisma connects as continues to bypass these checks.

ALTER TABLE "User"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Trip"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TripMember"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Day"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Event"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Note"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AvailabilityPoll" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AvailabilitySlot" ENABLE ROW LEVEL SECURITY;

-- Belt-and-suspenders: revoke any default table privileges from the public API roles
-- so they can't reach the data even if a future policy is added by mistake.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
