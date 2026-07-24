# ODY-046 · Full user-journey QA audit

> Audit date: 2026-07-24  
> Method: code walkthrough of landing → auth → dashboard → wizard → trip tabs  
> (itinerary, budget, schedule, map, members) for a brand-new user and a  
> returning collaborator. Not a live browser pass — Clerk accounts.dev  
> handshake needs a real browser for authed flows.  
> Cross-checked against `BACKLOG.md` so existing tickets are cited, not refiled.

**In plain terms:** Walk the app as a new traveler and as someone coming back,
and write down what’s broken, confusing, or silently failing — with steps to
reproduce and the files that look responsible.

---

## Personas

| | Persona A — brand new | Persona B — returning |
|---|---|---|
| Start | Landing → Sign up (email + Google) | Sign in → dashboard with trips |
| Happy path | Empty dashboard → NewTripWizard (3 steps) → itinerary → events, notes, budget, schedule, map, members | Re-open trips; viewer vs editor; invite flow |
| Watch for | Empty states, silent form failures, invented landing copy | Role gates (ODY-001), invite placeholder (ODY-037) |

---

## P0 — Correctness & security

### ODY-046-F01 · Production Clerk still blocks real sign-up / OAuth
- **Already:** **ODY-036**
- **Repro:** Production (or any deploy still on `pk_test_*`) — sign-up limited by Clerk dev instance.
- **Files:** Clerk dashboard / `.env.production` (not in repo)

### ODY-046-F02 · Invites incomplete for brand-new users; no guest view link
- **Already:** **ODY-037**
- **Repro:** Invite an email that has never signed up; rely on Clerk invite + `pending_*` user. No view-only share URL exists.
- **Files:** `src/app/trips/[tripId]/members/actions.ts`, `src/components/trips/InviteForm.tsx`, `src/app/trips/[tripId]/members/page.tsx`

---

## P1 — Silent failures & data integrity

### ODY-046-F03 · Event add/edit gives no feedback on invalid or failed submit
- **Already:** **ODY-043** (open PR at time of audit)
- **Repro:** Add Event → leave title blank and submit (or force server throw) — modal looks idle or closes as if it worked.
- **Files:** `src/components/itinerary/AddEventModal.tsx`

### ODY-046-F04 · Expense modal same silent-failure pattern
- **Candidate:** toast on create/update/delete failure (residual of **ODY-013**)
- **Repro:** Add/edit expense → induce server failure — no toast; modal stays open with no explanation.
- **Files:** `src/components/budget/ExpenseModal.tsx`

### ODY-046-F05 · NewTripWizard create failure is silent; invite errors swallowed
- **Candidate**
- **Repro:** Break `createTripWizard` → “Creating…” stops with no message. Or create with invites where `inviteCollaborator` throws → trip exists, invites dropped in empty `catch`.
- **Files:** `src/components/trips/NewTripWizard.tsx`

### ODY-046-F06 · Trip edit save has no error toast; bad dates use `alert`
- **Candidate**
- **Repro:** Edit trip → force `updateTrip` failure — nothing. Invalid date range → browser `alert`.
- **Files:** `src/components/trips/TripEditModal.tsx`

### ODY-046-F07 · Availability grid / apply-window failures swallowed
- **Candidate**
- **Repro:** Mark cells while unauthorized/offline — UI stays optimistic. Owner “Apply best window” failure — empty catch, no toast.
- **Files:** `src/components/trips/AvailabilityGrid.tsx`, `src/components/trips/AvailabilityHeatmap.tsx`

### ODY-046-F08 · TipTap Notes page and itinerary TripNotes fight over the same `Note` row
- **Candidate (high)**
- **Repro:** Save rich notes at `/trips/[id]/notes` (TipTap JSON), then open itinerary — pinned notes read only `content.text` → empty. Reverse path can wipe TipTap content.
- **Files:** `src/components/notes/TiptapEditor.tsx`, `src/components/itinerary/TripNotes.tsx`, `src/app/trips/[tripId]/notes/page.tsx`, `src/app/trips/[tripId]/itinerary/page.tsx`, `src/app/trips/[tripId]/notes/actions.ts`

