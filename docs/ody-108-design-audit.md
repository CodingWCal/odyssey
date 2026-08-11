# ODY-108 · Full UI/UX design audit — every screen, desktop + mobile

> Audit date: 2026-08-09
> Method: code + `globals.css` walkthrough of every surface listed in the
> ticket, cross-referenced against `CLAUDE.md`'s token system, the README
> creative-direction line, and the existing `--ink`/`--paper`/type-color
> palette. **Not a live browser pass** — this session's cloud container has
> no `DATABASE_URL` or Clerk credentials (confirmed: no `.env*` files
> present), so authenticated pages can't be rendered or screenshotted here.
> Findings below are verified against source (component + CSS), not
> observed pixels — each has a file:line and, where possible, an exact
> repro condition rather than a subjective "looks off." Same adaptation
> `ODY-046` used for the same constraint.
> Cross-checked against `BACKLOG.md` so nothing here duplicates an open ticket.

**Headline verdict:** the brand holds up well. Copy is specific and editorial
almost everywhere (`"A soft ceiling — not a hard limit"`, `"Notes that
breathe"` — this is not filler microcopy), the type system is used with
intent, and color stays inside its documented semantic roles everywhere
checked except one small spot. The real findings cluster in three places:
**one integrity problem on the landing page**, **a touch-target regression
pattern** (one class fixed, its siblings weren't), and **token drift**
(literal values reappearing next to the tokens meant to replace them).

---

## P0 — Trust / integrity

### ODY-108-F01 · Landing page fabricates social proof directly under a "beta" badge
- **File:** `src/components/landing/LandingPage.tsx:29-31, 54-58, 87-91`
- **What:** The hero badge reads *"Now in beta · trips of every shape"* — then eleven lines later, `.ld-social` claims **"★★★★★ · Loved by 4,200 travelers"**, and a `.ld-quote` section attributes an invented testimonial to **"Maya R., on her first Odyssey trip."** For a real product this is standard SaaS boilerplate; for a beta app with (as far as the codebase shows) no review system, no NPS pipeline, and no `Testimonial` model, these are fabricated numbers and a fabricated person, positioned as fact one screen after the app tells the visitor it's still in beta. This is the single most "generic-AI-app" thing on the entire site — worse than a design smell, since it's a truth claim a real visitor (a friend Calvin invites, say) would read as genuine.
- **Not fixed in this PR** — this is a content/product decision (remove entirely vs. replace with a real quote vs. wait for real numbers), not a safe mechanical fix, and the ticket's guardrail is audit-only for anything that isn't obviously safe.
- **Recommendation:** pull both until there's a real number and a real quote to put there. A calm, honest beta page ("built by two people, in beta, here's exactly what it does" — which the rest of the hero already says well) is more on-brand than invented social proof, and matches the "editorial, not sales-y" direction better than keeping it.

---

## P1 — Touch targets (ODY-021/107's own 40px standard, not met everywhere)

`ODY-021` set the acceptance bar — **"touch targets ≥ 40px"** — and a later
commit (`bd32e70`, "bump `.btn.sm` to a 40px touch target") already fixed one
class against it. The other classes doing the same job never got the same
pass:

### ODY-108-F02 · Every modal close button app-wide is 28px
- **File:** `src/app/globals.css:873-880` (`.icon-btn`, `width: 28px; height: 28px`)
- **Used by:** every modal's × — `ExpenseModal.tsx:243`, `AddEventModal.tsx:121`, `TripEditModal.tsx:81`, `NewTripWizard.tsx:145`, `MapClient.tsx:245,284` (selected-event card), `AvailabilityHeatmap.tsx:214` (apply-window confirm), `DashboardClient.tsx:124` (mobile search) — 8+ sites, all sharing one undersized class.
- **Also used for frequent primary actions, not just secondary chrome:** `EventBlock.tsx:134` ("Edit event" on every itinerary card) and `BudgetClient.tsx:143` ("Edit" on every expense row) — both tapped constantly on mobile, not occasional.
- **Fix shipped in this PR:** bumped `.icon-btn` to 40×40px, matching `.btn.sm`'s precedent exactly. Pure CSS, no new tokens, no layout risk — the same class of fix already accepted for `.btn.sm`.
- **`.icon-btn.sm` (22px, `globals.css:3259`) left alone deliberately** — it's used for tertiary row actions (undo a settlement, remove a member) that sit inside already-generous list-item tap areas, not for standalone controls. Flagged for a human look rather than auto-bumped, since 22→40 in a dense row could visually break layouts this audit can't see rendered.

### ODY-108-F03 · Split-mode / category / participant chips (`.opt-chip`) are ~30px tall
- **File:** `src/app/globals.css:3277-3281` (`padding: 8px 14px`, no explicit height — renders roughly 30px with a 13px line-height)
- **Used by:** category picker and split-mode chips in `ExpenseModal.tsx` (Equal / Adjust / Exact, participant toggles), `PollSetupForm.tsx` block toggles, `TripEditModal.tsx` time-format toggle. All are primary choices made by tapping, not incidental controls — and three of them (the split-mode chips) were added or touched this very session (ODY-114).
- **Fix shipped in this PR:** added `min-height: 40px` to `.opt-chip`. Doesn't touch padding/font, so visual density is unchanged — just guarantees the tap target under it.

---

## P2 — Token drift (the design-token system exists; a few surfaces don't use it)

### ODY-108-F04 · `border-radius` mostly uses tokens, but 8 literal-px values live alongside them
- **File:** `src/app/globals.css` (scattered)
- **What:** `--radius-sm/md/lg/xl` = `8/12/18/22px` is documented and used in most places, but a grep turns up `6px`, `4px`, `11px`, `7px`, `3px`, `2px`, `20px` as literal values across ~15 rules that could reference the existing scale (or, if a fifth size is genuinely needed, should extend the token list instead of writing a new number). Not fixed here — bundling 15 scattered one-line edits into an "audit" PR risks exactly the "redesign-by-stealth" the ticket says not to do; filing as its own small ticket keeps the diff reviewable.
- **Filed as:** **ODY-117** (below).

### ODY-108-F05 · `globals.css` z-index: 9 distinct values, no documented order
- **Confirmed exactly as the 2026-08-08 seed described:** `-1, 5, 50, 60, 500, 999, 1000, 1200, 1400` across the 3,396-line file (grew from 3,327 since that note), assigned per-feature over many sessions with no stacking-order comment or shared token. Currently works by accident of nobody's ranges overlapping yet; the next sheet/modal/toast will have to guess a number that doesn't collide.
- **Filed as:** **ODY-117** (same ticket as F04 — both are "introduce the missing token/scale," best done together).

### ODY-108-F06 · One hardcoded hex outside the documented Leaflet exception
- **File:** `src/components/trips/AvailabilityHeatmap.tsx:95` — `"--cell-fg": ratio > 0.5 ? "#fff" : "var(--ink)"`
- **What:** `CLAUDE.md`'s "Do Not" list bars hardcoded hex outside `globals.css`, with a documented exception for `TYPE_HEX` in `mapTypes.ts` (Leaflet can't consume CSS custom properties). This isn't Leaflet — it's a plain React inline style deciding cell text color by contrast, so it has no reason to bypass the token system. `--paper` (or a new `--paper-contrast` if none of the existing paper tokens read correctly on a saturated heat cell) covers it.
- **Not fixed here** — folded into **ODY-117** since it's a one-line sibling of the same "finish the token migration" work, not because it's risky.
- **Also checked and cleared:** `NewTripWizard.tsx` destination-dot colors and `cover.ts`'s gradient array both use literal hex, but both are content/config data (a curated list of cover-art gradients and per-destination accent dots), not component styling — closer to `TYPE_HEX`'s documented exception than a violation. Not flagged.

