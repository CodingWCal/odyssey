# Odyssey — Engineering Backlog

> Generated from a full-codebase audit (2026-07-07). Each ticket is scoped to be run
> as a standalone work session by a subagent on a cheaper model. Tickets include the
> files to touch, acceptance criteria, and guardrails so no session needs this audit's context.
>
> **Brand guardrails for every ticket:** keep the editorial, calm, "boarding pass +
> printed map" aesthetic. DM Serif Display for display type, DM Sans body, JetBrains
> Mono for numbers. Palette lives in `src/app/globals.css` (`--peri`, `--teal`,
> `--coral`, `--peach`, `--gold`, `--slate`, `--ink`, `--paper` and the legacy
> `odyssey-*` tokens). Never hardcode hex outside globals.css. No new dependencies
> without strong justification. Prisma only via `src/lib/prisma/db.ts`.

Each ticket opens with an **In plain terms** line — a jargon-free explanation of
what's wrong and what fixing it means for a traveler using the app. Read those to
follow the process without needing the technical details; the bullets underneath
are the engineering spec.

Legend: **P0** correctness/security · **P1** refactor/robustness · **P2** quality-of-life · **P3** new feature
Size: S (<1h) · M (1–3h) · L (3h+) · Model hint: `haiku` for S mechanical, `sonnet` for M/L.

---

## P0 — Correctness & Security

### ODY-036 · Configure production Clerk instance with Google Cloud OAuth — M, sonnet
> **In plain terms:** The app still runs on the login system's "practice mode," which limits who can sign up. This switches it to the real production setup so anyone can create an account (including with Google).
**Production blocker.** The app currently uses Clerk dev keys on production
(`pk_test_*`), which restricts sign-ups and auth. Need to set up a production Clerk
instance and configure Google Cloud OAuth connector for real authentication.
- Create/configure a production Clerk application in Clerk dashboard.
- Set up Google Cloud project and OAuth 2.0 credentials for Clerk connector.
- Update `.env.production` with production Clerk keys (`pk_live_*` and secret key).
- Test sign-in/sign-up flow with real Google OAuth.
- Acceptance: users can sign up and authenticate on production with real credentials (not dev instance limitations).

### ODY-037 · Enable real invitations, join flow, and view-only guest access — L, sonnet
> **In plain terms:** Right now an invite only works if the person already has an account, and there's no way to just *show* someone a trip. This makes invite links work for brand-new people and adds a view-only share link that needs no account at all.
**Depends on ODY-036.** Current invitation system is a placeholder. Need to:
1. **Real invitations:** sending an invite creates a real invite link that a non-user can click to sign up and join the trip (currently only existing users can join).
2. **View-only guest access:** allow trip owner to generate a shareable "view-only" link (no auth required) so external viewers can see the itinerary without signing up or joining.
- Add guest session support (no auth required, read-only access) with a trip-specific token/UUID.
- Update `InviteForm` to support "guest link" generation (copy-able URL, no email needed).
- Modify routes to accept `?guestToken=...` and validate guest token for read-only viewing.
- Real invitation: improve `sendTripInvitation` to generate a join link that creates a new user + adds them to the trip if they don't exist.
- UI: add "Share for viewing" and "Invite to collaborate" buttons on Members page; show active guest links with revoke option.
- Acceptance: (1) non-user can click invite link, sign up, and auto-join trip; (2) non-authenticated user can view itinerary via guest link; (3) owner can revoke both invite and guest links.

### ODY-001 · Enforce the `viewer` role (currently decorative) — M, sonnet — ✅ DONE (PR #5)
> **In plain terms:** The "viewer" role existed in name only — the server never actually stopped viewers from editing anything. Now the server enforces read-only, and viewers don't even see edit buttons.
`TripMember.role` supports `"viewer"` and `InviteForm` lets you invite viewers, but **no
server action checks role** — every mutation only checks membership
(`db.tripMember.findFirst({ tripId, userId })`). A viewer can edit/delete events,
expenses, budget, notes, splits, and invite others.
- Add a `assertTripRole(tripId, userId, minRole)` helper in `src/lib/auth.ts` (owner > editor > viewer).
- Apply to all mutations in `src/app/trips/[tripId]/{itinerary,budget,notes,schedule,members}/actions.ts` and `src/app/trips/actions.ts` (viewers: read-only; inviting: editor+; delete trip/remove member: owner — already enforced).
- UI: hide/disable edit affordances for viewers (pass `role` down from trip layout/pages). Keep visual language intact — disabled states use existing muted tokens.
- Acceptance: a viewer account cannot mutate anything server-side even via direct action invocation; editors unaffected.