### ODY-046-F09 · Notes route exists but is not in trip nav (orphaned)
- **Candidate** (pair with F08)
- **Repro:** Sidebar / mobile tabs list Schedule · Itinerary · Map · Budget · Members — no Notes. `/trips/[id]/notes` only via URL.
- **Files:** `src/components/trips/navItems.ts`, `WorkspaceSidebar.tsx`, `MobileTabBar.tsx`

### ODY-046-F10 · Apply-window confirm copy lies about deleting events
- **Candidate** (residual of **ODY-002**)
- **Repro:** Schedule → Apply best window → confirm warns events outside range are permanently removed; server only deletes *empty* out-of-range days and keeps days with events (no “out of range” flag in UI).
- **Files:** `src/components/trips/AvailabilityHeatmap.tsx`, `src/app/trips/[tripId]/schedule/actions.ts`, `src/components/itinerary/DayBlock.tsx`

### ODY-046-F11 · Email sign-up name defaults to “Traveler”
- **Already:** **ODY-044** (open PR at time of audit)
- **Repro:** Email/password sign-up without Clerk name fields → dashboard / members / budget show “Traveler”.
- **Files:** `src/lib/auth.ts`, `src/app/(dashboard)/dashboard/page.tsx`

---

## P2 — Confusing UX, empty states, mobile, auth redirects

### ODY-046-F12 · Landing invents social proof, pricing, dead footer links
- **Already:** **ODY-020**
- **Files:** `src/components/landing/LandingPage.tsx`

### ODY-046-F13 · Sign-in ignores `after` / trip redirect; Sign-up handles it
- **Candidate** (partially **ODY-037**)
- **Repro:** Invite deep-link uses `/sign-up?after=/trips/...`. Bare `/sign-in` has no `after` → default Clerk redirect, not the trip.
- **Files:** `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`, `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`

### ODY-046-F14 · Dashboard empty state weak on mobile
- **Candidate** (mobile residual of **ODY-038/021**)
- **Repro:** New user, 0 trips, &lt;768px — greeting + thin “Plan a new trip” only; desktop gets `NewTripCard`. No “no trips yet” copy.
- **Files:** `src/components/trips/DashboardClient.tsx`

### ODY-046-F15 · Wizard invite Add silently ignores invalid emails
- **Candidate**
- **Repro:** Wizard step 3 → type `not-an-email` → Add → nothing.
- **Files:** `src/components/trips/NewTripWizard.tsx`

### ODY-046-F16 · Cover mood from wizard doesn’t appear on itinerary hero
- **Already:** **ODY-047** (open PR at time of audit)
- **Files:** `src/components/itinerary/ItineraryHero.tsx`, `src/app/trips/[tripId]/itinerary/page.tsx`

### ODY-046-F17 · Weather banner silently vanishes outside forecast window
- **Already:** **ODY-023**
- **Files:** `src/components/shared/WeatherBanner.tsx`, `ItineraryHero.tsx`

### ODY-046-F18 · Map empty when events lack geocoded coords
- **Candidate**
- **Repro:** Add event with free-typed location (no autocomplete pick) and geocode fails → itinerary has the event; Map shows “No pins yet”.
- **Files:** `src/app/trips/[tripId]/map/page.tsx`, `src/app/trips/[tripId]/itinerary/actions.ts`, `src/lib/geocode.ts`, `LocationAutocomplete.tsx`

### ODY-046-F19 · Location autocomplete errors are invisible
- **Candidate**
- **Repro:** Geocode 401/429/network → catch ignores; dropdown empty with no “couldn’t search”.
- **Files:** `src/components/itinerary/LocationAutocomplete.tsx`

### ODY-046-F20 · Members copy overpromises invite success
- **Already messaging debt under:** **ODY-037**
- **Repro:** “No account needed yet — they sign up after clicking.” Reality: Clerk email may fail; existing users get no email.
- **Files:** `src/app/trips/[tripId]/members/page.tsx`, `InviteForm.tsx`

