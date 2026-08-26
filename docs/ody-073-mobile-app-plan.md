# ODY-073 — Mobile App: Plan & System Design

> Status: **spike decision recorded, not yet in execution.** This is the
> implementation-ready plan referenced by ODY-073 in `BACKLOG.md`. When we
> choose to start, follow the phases below in order.

---

## 1. Decision (TL;DR)

Ship mobile in **three phases**, cheapest → most native:

1. **Phase 1 — PWA (installable web).** *Largely done already* (see §3). Ships as
   the phase-1 "app": installs to the home screen, runs standalone. No new
   codebase, no stores.
2. **Phase 2 — Capacitor (native shell).** Wrap the existing Next app in a native
   WebView container to get real App Store / Play Store builds, reusing ~100% of
   current code. Fastest route to store presence.
3. **Phase 3 — Expo + React Native (true native).** A separate app in a monorepo
   that shares the backend and all non-UI logic; the screens are rebuilt in
   native primitives. Best feel, push notifications, real offline. Only do this
   when the product warrants it.

**Why phased:** each phase is independently shippable and de-risks the next. We
never fork business logic — every phase talks to the same backend (§2).

---

## 2. Architecture — one backend, many frontends

The invariant for the whole effort:

```
              ┌──────────────── ONE BACKEND (source of truth) ────────────────┐
              │  Clerk (auth)  ·  Prisma  ·  Postgres/Supabase  ·  lib/services │
              └───────────────────────────────────────────────────────────────┘
                     ▲                    ▲                      ▲
                     │ RSC / actions      │ HTTPS + JWT          │ HTTPS + JWT
          ┌──────────┴─────────┐  ┌───────┴────────┐   ┌─────────┴──────────┐
          │  Web (Next.js)     │  │  PWA / Capacitor│   │  React Native app  │
          │  desktop + mobile  │  │  (the web app)  │   │  (rebuilt screens) │
          │  browser           │  │                 │   │                    │
          └────────────────────┘  └─────────────────┘   └────────────────────┘
```

- **Single account, single data.** A user signs in with the same Clerk identity
  everywhere and sees the same trips. This is how Notion/Linear/etc. work.
- **No business-logic forks** (the ODY-073 guardrail). The split math
  (`lib/budget.ts`), validation (`lib/validations`), ICS/maps export, date
  helpers, and auth-sync (`getOrCreateDbUser`) are the *only* copy and are shared,
  never reimplemented per platform.
- **The one architectural change mobile forces:** today the web mutates data
  through **Server Actions** (`app/**/actions.ts`), which are a Next/RSC RPC
  mechanism and **cannot be called from React Native**. Phase 3 needs a plain
  HTTP API. See §6 for the clean way to add one without duplicating logic.

---

## 3. Current state — what Phase 1 already has (shipped this session)

The PWA groundwork is done:

- **Installable:** `app/manifest.ts` (standalone display, name, description,
  categories, theme/background = paper).
- **Icons:** maskable `public/icon-512.png` / `icon-192.png`, vector
  `public/app-icon.svg`, and `app/apple-icon.png` (iOS apple-touch-icon).
- **Notch / safe areas:** `viewport-fit=cover` + `env(safe-area-inset-*)` padding
  on the fixed header, tab bar, canvas, and map.
- **Chrome:** `theme-color`, `color-scheme: light`, zoom left enabled.
- **Touch feel:** `touch-action: manipulation`, `-webkit-tap-highlight-color`,
  `:active` press feedback, overscroll containment in sheets/modals.
- **Mobile nav (ODY-058/059):** bottom tab bar (4 core) + overflow drawer.
- **Resilience:** branded 404, global error boundary, route skeletons.

**Remaining to call Phase 1 "complete":** offline read (ODY-068) and a Lighthouse
PWA pass. Everything else is in place.

---

## 4. Option analysis

| | **PWA** | **Capacitor** | **Expo / React Native** |
|---|---|---|---|
| New code | none | thin native wrapper + config | separate app (screens rebuilt) |
| Reuses current UI | 100% | 100% (runs the web app) | 0% UI, ~all logic |
| In App/Play stores | No (installs from browser) | **Yes** | **Yes** |
| Native feel | okay | okay (WebView) | **best** |
| Push notifications | limited (web push, no iOS parity) | possible via plugins | **first-class** |
| Offline | via service worker | via service worker | **best** (native storage) |
| Effort | ~done | small–medium | large, multi-sprint |
| Maintenance | one codebase | one codebase | two UIs (shared logic) |