### ODY-002 · Reconcile Day records when trip dates change — M, sonnet — ✅ DONE (PR #4)
> **In plain terms:** Changing a trip's dates used to quietly destroy days — and every event planned on them. Now date changes add or remove days safely, never deleting a day that still has plans on it.
`createTrip` auto-creates a `Day` per date, but `updateTrip`
(`src/app/trips/actions.ts:107`) never reconciles days when `startDate`/`endDate`
change. Extending a trip leaves the new dates with no Day rows (nothing to add events
to); shrinking leaves orphan days (with events) outside the range.
- On date change: create missing Day rows; for days now out of range, keep them only if they contain events (surface as "out of range" in the itinerary) or delete if empty. Wrap in `db.$transaction`.
- Watch the `@@unique([tripId, date])` constraint and the local-midnight normalization used in `createTrip` (`setHours(0,0,0,0)`).
- Acceptance: extend a trip by 2 days → 2 new empty days appear in itinerary; shrink → empty out-of-range days removed, days with events preserved and flagged.

### ODY-003 · Normalize Day dates to UTC (timezone drift) — M, sonnet — ✅ DONE (PR #4)
> **In plain terms:** Depending on which timezone the server was in, "July 10" could silently become July 9 or 11. Now a date always means the calendar day you picked.
Day generation uses local server midnight (`current.setHours(0,0,0,0)`), and date
inputs come in as `new Date(validated.startDate)`. Server TZ (Vercel = UTC) vs. the
user's TZ can shift days by one, and `@@unique([tripId, date])` makes mismatched
normalization a constraint bomb.
- Standardize: store trip/day dates as UTC date-only (e.g. `new Date(dateStr + "T00:00:00Z")`) in `createTrip`, ODY-002's reconciliation, and schedule actions; render with a TZ-safe formatter in a shared util (`src/lib/utils`).
- Audit all `toLocaleDateString`/`toISOString().split("T")` call sites (WeatherBanner, itinerary/schedule pages, TripCard) for consistency.
- Acceptance: creating a trip Jul 10–12 from any client TZ yields exactly days 10, 11, 12 in the UI and DB.

### ODY-004 · Validate budget & split inputs server-side — S, haiku — ✅ DONE (PR #4)
> **In plain terms:** The budget box accepted nonsense — negative numbers, infinity, gibberish. Now the server sanity-checks every number before saving it.
`updateTripBudget(tripId, totalBudget)` (`src/app/trips/[tripId]/budget/actions.ts:65`)
accepts any number — negative, NaN-coerced, or absurdly large — with no Zod schema,
unlike every other action.
- Add `updateBudgetSchema` in `src/lib/validations/index.ts` (finite, ≥ 0, sane max e.g. 10M) and parse in the action. Clamp split weights (already ≥0 client-side) in `updateSplitSchema` too (max e.g. 100, finite).
- Acceptance: invalid values rejected server-side; UI unchanged.

### ODY-005 · Wrap multi-step mutations in transactions — S, haiku — ✅ DONE (PR #4)
> **In plain terms:** Some saves take several database steps; if one failed halfway, you'd be left with half-saved data. Now those steps succeed or fail together, like a single action.
Several actions do sequential writes that can half-apply on failure:
`deleteEvent` (expense delete + event delete), `createEvent`/`updateEvent` +
`syncLinkedExpense`, `createTrip` (trip + days), `reorderEvents` (`Promise.all` of
updates).
- Use `db.$transaction` for each. `reorderEvents` becomes a single transaction of `updateMany`s.
- Acceptance: behavior identical on success; no partial state on induced failure.

### ODY-006 · Clerk invitation revocation only scans page 1 — S, haiku — ✅ DONE (PR #5)
> **In plain terms:** Re-sending an invite email sometimes silently did nothing when many invites were pending. Now a re-send always actually sends.
`sendTripInvitation` (`src/app/trips/[tripId]/members/actions.ts:49`) calls
`getInvitationList({ status: "pending" })` without pagination, so with >10 (default
page size) pending invites the stale one may not be revoked and no fresh email goes out.
- Filter server-side by email if the SDK supports `emailAddress` query; otherwise paginate until found. Keep best-effort try/catch semantics.
- Acceptance: re-sending an invite always revokes the prior pending invite for that address.

---