### ODY-046-F21 · Only owners can open schedule polls; editors get empty state
- **Candidate** (role inconsistency vs **ODY-001** editor+)
- **Repro:** As editor, open Schedule with no poll → “owner hasn’t opened a poll”; editors can’t start one (`upsertPoll` requires owner).
- **Files:** `src/app/trips/[tripId]/schedule/page.tsx`, `schedule/actions.ts`

### ODY-046-F22 · ⌘K shown on dashboard search but does nothing
- **Candidate**
- **Repro:** Desktop dashboard → see ⌘K → press Cmd/Ctrl+K → no focus/handler.
- **Files:** `src/components/trips/DashboardClient.tsx`

### ODY-046-F23 · Toasts sit under the mobile tab bar
- **Candidate** (mobile residual **ODY-038**)
- **Repro:** Trip page &lt;768px → trigger toast → `.toast-stack` z-index 200 vs tab bar 1200 → toast hidden.
- **Files:** `src/app/globals.css` (`.toast-stack`, `.mobile-tab-bar`)

### ODY-046-F24 · Money display rounds away cents
- **Already:** **ODY-024**
- **Files:** `BudgetClient.tsx`, `DashboardClient.tsx`, `TripCard.tsx`

### ODY-046-F25 · Day / category collapse headers not keyboard accessible
- **Already:** **ODY-022**
- **Files:** `DayBlock.tsx`, `BudgetClient.tsx`

---

## P3 — Polish

| ID | Finding | Already / candidate |
|---|---|---|
| F26 | Wizard destination chips hardcode hex | Residual **ODY-011/012** |
| F27 | Cover preview on wizard step 1 before mood chosen | Soft **ODY-047** |
| F28 | No settle-up suggestions on splits | **ODY-030** |
| F29 | Events not auto-sorted by time | **ODY-042** (open PR) |
| F30 | SEO / OG / per-route titles missing | **ODY-026** |

---

## Candidate tickets to file (new — not already ODY-xxx)

Prioritized for follow-up sessions:

1. **Unify Note storage** (plain text vs TipTap JSON) and either add Notes to nav or remove the orphan route — F08 + F09  
2. **Toast remaining silent forms:** wizard, expense modal, trip edit, availability — F04–F07  
3. **Fix apply-window confirm copy** + surface out-of-range days in itinerary — F10  
4. **Sign-in `after` redirect** parity with sign-up — F13  
5. **Map:** warn when a location is saved without coordinates — F18 (+ F19 autocomplete error state)  
6. **Toast z-index** above mobile chrome — F23  
7. **Editors may open schedule polls** (or clarify empty-state copy) — F21  
8. **Dashboard mobile empty state** + remove or wire fake ⌘K — F14 + F22  

---

## Already covered — cite only, don’t refile

**ODY-020, 022, 023, 024, 026, 030, 036, 037, 042, 043, 044, 047**  
(+ residual notes under **ODY-002**, **ODY-013**, **ODY-038**).

At audit time, open PRs also addressed **ODY-043, 042, 047, 044, 045** — re-verify those flows after merge rather than opening duplicates.

---

## Verified OK (do not re-ticket)

| Area | Status |
|------|--------|
| Viewer role server + UI hide | **ODY-001** ✅ |
| Day reconcile on date change | **ODY-002/003** ✅ server-side (UI “flag” still missing — F10) |
| Budget/split Zod | **ODY-004** ✅ |
| Loading skeletons / error boundaries | **ODY-014/013** ✅ on main routes |
| Mobile tab bar + bottom-sheet modals | **ODY-038/021** ✅ largely; toast z-index + empty dash still soft |
| Auth gate on `/dashboard`, `/trips` | `src/proxy.ts` |
| `/` redirects signed-in → dashboard | `src/app/page.tsx` |
| Map / budget / day empty states | Present when data is empty by design |

---

## Acceptance (ODY-046)

- [x] Findings report exists (`docs/ody-046-user-journey-qa.md`)
- [x] Each concrete defect has repro + suspected files
- [x] Cross-references existing backlog tickets; new work listed as candidate tickets