---

## P2 — Landing page generic-card-grid smell

### ODY-108-F07 · All six feature cards share one repeated icon (a bare circle, recolored) — ✅ FIXED (2026-08-09)
> Resolved: each card now uses its matching purpose-built icon (`Icons.itinerary/map/budget/members/note`), and a new line-style `Icons.weather` sun was added for the sixth so it stays SVG rather than reaching for an emoji (which would have broken the app's no-emoji-iconography record this audit confirmed). Kept the per-card `--f-color` accent. No new dependencies.

- **File:** `src/components/landing/LandingPage.tsx:65-82`
- **What:** Six feature cards — itinerary, map, budget, members, notes, weather — each render the exact same `<circle cx="12" cy="12" r="10" />` SVG, distinguished only by `--f-color`. This is the textbook "does it look AI-generated" smell the ticket names directly: identical shapes standing in for six conceptually different features, when the app already has six distinct, purpose-built icons for exactly this taxonomy (`Icons.itinerary`, `Icons.map`, `Icons.budget`, `Icons.members`, `Icons.note`, and the weather glyph already used in `ItineraryHero`).
- **Not fixed here** — swapping icons is a one-line-per-card change, genuinely safe, but it's a visible content/design decision on the highest-traffic marketing surface in the app; flagging with the exact fix rather than silently changing what a visitor sees felt like the more honest call for an audit PR.
- **Recommendation:** `<Icons.itinerary size={18} />` etc. in place of the shared circle — zero new dependencies, reuses icons that already exist.

### ODY-108-F08 · Footer links are dead (`href="#"` ×3)
- **File:** `src/components/landing/LandingPage.tsx:114-118`
- **What:** Privacy / Terms / Support all point nowhere. Minor, but it's the kind of unfinished-boilerplate tell that undercuts an otherwise deliberate, calm page. Not fixed here (no real destinations exist yet to link to) — noting so it isn't lost.

---

## P3 — Everything checked and cleared

Explicitly verified clean, so these don't need re-discovering later:

- **No emoji-as-iconography anywhere** in `src/components` or `src/app` — a full-codebase scan for emoji characters returned zero matches. The app uses purpose-built SVG icons throughout (`Icons.tsx`), consistent with the "boarding pass + printed map" direction rather than the generic-app default.
- **No stray `alert()`/`confirm()`** beyond the two already-known `window.confirm()` sites (`LeaveTripButton.tsx:14`, `MemberActions.tsx:31` — tracked in **ODY-108**'s own seed list, not re-filed).
- **Copy quality is high, not generic filler**, everywhere sampled: landing hero, feature card bodies, empty states, toast messages. Specific, editorial voice ("A soft ceiling — not a hard limit," "A quiet reminder to pack the lighter jacket") — this is the opposite of the generic-SaaS smell the ticket asks to test for, apart from the two landing-page trust issues above.
- **Money formatting**, called out as a known seed in the original ticket text (`fmtMoney` hardcoded to USD) — **already resolved by ODY-024/111/114/115/116**, shipped earlier this session. No longer a finding; removed from the open list.
- **Schedule tab's raw-Tailwind-vs-`.av-*`-classes inconsistency**, the other known seed — **already resolved by ODY-109** (shipped 2026-08-08, confirmed in `AvailabilityGrid.tsx`/`AvailabilityHeatmap.tsx` — both now use the `.av-*` class system exclusively).
- **`--peri/--teal/--coral/--peach/--gold/--slate` semantic roles** — spot-checked `EventBlock.tsx`'s `TYPE_VAR`, `mapTypes.ts`'s `TYPE_HEX`, and budget's category coloring against `CLAUDE.md`'s Event Type Colors table; all three stay inside their documented role with no cross-use found (e.g. nothing paints an alert in `--teal` or a success state in `--coral`).

---

## Fixes shipped in this PR (small, mechanical, same pattern as an already-accepted fix)

Per the ticket's own allowance — *"Small, obviously-safe fixes may ship in
the same PR; anything structural becomes its own ticket"* — two CSS-only,
token-respecting, no-new-dependency touch-target fixes shipped alongside
this report:

1. `.icon-btn` (F02): `28px → 40px`, mirroring the exact fix already applied to `.btn.sm`.
2. `.opt-chip` (F03): added `min-height: 40px`.

Both are pure sizing, no color/spacing/copy changes, and both close a gap
against a standard (ODY-021's "touch targets ≥ 40px") the app already
committed to and partially shipped.

## Child tickets filed

- **ODY-117** — `border-radius` token drift (F04) + z-index scale (F05) + the one hex leak (F06). Grouped because all three are "finish migrating this surface onto the token system that already exists," not new design decisions — genuinely mechanical, but large enough (15+ scattered edits) to deserve its own reviewable diff rather than riding along with an audit.

## Explicitly not filed as tickets (flagged here, decision left to a human)

- **F01** (fabricated landing-page social proof) — a content call, not an engineering one; needs a decision (remove / replace / wait for real data), not a PR.
- **F07** (repeated landing icon) — safe to fix, but changes what visitors see on the highest-traffic page; flagged with the exact fix rather than auto-applied.
- **F08** (dead footer links) — no real destinations exist yet; nothing to link to until Privacy/Terms/Support pages are written.

---

## Cross-references (nothing here duplicates an existing ticket)

- ODY-020/022/023/026 — not yet reviewed in this pass (out of the section this audit prioritized); still open, no findings here supersede them.
- ODY-024/111/114/115/116 — money formatting, already resolved (see P3 above).
- ODY-096/097 — mobile commute overflow / budget UX refinement — untouched by this audit; still valid, separate surfaces.
- ODY-064 — dead-code/utils dedupe — separate from, but adjacent to, F04-F06's token cleanup; not merged into ODY-117 since ODY-064's scope (unused `TripForm`, `@/lib/utils` vs `@/lib/utils/index`) is unrelated code hygiene, not design tokens.
