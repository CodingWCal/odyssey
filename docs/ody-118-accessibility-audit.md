# ODY-118 · Accessibility audit — full static sweep (2026-08-19)

Scope: a code-level accessibility pass over all 88 `.tsx` components and routes,
plus `globals.css`. This is the **static half** — semantics, ARIA, labels, focus
management, keyboard operability, color-only signals, and reduced-motion. The
**dynamic half** (an automated axe pass + real contrast measurement on rendered
pages, and screen-reader spot-checks) still needs a browser and is called out
where a finding can only be *confirmed* against a render.

Findings are ranked P0 (blocks a user) → P3 (polish). Each lists the file, the
problem, and the proposed fix. Nothing here is fixed yet — this is the audit.

Baseline is already good: `<html lang="en">`, `<nav aria-label>` + `aria-current`
on both the desktop sidebar (`<aside>`) and the mobile tab bar, a real `sr-only`
utility, combobox ARIA on `LocationAutocomplete` (ODY-022), keyboard-operable
disclosure headers on the day/budget-category blocks (ODY-022), `role="status"`
live region on the toast stack, and `role="alert"` on route error boundaries.
No `<img>` without `alt` (the app uses CSS gradients/SVG, not raster images).

---

## P0 — blocks a keyboard or screen-reader user

### F1 · Modal has no focus management (`src/components/shared/Modal.tsx`)
The desktop dialog renders `role="dialog" aria-modal="true"` and traps Escape +
locks body scroll, but it never (a) moves focus into the dialog on open,
(b) traps Tab within it, or (c) returns focus to the trigger on close. A
keyboard user opening any modal (Add/Edit event, Trip edit, Duplicate trip, Copy
day, Expense, Apply-window confirm) stays focused behind the overlay and can Tab
into the page underneath. WCAG 2.4.3 (Focus Order) / 2.4.7.
- **Fix:** on open, focus the first focusable element (or the dialog container
  with `tabIndex={-1}`); on close, restore focus to the previously-focused
  element; add a Tab/Shift-Tab wrap within the dialog. This is one change in the
  shared `Modal`, so it fixes every modal at once. (The mobile path renders the
  shadcn `Sheet`, which already manages focus — desktop is the gap.)

---

## P1 — serious, affects a common flow

### F2 · Several focusable controls remove the outline with no visible replacement (`globals.css`)
`outline: none` appears on editable/focusable controls that only change
*background* on focus (or nothing): the inline editable event title
(`globals.css:847`, `.event-title[contenteditable]:focus` → soft fill only),
and the bare-reset controls at lines 506, 573, 585, 629, 655, 2253, 3470.
Background-only focus is easy to miss and can fall under the 3:1 non-text
contrast bar. WCAG 2.4.7 (Focus Visible). *(Contrast of the soft fill needs a
render to measure — flag, then verify.)*
- **Fix:** give each a `:focus-visible` ring using the existing pattern
  (`outline: 2px solid var(--peri); outline-offset: 2px;`, already used on
  `.day-head`/`.cat-head`). Keep `outline: none` only where a clear alternate
  indicator exists (e.g. `.input:focus` at 1061 adds a box-shadow ring — that
  one is fine).

### F3 · Trip-card actions menu isn't keyboard-operable (`src/components/trips/TripCard.tsx`)
The "⋯" menu sets `aria-haspopup`/`aria-expanded` and uses `role="menu"` /
`role="menuitem"`, but: it doesn't close on Escape, doesn't move focus into the
panel, has no arrow-key roving focus, and the outside-click catcher is a
`<div onClick>` with no keyboard path. A keyboard user can open it but not
navigate or dismiss it cleanly. (Same shape would apply to any future custom
menu.) WCAG 2.1.1.
- **Fix:** either adopt the existing base-ui `DropdownMenu` primitive
  (`src/components/ui/dropdown-menu.tsx`) which handles this, or add: Escape to
  close + return focus to the trigger, focus first item on open, Up/Down to move
  between items. Prefer the primitive to avoid re-implementing a menu widget.

---

## P2 — should fix, narrower impact