## P1 — Refactors & Robustness

### ODY-010 · Proxy Nominatim through an internal API route — M, sonnet — ✅ DONE (PR #10)
> **In plain terms:** Every visitor's browser was hitting a free map-lookup service directly — enough traffic and the whole app gets banned from it. Now lookups go through our own server, which remembers recent answers and stops anyone from hammering it.
Nominatim is hit from the browser (`LocationAutocomplete.tsx`) and the server
(`itinerary/actions.ts geocode()`) with no rate limiting or caching. Nominatim's usage
policy is 1 req/s per app; a few concurrent users can get the app (or users' IPs) blocked.
- Add `src/app/api/geocode/route.ts`: authenticated (Clerk), validates `q`, calls Nominatim with the descriptive User-Agent, caches responses (`unstable_cache` or in-memory LRU keyed on query, TTL ~24h), soft rate-limits per user.
- Point both the autocomplete and server `geocode()` at shared logic (`src/lib/geocode.ts`).
- Acceptance: no direct browser→nominatim requests; repeated identical queries served from cache; behavior of pin resolution unchanged.

### ODY-011 · Migrate inline styles to the design system — L, sonnet (can split per file) — ✅ DONE (PRs #14/15/16/19)
> **In plain terms:** Styling was scattered ad-hoc inside components instead of living in the shared stylesheet, so the design was hard to keep consistent or change. This moved all of it into one system — same pixels, tidier house.
CLAUDE.md forbids inline styles, yet the audit counts 37 `style={{}}` blocks in
`LandingPage.tsx`, 14 in `AvailabilityHeatmap.tsx`, 13 in `AvailabilityGrid.tsx`, 10
each in `MapClient.tsx` and `trips/new/page.tsx`, plus more (~120 total). Meanwhile
`globals.css` has grown to 3,061 lines of bespoke classes.
- Convert inline styles to Tailwind utilities or existing globals.css classes, **pixel-faithful** — this is a mechanical refactor, not a redesign. Dynamic values (progress widths, flexGrow by amount, animation delays) may stay inline via CSS custom properties (`style={{ "--w": pct + "%" }}`) — document that exception in CLAUDE.md.
- Suggested split: (a) LandingPage, (b) Availability grid+heatmap, (c) MapClient + trips/new, (d) remainder.
- Acceptance: visual diff-free (screenshot before/after), zero static `style={{}}` blocks outside the documented dynamic-value exception.

### ODY-012 · Consolidate the styling system & prune globals.css — L, sonnet — ✅ DONE (PR #22)
> **In plain terms:** The app has two competing naming systems for its colors and styles, plus a lot of leftover dead styling. This picks one system, translates the old names onto it, and throws out what nothing uses.
Two parallel systems coexist: the CLAUDE.md `odyssey-*` Tailwind tokens (used in
`WeatherBanner`, older components) and the newer `--paper/--ink/--peri` editorial
system with 3k lines of handwritten component CSS (`.hero`, `.cat-block`, `.canvas`…).
- Decide the newer editorial system is canonical (it is the shipped aesthetic). Map `odyssey-*` tokens onto the same underlying values in the `@theme` block, migrate the few `odyssey-*` consumers, and delete dead CSS (audit selectors against actual usage with grep).
- Update CLAUDE.md's design-token section to match reality so future agents don't reintroduce drift.
- Acceptance: one documented token system; globals.css shrinks meaningfully; no visual changes.

### ODY-013 · Error UX for server actions (Zod throws are invisible) — M, sonnet — ✅ DONE (PR #6)
> **In plain terms:** When a save failed, the app just… did nothing, and you'd assume it worked. Now failures show a small toast message, and broken pages show a friendly branded error instead of a wall of code.
Actions `throw new Error("Unauthorized")` / Zod `.parse()` throws propagate as opaque
Next.js digest errors; clients like `SplitSection.save()` and `saveBudget()` fire and
forget with no failure feedback.
- Adopt a typed result pattern `{ ok: true, data } | { ok: false, error }` for mutating actions (or wrap with a small helper), surface failures with a lightweight toast in the existing visual language (no new toast lib — a small `Toast` in `src/components/shared/` styled with existing tokens).
- Add `error.tsx` boundaries under `src/app/trips/[tripId]/` and `dashboard` with on-brand copy ("The map slipped out of our hands — try again.").
- Acceptance: failed saves show feedback; nothing silently no-ops; route errors render a branded boundary instead of the default.

### ODY-014 · Add route-level loading states — S, haiku — ✅ DONE (PR #6)
> **In plain terms:** Pages went blank for a beat while loading. Now you see calm placeholder shapes immediately, so the app always feels alive.
No `loading.tsx` files exist; heavy pages (itinerary with full trip include, map) show
a blank stall on navigation.
- Add `loading.tsx` skeletons for dashboard and trip tabs using existing paper/rule tokens — calm shimmer, no spinners-in-your-face.
- Acceptance: navigating between tabs shows branded skeletons instantly.

### ODY-015 · Fix the 6 deferred react-hooks lint suppressions — M, sonnet — ✅ DONE (PR #12)
> **In plain terms:** In six places the code told the quality-checker to look away instead of fixing the real problem. This fixed the problems for real, so the checker runs at full strength.
Known deferred work: `DayBlock.tsx:66`, `LeafletMap.tsx:139,164` (+ others per
`npx eslint src --max-warnings=0`). Each `eslint-disable-next-line react-hooks/exhaustive-deps`
hides a potential stale-closure bug; `LeafletMap.tsx` also has a file-wide
`no-explicit-any` disable.
- Fix deps properly (useCallback/refs), type the Leaflet interop instead of `any` (types are already installed via `@types/leaflet`).
- Acceptance: `npm run lint` clean with the suppressions removed; map + itinerary drag/expand behavior verified unchanged.

### ODY-016 · Test foundation + CI — L, sonnet — ✅ DONE (PR #13)
> **In plain terms:** There were no automated tests — every change was verified by hand and hope. This added a test suite plus a robot (CI) that re-runs every check on every single change before it can be merged.
Zero tests, no CI. The riskiest logic is pure and cheap to test: split-balance math
(`SplitSection`), `syncLinkedExpense`, day-range generation, validation schemas,
`getConditionFromCode`.
- Add Vitest (unit only, no E2E yet), extract split math into `src/lib/budget.ts` so it's testable, cover the listed units. GitHub Actions workflow: install → prisma generate → lint → typecheck (`tsc --noEmit`) → test → build.
- Acceptance: `npm test` green locally and in CI on PRs.

### ODY-043 · Event form gives no feedback on invalid/failed submit — S, haiku
> **In plain terms:** If you try to add an event without a title, nothing happens and there's no explanation. This shows a clear reason, and warns you when a save actually fails.
`handleSave` in `src/components/itinerary/AddEventModal.tsx` early-returns on
`!form.title.trim()` with zero feedback (the submit button is merely disabled), and
the `createEvent`/`updateEvent` awaits aren't wrapped — a server throw closes the
modal as if it succeeded.
- Use the existing toast + error infrastructure (ODY-013) — **no new toast library**. Import `toast` from `src/components/shared/Toast`.
- Add field-level error state on Title (invalid on attempted submit, clears on input) using `--coral` tokens; optionally toast on blocked submit. On-brand copy ("Give this event a title first.").
- Wrap the create/update await in try/catch and toast a branded failure message so a failed save never looks like a success.
- Guardrails: no inline styles except dynamic CSS custom properties; editorial voice.
- Acceptance: submitting without a title shows a visible on-brand error; server failures show a toast instead of silently closing the modal.

### ODY-044 · Collect name on email sign-up (defaults to "Traveler") — S, sonnet — relates to ODY-036
> **In plain terms:** People who sign up with email instead of Google are never asked their name, so the whole app calls them "Traveler." This captures a real name.
Email/password sign-ups don't collect a name, so `src/lib/auth.ts:19` falls back to
"Traveler" everywhere (dashboard, members, budget, itinerary).
- Primary fix is Clerk config: enable Name (first/last) as required fields on the sign-up form for the instance in use — document this dashboard step in the ticket.
- Verify the `<SignUp>` component in `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` renders name fields once configured. If Clerk config can't be relied on, add a lightweight post-signup "What should we call you?" step that updates the Clerk user and resyncs via `getOrCreateDbUser`.
- Ensure `getOrCreateDbUser` (`src/lib/auth.ts`) picks up the provided name on first sync (it already reads firstName/lastName). Keep dev-instance behavior working (overlaps ODY-036).
- Acceptance: a new email/password signup shows their real name (not "Traveler") on the dashboard and members list after first login.

### ODY-046 · Full user-journey QA audit — new & returning users — M, sonnet
> **In plain terms:** Walk through the whole app as a brand-new person and as a returning user, writing down everything that's broken, confusing, or silently fails.
Audit-only deliverable (a prioritized markdown findings report + candidate tickets),
**not** code changes. Two personas: (A) brand-new no-account user, (B) returning user
with existing trips.
- Trace both: landing → sign-up/sign-in (email AND Google) → dashboard (empty state for new) → NewTripWizard (all 3 steps, vibes, cover mood, invites) → itinerary → add/edit/delete events, day notes, budget + splits, schedule/availability, map, members/invites.
- Returning user: re-auth, existing trips load, viewer/editor role behavior (ODY-001), invite flow (note ODY-037 is a placeholder).
- Per screen check: broken/empty states, silent failures (ODY-043), mobile at 375px (ODY-038/021), auth redirects (dev Clerk instance — preview pane can't complete the accounts.dev handshake, use a real browser for authed flows).
- Deliverable: prioritized P0–P3 list with repro steps + suspected files; cross-reference existing tickets to avoid duplicates.
- Acceptance: a findings report exists; each concrete defect is filed as a candidate ticket with a file path and repro.

---

## P2 — Quality of Life

### ODY-038 · Mobile UX for adding events and cross-tab navigation — L, sonnet — ✅ DONE (PR #23)
> **In plain terms:** Using the app on a phone is clunky — forms are cramped and switching tabs takes too much scrolling. This makes phone use feel as natural as desktop.
On mobile (< 768px), adding itinerary items is cumbersome (modals/forms not touch-optimized),
and navigating between trip tabs (itinerary, budget, schedule, map, members) requires
scrolling back to the sidebar or menu. Forms are cramped; workflows interrupt focus.
- **Event add/edit:** bottom sheet modal instead of centered modal on mobile (easier thumb reach, full-height input); larger touch targets, clearer submit buttons.
- **Navigation:** add a mobile-optimized bottom tab bar or persistent top navigation on mobile showing current section + quick jump to other tabs; keep sidebar hidden/collapsed by default on < 768px.
- **Forms:** stacked layout on mobile (full-width inputs), adjust modal widths/padding for 375px viewport.
- Acceptance: adding an event on mobile is as easy as desktop (no hand strain, no excessive scrolling); switching between tabs feels native and intuitive.

### ODY-042 · Auto-sort itinerary events by start time — M, sonnet
> **In plain terms:** Events should line up in time order on their own instead of making you drag every one into place.
Events currently render only by `orderIndex` (manual dnd-kit order via
`reorderEvents`). Add time-aware ordering without breaking drag-to-reorder.
- Add a per-day sort mode: "By time" (default) vs "Manual" — a small toggle in the day header (`src/components/itinerary/DayBlock.tsx`). Persist per-trip only if trivial (Trip field via `prisma db push`, no migrations dir); otherwise per-card local state defaulting to "By time".
- "By time": sort by `startTime` ("HH:MM" ascending); events with no start time sort last, keeping their `orderIndex` among themselves. Disable the drag handle in this mode. "Manual": current dnd-kit behavior untouched.
- Put the sort in a pure helper in `src/lib` (e.g. `sortEventsByTime`) and unit-test it (Vitest, matching `src/lib/__tests__` patterns): empty-times-last, stable tie-break, 12h/24h-agnostic.
- Guardrails: no new deps, no inline styles, editorial aesthetic intact.
- Acceptance: events with start times appear chronologically by default; drag reorder still works in Manual mode; helper is unit-tested.

### ODY-047 · Cover "skin" doesn't carry to the itinerary page — S, sonnet
> **In plain terms:** The cover look you pick when creating a trip shows on the dashboard card but the itinerary page ignores it and always goes purple. This makes the itinerary match your pick.
`coverIndex` is stored as `"grad:<index>"` in `Trip.coverImageUrl` (`createTripWizard`
in `src/app/trips/actions.ts`) and resolved via `resolveCover`
(`src/components/trips/cover.ts`), but only `DashboardClient`/`TripCard` consume it —
`ItineraryHero` never reads the cover, so it falls back to the default `.hero` styling.
- Pass `coverImageUrl` (+ trip id as seed) into `src/components/itinerary/ItineraryHero.tsx` from `src/app/trips/[tripId]/itinerary/page.tsx`; call `resolveCover(coverImageUrl, tripId)` and apply it via the existing `cover-art` pattern (`style={{ "--cover-img": ... }}` consumed by a globals.css class — the sanctioned dynamic-value exception). Reuse `COVER_ACCENT` like the wizard preview.
- If `TripEditModal` (`src/components/trips/TripEditModal.tsx`) can't already change the cover mood, add the same `COVER_GRADIENTS` picker used in `NewTripWizard` and persist via the update action.
- Guardrails: no hardcoded hex outside globals.css; keep text contrast readable over the gradient.
- Acceptance: the cover mood chosen at creation (and edited later) appears on the itinerary page, matching the dashboard card — no purple default.

### ODY-020 · Landing page honesty pass — S, haiku
> **In plain terms:** The landing page currently invents things — fake user counts, a fake testimonial, fake pricing. This replaces them with honest copy in the same voice.
The landing claims "Loved by 4,200 travelers", a five-star row, a named testimonial
("Maya R.") and "Free for solo trips" pricing — all fabricated. Footer Privacy/Terms/
Support links are `href="#"`.
- Replace social proof with true brand statements in the same editorial voice (e.g. "Built for the long way around" motifs); remove fake rating/testimonial or clearly reframe as illustrative; drop pricing implication; footer links either go to real stub pages or are removed.
- Keep layout rhythm and type scale identical — copy swap, not redesign.
- Acceptance: no invented metrics/testimonials/pricing anywhere public.

### ODY-021 · Mobile responsiveness sweep — L, sonnet — ✅ DONE (PR #23)
> **In plain terms:** Beyond the big items in ODY-038, lots of screens simply don't fit a phone. This is the sweep that makes every page work at phone width.
Fixed paddings (`48px` gutters on landing), the workspace sidebar, availability grid,
and budget split rows were designed desktop-first. Audit at 375px/768px.
- Landing: collapse nav, scale hero type (already `clamp`), tighten gutters. Trip workspace: sidebar → collapsible sheet (a `sheet.tsx` primitive already exists in `src/components/ui/`). Tables/grids scroll within their container.
- Acceptance: no horizontal page scroll at 375px on landing, dashboard, itinerary, budget, schedule; touch targets ≥ 40px.

### ODY-022 · Accessibility pass — M, sonnet
> **In plain terms:** People using a keyboard or a screen reader currently can't operate parts of the app. This makes it work for them — and it's also just better engineering.
Findings: `cat-head` collapse toggles are `<header onClick>` (no keyboard/role),
emoji icons unlabeled in places, autocomplete listbox lacks `aria-activedescendant`/
input `role="combobox"`, color-only category coding in the budget bar.
- Convert clickable non-buttons to `<button>` with `aria-expanded`; complete combobox ARIA in `LocationAutocomplete`; add text/pattern reinforcement where color is the only signal; run an axe pass on main routes.
- Acceptance: keyboard-only operation of itinerary collapse, budget categories, autocomplete; no serious axe violations on the 5 main routes.

### ODY-023 · Weather banner beyond 3 days / graceful absence — S, haiku
> **In plain terms:** The weather banner silently vanishes for past trips or trips far in the future. This makes it always show something sensible.
`fetchWeather` (`src/components/shared/WeatherBanner.tsx:63`) requests `startDate`
→ +2 days from the *forecast* API: past trips and trips >16 days out silently render
nothing, and mid-trip it still shows the start date's weather.
- Clamp the request window to [today, today+15] ∩ trip range; if trip is outside the forecast horizon, show a quiet seasonal placeholder line instead of vanishing ("Forecast opens closer to departure"). °F stays default; optional: unit by locale.
- Acceptance: banner renders something sensible for past, current, near-future, and far-future trips.

### ODY-024 · Money formatting & currency field — M, sonnet
> **In plain terms:** Enter $12.50 and the app shows $13 — cents are hidden and rounding drifts. This shows exact amounts and lets a trip choose its currency symbol.
Amounts are `Float` in Prisma and `fmtMoney` rounds to whole dollars — cents are
entered but silently hidden, and floats accumulate drift.
- Display cents when present (`Intl.NumberFormat`), keep JetBrains Mono for figures. Schema: add `currency String @default("USD")` on Trip (db push per Supabase workflow — no migrations dir); format with the trip currency across budget/itinerary. (Full multi-currency conversion is out of scope.)
- Acceptance: $1,234.56 round-trips intact everywhere; trips can set a currency symbol that all money UI respects.

### ODY-025 · Optimistic UI for reorder & quick edits — M, sonnet
> **In plain terms:** Dragging events feels laggy because the app waits for the server before settling. This makes it feel instant, quietly undoing only if the server disagrees.
Drag-reorder waits on the server round-trip (`reorderEvents`) before settling; day
notes and budget edits similarly lag.
- Use `useOptimistic`/local state reconciliation for event reorder and day-note saves; revert with a toast (ODY-013) on failure.
- Acceptance: drag drops feel instant; server disagreement reverts visibly.

### ODY-026 · SEO & metadata polish — S, haiku
> **In plain terms:** Shared links show a generic preview and every browser tab says the same thing. This adds real page titles and a branded link-preview card.
Only default metadata; no OG image, no per-route titles.
- `metadata` exports: landing (brand tagline), dashboard/trip routes (`"Trip title — Odyssey"` via `generateMetadata`), OG image in brand palette (static PNG is fine), proper favicon set from the brand mark.
- Acceptance: link unfurls show brand card; tab titles are contextual.

### ODY-039 · Event notes as bullet points — S, haiku — ✅ DONE (PR #17)
> **In plain terms:** Notes typed on multiple lines displayed as one unreadable run-on line. Now dashes become real bullet points and line breaks are respected.
Event notes render as one flat span (`src/components/itinerary/EventBlock.tsx`,
`.event-notes`), so multi-item notes ("bring passport, check in online, gate
closes 30 min early") read as an unscannable run-on line; newlines typed in the
notes textarea (`AddEventModal`) are collapsed on display.
- Display-only transform (storage stays the plain string, no schema change, no new editor): split notes on newlines; lines starting with `-` or `*` render as a real `<ul>` bullet list, plain lines as separate paragraphs.
- Optional nicety: small prose ⇄ bullets toggle on the event card; default to auto-detect.
- Keep XSS discipline: render text nodes only — no HTML parsing of note content.
- Acceptance: a note typed with newlines/dashes shows as readable bullets on the itinerary card; single-line notes look unchanged; day notes and trip notes unaffected.


### ODY-040 · Collapsible event notes — S, haiku — ✅ DONE (PR #20)
> **In plain terms:** Bullet notes read great (ODY-039), but a day full of long notes makes the itinerary a wall of text. Long notes now start folded to their first line with a "Show note" link, so the page stays scannable.
Follow-up to ODY-039. Any note with multiple lines (or a single line over ~140
characters) collapses to a one-line preview with a small periwinkle toggle
("Show note · 4 lines" / "Show less"). Short notes render exactly as before.
- Display-only; per-card local state, no schema change, no persistence.
- Acceptance: long notes collapsed by default; toggle expands/collapses; short notes unaffected.

### ODY-041 · 12-hour / 24-hour time display toggle — S, haiku — ✅ DONE (PR #21)
> **In plain terms:** Event times currently show only in military time (14:30). This adds a setting so a trip can show friendly 2:30 PM times instead — whichever the crew prefers.
Event `startTime`/`endTime` come from `<input type="time">` as "HH:MM" strings and
are displayed raw, so everything reads as military time.
- Storage stays "HH:MM" (unchanged). Add a `timeFormat` preference — simplest: `String @default("12h")` on Trip (db push per Supabase workflow), toggled from the trip edit modal; no localStorage (forbidden by CLAUDE.md).
- Add `formatTime(hhmm, format)` in `src/lib/utils.ts` (unit-test it) and use it everywhere times render: `EventBlock`, map selected-event card, print view when it exists.
- Time *inputs* may stay native (`<input type="time">` renders per browser locale) — this ticket is about display.
- Acceptance: toggling the trip preference flips every displayed time between 2:30 PM and 14:30; stored values unchanged; new util unit-tested.

---

## P3 — New Features

### ODY-045 · Place Collections shown on the map by category — L, sonnet
> **In plain terms:** A place to save candidate spots — restaurants, attractions, maybes — that aren't on the day-by-day plan yet, labeled and shown on the map by label. Good while the itinerary is still a work in progress.
A "possibilities" bucket separate from the itinerary, filterable on the Leaflet map by
category label.
- New Prisma model (e.g. `Collection`/`Place`: tripId, category/label, title, location, lat, lng, notes, createdBy) via `prisma db push` (no migrations dir; free-tier auto-pauses — see Supabase workflow). Access only via `src/lib/prisma/db.ts`.
- Server actions in a new route `actions.ts` (follow `app/trips/[tripId]/.../actions.ts` convention), Zod-validated (`src/lib/validations`), `assertTripRole` checks (editor+ to write). Geocode via `src/lib/geocode.ts` + `/api/geocode` — **never** hit Nominatim directly (ODY-010).
- Map: extend `src/components/map/MapClient.tsx` + `mapTypes.ts` to render collection pins distinctly from itinerary events, with a category filter/legend. Reuse `TYPE_HEX`/`TYPE_VAR` color language and globals.css tokens; no hardcoded hex outside globals.css.
- UI: a "Collections" surface (tab or section) to add/label/remove places. "Promote to itinerary" is a nice-to-have — note as follow-up.
- Guardrails: editorial aesthetic; no new deps; Leaflet stays dynamic import `ssr:false`.
- Acceptance: a user can save labeled places outside the itinerary and toggle them on the map by category.

### ODY-030 · Settle-up suggestions — M, sonnet
> **In plain terms:** The budget shows who's over or under, but not what to do about it. This adds concrete suggestions: "Alex pays Maya $120" — the fewest transfers that settle everyone up.
The split card shows who's over/under but not how to settle. Compute the minimal
transfer set ("Alex pays Maya $120") from existing balances in `SplitSection` — pure
client math, no schema change. Present as a quiet list under the balances, mono
figures, teal accent for "settled".

### ODY-031 · Trip cover images via Supabase Storage — L, sonnet
> **In plain terms:** Trips currently get pretty gradient covers, but you can't use your own photo. This adds photo upload, keeping the gradients as the default.
`Trip.coverImageUrl` exists and `cover.ts` generates gradient covers, but users can't
upload a photo. Add upload to a `trip-covers` bucket (Supabase client already
configured; service role stays server-side), size/type validation via Zod + server
action, fallback to the current gradients (they're on-brand — keep them as the
default state, photo optional). Respect existing RLS posture from the security memo.

### ODY-032 · Print / share itinerary view — M, sonnet
> **In plain terms:** A printable, paper-style version of the itinerary — the "printed map" moment the brand is named for.
On-brand "printed map" moment: a `/trips/[tripId]/print` server-rendered route with a
paper-first, ink-on-cream stylesheet (print CSS), day-by-day list + budget summary.
No auth changes — members only.

### ODY-033 · Duplicate trip / copy day — M, sonnet
> **In plain terms:** Loved a trip? Duplicate the whole thing with new dates, or copy one great day onto another.
"Weekends that turn into something more": duplicate a whole trip (new dates offset)
or copy a day's events to another day. Server actions with membership checks +
transactions; UI entry points in trip card menu and day header menu.

### ODY-034 · Schedule Phase 2 — availability polish — L, sonnet
> **In plain terms:** Round two of the scheduling tab: smarter "best window" suggestions, one-click apply to trip dates, and a nudge for people who haven't answered.
Phase 1 shipped (poll setup, grid, heatmap). Deferred: Google Calendar sync
(explicitly postponed — do not build without go-ahead), but near-term wins: "best
window" recommendation banner from heatmap data, close-poll → prefill trip dates
flow, and email nudge to members who haven't responded (via existing Clerk email
path only if trivial; otherwise in-app badge).

### ODY-035 · Activity feed / "what changed" — L, sonnet
> **In plain terms:** When several people plan together, you want to know what changed while you were away. This adds a quiet timeline: "Maya added Sunset kayak to Day 3."
Collaborative trips need ambient awareness. Lightweight `Activity` model (tripId,
userId, verb, subject, createdAt — db push), written from existing actions (one line
each), rendered as a quiet timeline on the trip overview page. Cap at last 50, prune
older. Editorial tone: "Maya added *Sunset kayak* to Day 3."

---

## Deferred / external (tracked, not ticketed)
- Supabase advisor: 2 warnings on `rls_auto_enable()` (accepted risk — Prisma bypasses RLS by design; see security memo).
- Clerk production instance + `pk_live` keys before real-domain launch (see deploy notes).
- Google Calendar sync for Schedule tab — explicitly deferred by product decision.

## Suggested session order
All P0/P1 engineering tickets are ✅ done (see markers above) except the two that
need human hands: ODY-036 (production login setup) and its dependent ODY-037.
1. ODY-036 (manual: Clerk dashboard + Google Cloud) → unblocks ODY-037
2. ODY-012 (prune the stylesheet — safe now that tests + CI exist)
3. P2 by user impact: ODY-041 (time format) · ODY-023 (weather) · ODY-020 (honest landing) · ODY-024 (money) · ODY-038/021 (mobile pair)
4. P3 by taste — ODY-030 (settle-up) is the highest-delight/lowest-effort.