**Rule of thumb:** Capacitor if the goal is "be in the stores, reuse everything";
React Native if the goal is "feel like a native travel app."

---

## 5. Roadmap — concrete steps per phase

### Phase 1 · PWA (finish)
1. Add offline read (ODY-068): cache the last-viewed trip(s) so itinerary/map
   render without a connection.
2. Run Lighthouse "PWA" + "Best Practices"; fix any flags.
3. Verify install on a real iPhone (Safari → Add to Home Screen) and Android
   (Chrome → Install app). **Acceptance:** launches standalone, icon crisp, safe
   areas correct.

### Phase 2 · Capacitor (stores, reuse the web app)
1. `npm i @capacitor/core @capacitor/cli && npx cap init` (appId e.g.
   `app.odyssey.trips`, appName "Odyssey").
2. Point Capacitor at the deployed site (`server.url`) *or* bundle a static
   export — prefer `server.url` to the Vercel prod URL so updates ship without an
   app-store review.
3. `npx cap add ios && npx cap add android`.
4. Native niceties via plugins: `@capacitor/status-bar`, `@capacitor/splash-screen`,
   `@capacitor/app` (deep links), `@capacitor/push-notifications` (optional).
5. Clerk works as-is (it's the same web app in a WebView), but validate the OAuth
   redirect / session flow inside the WebView; use Clerk's allowed-origins config.
6. Build & submit: open in Xcode (iOS) / Android Studio (Android) → TestFlight /
   Play Internal Testing → stores.
   **Acceptance:** signed-in user opens a trip, views itinerary + map, makes a
   basic edit, on both platforms, from a store build.

### Phase 3 · Expo + React Native (native)
The big one. Sequenced in §6–§9. High level:
1. Convert the repo to a **monorepo** (`apps/web`, `apps/mobile`, `packages/shared`).
2. Extract action logic into `packages/shared` services + add HTTP API routes (§6).
3. Scaffold Expo app; add Clerk Expo auth (§7).
4. Rebuild screens in priority order (§8).
5. Deep links + offline (§9), then EAS Build → stores.

---

## 6. Data layer — the key refactor (do this before RN)

**Problem:** Server Actions are web-only; RN needs HTTP.

**Solution (no logic fork):** extract each action's *body* into a
framework-agnostic **service function** and have both callers use it.

```
Today:                          Target:
app/**/actions.ts               packages/shared/services/expenses.ts
  └ all logic inline              └ createExpense(userId, input)  ← pure logic
                                app/**/actions.ts      (web)  → calls service
                                app/api/**/route.ts    (mobile)→ calls service
```

- A service takes `(userId, input)` and does: `assertTripRole` → Zod `.parse` →
  Prisma work. Identical to today's actions, just parameterized by `userId`
  instead of calling `getDbUser()` inside.
- **Web** keeps its Server Actions (thin wrappers: resolve `userId` via
  `getOrCreateDbUser()`, call the service). Zero UX change.
- **Mobile** hits **Route Handlers** under `app/api/trips/...` that resolve
  `userId` from the Clerk JWT (§7) and call the same service.
- Result: one implementation of every rule (the ODY-073 guardrail holds), two
  transports. Existing IDOR/role guards (`assertTripRole`, trip-scoped
  `updateMany`, membership-scoped reads) move verbatim into the services.

**What's shared vs rebuilt:**

| Shared (`packages/shared`) | Rebuilt for RN (`apps/mobile`) |
|---|---|
| Types (`src/types`), Zod schemas | Every screen / component |
| Split math (`lib/budget.ts`) | Navigation (React Navigation vs App Router) |
| Formatting, date/UTC helpers | Styling (StyleSheet / NativeWind, not CSS) |
| ICS / maps export, notes parsing | Map (react-native-maps, not Leaflet) |
| The service functions + API client | Rich text (not Tiptap), drag-reorder |

---

## 7. Auth — Clerk across web + mobile

- Same Clerk instance and user pool. Web uses `@clerk/nextjs` (cookies); RN uses
  **`@clerk/clerk-expo`** (secure token store).
- RN flow: user signs in via Clerk Expo → `getToken()` returns a JWT → send it as
  `Authorization: Bearer <jwt>` to the API routes.
- API routes verify the token with Clerk's server SDK and resolve the DB user via
  the *existing* `getOrCreateDbUser` path (which already relinks placeholder
  invitees — keep that behavior).
- Prereq: **ODY-036 (production auth)** must be done first — mobile OAuth
  redirects and token config are unforgiving in dev keys.

---

## 8. Screen rebuild — priority order (Phase 3)

Rebuild against the acceptance core first (open trip → itinerary → map → basic
edit), then the rest:

1. **Auth + trip list** (dashboard) — simplest, proves the API client + Clerk.
2. **Itinerary** (day list + event cards + add/edit event modal).
3. **Map** — **largest single rebuild.** Leaflet is DOM-only; use
   `react-native-maps` (Apple/Google native) with the shared pin types/colors
   (`mapTypes.ts`). Fallback: a WebView hosting the current Leaflet map.
4. **Budget** (expense list + split modal) — logic is already shared (`lib/budget`).
5. **Members / Collections / Explore / Packing / Schedule.**
6. **Notes** — Tiptap is web-only; ship plain-text/markdown on mobile first.

Styling: consider **NativeWind** (Tailwind for RN) so spacing/color tokens
translate with less friction; otherwise `StyleSheet`. The `--ody` design tokens
become a shared JS theme object.

---

## 9. Deep linking & offline (Phase 3)

- **Deep links:** register a scheme (`odyssey://`) + iOS Universal Links / Android
  App Links mapping `https://odyssey-trips.vercel.app/trips/:id/...` → the RN
  route, so a shared invite opens the app on the right trip (guardrail: "deep
  links into `/trips/[id]/…`"). Handled by `expo-linking` + React Navigation.
- **Offline (ODY-068):** start read-only — hydrate the last-opened trip from local
  storage (MMKV or SQLite) so itinerary/map render offline; writes queue and flush
  on reconnect later. Keep v1 minimal.

---

## 10. Tooling, accounts & cost

| Need | For |
|---|---|
| **Mac** | iOS builds (Xcode is macOS-only) |
| Xcode / Android Studio | simulators, emulators, native builds |
| **Apple Developer** ($99/yr) | App Store submission |
| **Google Play Developer** ($25 once) | Play Store submission |
| Expo + **EAS CLI** | RN dev, cloud builds (`eas build`), `eas submit` |
| Expo Go app (phone) | instant on-device testing (scan QR) |
| Capacitor CLI + plugins | Phase 2 shell |
| Clerk Expo SDK | mobile auth |

CI: EAS Build can run on push; keep store submission manual until stable.

---

## 11. Testing strategy

- **PWA:** Add-to-Home-Screen on real iOS/Android; Lighthouse PWA audit.
- **Capacitor / RN:** iOS Simulator + Android Emulator during dev; real device
  over USB; **TestFlight** (iOS) + **Play Internal Testing** (Android) before
  release.
- **RN E2E:** Maestro (simplest) or Detox for the core flow (sign in → open trip →
  add event → check split).
- **Shared logic:** already covered by the existing Vitest suite — it moves into
  `packages/shared` and keeps running for both platforms.

---

## 12. Dependencies & sequencing

Do prereqs before Phase 3:

- **ODY-036 · production auth** — required (mobile token/redirect config).
- **ODY-037 · share/invites** — deep-linked invites are the mobile hook.
- **ODY-058 / ODY-059 · mobile chrome** — ✅ done (bottom tab bar + drawer).
- **ODY-068 · offline read** — ideal before RN; also completes Phase 1 PWA.

Suggested order: finish Phase 1 PWA (+ ODY-068) → Phase 2 Capacitor (needs
ODY-036) → Phase 3 RN (needs ODY-036/037 + the §6 API refactor).

---

## 13. Risks & open decisions

- **Server-action → service/API refactor (§6)** is the gating architectural task;
  scope it as its own sprint before RN screens.
- **Map** is the heaviest rebuild (Leaflet → react-native-maps). Decide native vs
  WebView early.
- **Tiptap notes** have no direct RN equivalent — accept plain text/markdown on
  mobile v1.
- **dnd-kit reorder** → `react-native-reanimated` + `react-native-gesture-handler`;
  non-trivial, defer if needed.
- **Two UIs to maintain** — mitigated by the shared package, but real. Capacitor
  (Phase 2) avoids it entirely if native feel isn't required.

---

## 14. Acceptance per phase

- **Phase 1 (PWA):** installs standalone on iOS + Android, crisp icon, safe areas
  correct, last trip readable offline.
- **Phase 2 (Capacitor):** store builds on both platforms; signed-in user opens a
  trip, views itinerary + map, makes a basic edit.
- **Phase 3 (RN):** the same core flow runs as a native app with native map and
  navigation; invites deep-link into the right trip; core flow covered by E2E.