### F4 · Incomplete `prefers-reduced-motion` coverage (`globals.css` + `Globe3D.tsx`)
`globals.css` has 22 animation/transition declarations but only 3
`prefers-reduced-motion` guards. Unguarded perpetual motion includes the landing
badge pulse (`@keyframes ld-pulse`, infinite) and the hero globe's JS
auto-spin (`Globe3D.tsx`, `requestAnimationFrame` loop). WCAG 2.3.3 (Animation
from Interactions) / vestibular-safety.
- **Fix:** add a global `@media (prefers-reduced-motion: reduce)` block that
  neutralizes infinite/decorative animations (the boarding-pass stamp is already
  guarded — extend the same treatment to `ld-pulse`). In `Globe3D`, check
  `matchMedia("(prefers-reduced-motion: reduce)")` and hold the globe still
  (render once, skip the idle spin) while keeping drag interaction.

### F5 · Desktop modal doesn't announce as a named region on open + no initial focus target
Pairs with F1: even with focus moved in, several dialogs have their heading in a
`<h3>` that isn't wired as the dialog's accessible name. `Modal` takes an
`ariaLabel` prop (good), but confirm each caller passes a meaningful one; the
Copy-day and Duplicate modals do, some others rely on generic labels.
- **Fix:** prefer `aria-labelledby` pointing at the dialog's `<h3>` id where a
  visible title exists; keep `aria-label` as the fallback.

### F6 · Packing "add item" input has no accessible name (`src/components/packing/PackingClient.tsx:204`)
The add-item `<input>` has only a `placeholder` (placeholders aren't accessible
names and vanish on input). Every *other* input in the app is labeled — this is
the one gap.
- **Fix:** add `aria-label={scope === "group" ? "Add a group packing item" : "Add a personal packing item"}`.

### F7 · No inline error association for form validation
Server-action/Zod failures surface only through the polite toast
(`role="status"`). There's no `aria-describedby` linking a failed field to its
error message, and a *failure* toast announces at the same low priority as a
success toast, so a screen-reader user may not learn *which* field was wrong.
- **Fix (incremental):** give error toasts `role="alert"`/`aria-live="assertive"`
  (a `variant` on the toast). Full inline field errors are a larger change; note
  as a follow-up.

---

## P3 — polish / needs-render confirmation

### F8 · Decorative interactive globe exposes an interaction it can't fulfill by keyboard (`Globe3D.tsx`)
The canvas has `aria-label="Interactive globe — drag to spin"` but no keyboard
affordance. It's purely decorative, so the accessible name over-promises.
- **Fix:** mark the mount `aria-hidden="true"` (it conveys no information), which
  also removes it from the tab/AT order. Ties into F4.

### F9 · No skip-to-content link
There's no "skip to main content" link, and the dashboard/auth/onboarding routes
render directly under `<body>` with no `<main>` landmark (only the trip layout
has `<main className="main">`). Keyboard users must tab through the sidebar/nav
on every trip page load.
- **Fix:** add a visually-hidden-until-focused skip link in the root layout
  targeting `#main`, and wrap the dashboard/auth/onboarding content in a `<main>`
  landmark for parity with the trip layout.

### F10 · Contrast + axe sweep — needs a render (tracked, not resolvable statically)
Muted tokens (`--ink-3` on `--paper-2`/`--paper-3`), the soft focus fills (F2),
the availability heatmap's low-opacity teal cells, and the budget category bar
colors should be measured against 4.5:1 (text) / 3:1 (non-text) on a rendered
page, and an automated axe pass run on the five main routes (dashboard,
itinerary, map, budget, schedule). This is the ODY-022 browser half; this audit
documents the static findings that don't need a render.

---

## Suggested fix order (all low-risk, mostly shared-component changes)
1. **F1 + F5** — one `Modal` change fixes focus for every dialog. Highest impact.
2. **F2** — a handful of `:focus-visible` rings in `globals.css`.
3. **F4 + F8** — one reduced-motion CSS block + a `matchMedia` check in `Globe3D`.
4. **F6** — one-line `aria-label`.
5. **F3** — swap the card menu to the base-ui primitive.
6. **F7 / F9** — toast `variant` + skip link/landmarks.
7. **F10** — schedule into a session with a browser (axe + contrast).
