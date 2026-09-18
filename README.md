<div align="center">

# 🔥 Kiwami

### *Own your days.*

A local-first, four-tab life PWA — **Calendar · Notes · Tasks · Life** — that
fuses a full Today/Month/Week/Day/Agenda calendar with a **routine/streak
engine**, rich-text notes, a full Kanban task board, and medication/chore/
inventory/shopping tracking. Wrapped in a macOS-dark **"Scarlet Glass"** UI:
graphite surfaces under a live red gradient wash, real backdrop-blurred
glass on every pane, and an Apple-style in-app guide (`?`) that teaches the
whole thing. No account, no server, your data never leaves your device.

**🔗 Live: [kiwami-kappa.vercel.app](https://kiwami-kappa.vercel.app/)** —
installable as a PWA straight from the browser.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Ant Design](https://img.shields.io/badge/Ant%20Design-5-0170FE?logo=antdesign&logoColor=white)
![Dexie](https://img.shields.io/badge/Dexie-IndexedDB-EE6E73)
![Framer Motion](https://img.shields.io/badge/Framer%20Motion-animation-0055FF?logo=framer&logoColor=white)
![Tabler Icons](https://img.shields.io/badge/Tabler-Icons-000000)
![PWA](https://img.shields.io/badge/Offline-first-000000)
![UI](https://img.shields.io/badge/UI-macOS%20dark%20%C2%B7%20glass-FF453A)
![Vitest](https://img.shields.io/badge/Vitest-61%20passing-6E9F18?logo=vitest&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-informational)

</div>

---

## ✨ Highlights

- 🖤 **"Scarlet Glass" — a macOS-dark UI** — Apple's graphite window scale
  (`#0b0b0e` → `#232329`, never flat black) sitting under a live scarlet
  gradient wash that drifts behind the whole app. Every toolbar, sheet,
  popup, dropdown and the mobile dock is a translucent blurred pane, so the
  wash reads *through* the chrome instead of behind a grey panel. systemRed
  pushed hot (`#ff453a`) drives every primary action as a gradient with a
  live glow.
- 📖 **An Apple-style in-app guide** — a six-page walkthrough (press `?`
  anywhere) that opens once on first run and is always one keystroke away
  after that. Written against what the app actually does, limits included.
- 🎞️ **Motion that stays out of the way** — one shared easing curve,
  hover-lift and press-in on every control, a gradient tab pill that
  *slides* between sections, spring sheet entrances, and one global
  `prefers-reduced-motion` opt-out that kills all of it.
- 🔥 **Ember Chain** — the signature streak visual. Not a progress bar, not
  a ring: a horizontal chain of beads that glows scarlet when a routine's
  done, goes cold ash the day it's missed, and pulses softly on an
  unresolved today. A chain that can catch fire or go cold.
- 📅 **Full calendar surface** — Today, Month, Week, Day and Agenda views,
  all first-class. Drag-to-create, drag-to-move and drag-to-resize on the
  time grid; real spanning bars for multi-day events; a "+N more" overflow
  in Month view.
- 🖥️ **Actually desktop-optimized, not a phone card** — full-width
  proportional grids that use a real monitor's screen, collapsing cleanly
  to a Day+Agenda mobile layout below the breakpoint. Built and verified on
  both a 1440px desktop viewport and a 390px phone viewport.
- 🧭 **Consistent chrome everywhere** — Search, Guide and Settings sit in
  every section's toolbar; Calendar/Notes/Tasks/Life switch from a desktop
  segmented control or a floating glass dock on mobile.
- 🍽️ **Food-time slots** — define Breakfast/Lunch/Dinner/snack times once;
  they show up as fixed recurring blocks with their own visual language
  (cyan + fork/knife) and a one-tap Ate/Skipped log.
- 🧠 **A recurrence engine that's actually correct** — daily / weekly with a
  weekday picker / monthly with fixed-day clamping / custom every-N-days-
  or-weeks, anchored so the cadence never drifts depending on which window
  you're viewing. 12 unit tests covering the edge cases (month-end
  clamping, anchor boundaries, exclusion dates).
- 🌗 **Dark/light theming** — the same design system inverted onto Apple's
  `#f5f5f7` desktop grey; respects `prefers-color-scheme` by default and
  remembers an explicit override.
- 📴 **Genuinely offline-first** — installable PWA, verified end-to-end
  with the network fully disabled: service worker installed, app reloaded
  offline, still fully interactive (the guide included).
- 🎬 **A real preloader**, not a spinner — a short cinematic intro with a
  bead-ring that lights up (a preview of the Ember Chain to come).
- 🔒 **100% local** — IndexedDB via Dexie is the source of truth. A Convex
  schema exists for future background sync, but nothing leaves your device
  today.
- 🗓️ **Ember Year Heatmap** — a GitHub-contributions-style grid for any
  routine's whole year, colored with the same scarlet/ash palette as the
  chain instead of green squares.
- ⌨️ **Command Palette (Ctrl/Cmd+K)** — fuzzy search across events, notes,
  tasks and Life items, plus quick actions (jump to today, Focus, weekly
  review, open the guide), all keyboard-driven.
- 💎 **Forged streak milestones** — hit a 7/30/100/365-day streak and that
  day's bead forges into a faceted diamond with a one-time burst animation.
- 🩺 **Life tab** — medications (scheduled + as-needed, with the same Ember
  Chain adherence streak and a refill-countdown alert), chores (recurring,
  with an optional "reschedule from when you actually finish it" mode),
  household inventory with a running-low flag, and a wishlist → buy-list
  lifecycle with store grouping and offline share/clipboard export — all
  unified into a single cross-domain **Today Digest**.
- ✅ **A real Kanban task board** — drag-and-drop columns (`@dnd-kit`) with
  velocity-based card tilt while dragging, collapsible columns, bulk
  select → move/archive, priority color-coding, tags, subtasks with
  one-tap "Help me start" breakdown templates, and a glass "Focus" mode
  that surfaces one task full-screen with Done/Skip/Won't-do actions.
- 📝 **Apple-Notes-style rich text** — a full-screen `Tiptap` editor
  (headings, bold/italic/underline/strikethrough, text color,
  bulleted/numbered/checklist lists), autosaving on a debounce with no
  Save button, plus offline NLP date/time parsing (`chrono-node`) for
  quick Tasks/Reminders entry.

## 📸 Screenshots

<table>
<tr>
<td width="60%">

**Month view** — routines (flame, scarlet), food slots (fork/knife, cyan)
and a real spanning bar for a multi-day trip, all on one grid. Missed days
strike through; today's date carries the accent dot.

<img src="docs/screenshots/month-dark.webp" alt="Month view, dark mode" width="100%">

</td>
<td width="40%">

**The Ember Chain** — streak number, full bead history, and explicit
Done/Missed actions (never a silent tap-to-cycle, so a mis-tap can't break
a streak), on the "Floating Blade" glass sheet.

<img src="docs/screenshots/routine-detail-dark.webp" alt="Routine detail sheet with Ember Chain" width="100%">

</td>
</tr>
<tr>
<td colspan="2">

**The guide** — six pages, opened once on first run and always available on
`?`. Big gradient glyph, one idea per page, real shortcuts on the last one.

<img src="docs/screenshots/guide-dark.webp" alt="Kiwami in-app guide, welcome page" width="49%">
<img src="docs/screenshots/guide-calendar-dark.webp" alt="Kiwami in-app guide, calendar page" width="49%">

</td>
</tr>
<tr>
<td>

**Week view** — the 7-day time grid with long-press-to-create,
drag-to-move, a bottom-edge resize handle and a live now-indicator.

<img src="docs/screenshots/week-dark.webp" alt="Week view, dark mode" width="100%">

</td>
<td>

**Agenda view** — chronological, grouped by day, with a compact Ember Chain
preview riding alongside each routine row.

<img src="docs/screenshots/agenda-dark.webp" alt="Agenda view, dark mode" width="100%">

</td>
</tr>
<tr>
<td>

**Ember Year Heatmap** — GitHub-contributions-style, per routine, colored
with the Ember Chain's own palette, with current/longest streak and
completion rate above it.

<img src="docs/screenshots/year-heatmap-dark.webp" alt="Ember Year Heatmap" width="100%">

</td>
<td>

**Command Palette** — Ctrl/Cmd+K or the toolbar search icon, one search
surface either way, across every section plus quick actions.

<img src="docs/screenshots/command-palette-dark.webp" alt="Command Palette search" width="100%">

</td>
</tr>
<tr>
<td>

**Life tab — Today Digest** — a cross-domain daily view: a glass catch-up
strip for anything overdue, a Now/Focus zone, then medications, schedule,
tasks, chores and shopping in one scroll.

<img src="docs/screenshots/life-today-dark.webp" alt="Life tab Today Digest" width="100%">

</td>
<td>

**Life tab — Medications** — scheduled doses with their own compact Ember
Chain streak, a refill-countdown alert, and one-tap PRN logging.

<img src="docs/screenshots/life-medications-dark.webp" alt="Life tab Medications view" width="100%">

</td>
</tr>
<tr>
<td>

**Tasks — Kanban board** — drag-and-drop columns, priority color-coded left
borders, collapsible columns, scope filters and bulk select for
move/archive.

<img src="docs/screenshots/tasks-board-dark.webp" alt="Tasks Kanban board" width="100%">

</td>
<td>

**Tasks — Focus mode** — the "Floating Blade" glass treatment surfaces one
task full-screen with Done/Skip/Won't-do/Schedule-for-today actions.

<img src="docs/screenshots/tasks-focus-dark.webp" alt="Tasks Focus mode" width="100%">

</td>
</tr>
<tr>
<td>

**Notes** — notes, tasks and reminders in one timeline, with the sticky
quick-entry composer parsing dates as you type.

<img src="docs/screenshots/notes-dark.webp" alt="Notes section" width="100%">

</td>
<td>

**Life tab — Shopping** — wishlist → promote → buy list → bought, grouped
by store, with offline share/clipboard export.

<img src="docs/screenshots/life-shopping-dark.webp" alt="Life tab Shopping view" width="100%">

</td>
</tr>
<tr>
<td>

**Light mode** — the same system inverted onto Apple's desktop grey, with
the scarlet wash turned down to a rose tint.

<img src="docs/screenshots/month-light.webp" alt="Month view, light mode" width="100%">

</td>
<td align="center">

**Mobile** — Day + Agenda only, a floating glass dock with a sliding
gradient pill, and touch-sized sheets throughout.

<img src="docs/screenshots/mobile-dark.webp" alt="Mobile Agenda view" width="45%">
<img src="docs/screenshots/mobile-life-dark.webp" alt="Mobile Life tab" width="45%">

</td>
</tr>
</table>

## 📦 What's inside

| | View / feature | What it does |
|---|---|---|
| ☀️ | **Today** | One dashboard for the current day: schedule, routines, meals, due tasks and reminders |
| 🗓️ | **Month** | Grid with event pills, spanning bars for multi-day events, "+N more" overflow popover |
| 📆 | **Week** | 7-day time grid, drag-to-create/move, resize handle |
| 📋 | **Day** | Single-column time grid, more detail per event |
| 📃 | **Agenda** | Chronological list grouped by day, rolling 30-day window |
| 🔥 | **Routines** | Recurring blocks that must be marked Done/Missed per occurrence; cached streak count; auto-miss sweep breaks a streak if a past day is left unresolved |
| 🍽️ | **Food-time slots** | Named, retimeable recurring slots with a one-tap Ate/Skipped log — adherence only, no macro tracking |
| 🗓️ | **Year in review** | Per-routine GitHub-style heatmap, pick any routine and year |
| ⌨️ | **Command Palette** | Ctrl/Cmd+K or the toolbar search icon — search by title, jump to a date, jump to Today |
| 📝 | **Notes** | Full-screen rich-text editor (Tiptap) — headings, bold/italic/underline/strike, color, checklists — autosaves on a debounce, no Save button |
| ✅ | **Tasks** | Kanban board (`@dnd-kit`), lists/tags, priorities, subtasks + "Help me start" templates, bulk select, collapsible columns, glass Focus mode |
| 🩺 | **Life — Medications** | Scheduled (multi-dose/day, any recurrence) + as-needed, Ember Chain adherence streak, refill-countdown alert |
| 🧹 | **Life — Chores** | Recurring or one-off, fixed-schedule or reschedule-from-completion, no streak (completion-based, not habit-based) |
| 📦 | **Life — Inventory** | Quantity tracking with a running-low flag, one tap to add a low item straight to the buy list |
| 🛒 | **Life — Shopping** | Wishlist → promote → buy list → mark bought, grouped by store, offline share/clipboard export |
| ☀️ | **Life — Today Digest** | Every domain above, unified: due/overdue catch-up, now/next, schedule, tasks, chores, shopping — in one scroll |
| 📖 | **Guide** | Six-page Apple-style walkthrough — opens once on first run, then `?`, any toolbar's `?` button, Settings, or the Command Palette |
| ⚙️ | **Settings** | Theme toggle (dark/light, respects system default), the guide, food-slot management — reachable from every section's toolbar |
| 🔑 | **Keyboard** | ←/→ step the period, `T` jumps to Today, `?` opens the guide, Ctrl/Cmd+K opens search |

## 🎨 Design system — "Scarlet Glass"

The whole look is a token layer. Every component reads CSS variables
(`src/index.css`) or the matching concrete hexes (`src/theme.ts`), so the
palette lives in two files rather than scattered across sixty components.

| Token | Dark | Light | Used for |
|---|---|---|---|
| `--bg` | `#0b0b0e` | `#f5f5f7` | App ground (Apple's window greys — never pure black) |
| `--surface` / `-high` / `-highest` | `#151519` · `#1b1b20` · `#232329` | `#ffffff` · `#ffffff` · `#ebebef` | Elevation scale |
| `--accent` | `#ff453a` | `#ff3b30` | systemRed, pushed hot — the brand |
| `--ember-hot` | `#ff7a5e` | `#ff6b4a` | The lit end of the gradient |
| `--accent-gradient` | `#ff7a5e → #ff453a → #ff2d55` | `#ff6b4a → #ff3b30 → #d81e5b` | Primary buttons, Segmented thumb, dock pill, guide glyph |
| `--teal` | `#64d2ff` | `#0f83b3` | Food slots, reminders |
| `--gold` | `#ffd60a` | `#c79300` | Warnings, buy-list |
| `--danger` | `#ff375f` | `#d70015` | Destructive actions — kept distinct from the red accent |
| `--diamond` | `#ffd7e0` | `#a4133c` | Streak milestones **only** — never a general accent |

**The wash.** A fixed, pointer-transparent layer painted *under* the app
(`body::before` — three scarlet radial blooms; `body::after` — one blurred
light-leak drifting on a 26-second transform). `#root` sits above it, so
every translucent pane blurs real colour instead of flat grey. That's the
difference between glass and a grey panel.

**The glass.** `backdrop-filter: blur(...) saturate(180%)` with a literal
blur radius (never through a `var()` — iOS Safari silently drops that),
both `-webkit-` and unprefixed, wrapped in `@supports` with a solid fill as
the fallback. Applied to modals, the modal scrim, date-picker/select/
dropdown/popover panels, every toolbar, and the mobile dock.

**Type.** `-apple-system` / SF Pro for UI, **Playfair Display** for streak
numerals and hero headlines, **JetBrains Mono** for day numbers, timestamps
and uppercase micro-labels. Both self-hosted as static `woff2` via
`@fontsource` — zero CDN calls, so the offline guarantee still holds.

**Motion.** One easing curve (`--ease`, Apple's standard ease-out) shared
by every transition; hover-lift and press-in on controls; framer-motion
`layoutId` for the sliding dock pill; springs for sheet entrances. A single
`prefers-reduced-motion: reduce` block disables all of it, including the
background wash.

## 🛠 Tech stack

**React 19** · **TypeScript (strict)** · **Vite 5** · **Ant Design 5** ·
**Dexie (IndexedDB)** · **Framer Motion** · **@dnd-kit** (Tasks board) ·
**Tiptap** (rich-text Notes) · **react-icons (Tabler)** · **dayjs** ·
**chrono-node** (offline NLP dates) · **vite-plugin-pwa** · optional
**Convex** (schema ready, sync deferred) · **Vitest**

## 🚀 Quick start

```bash
npm install
npm run dev          # prints Local + Network URL — open the Network URL on your phone
```

```bash
npm run build         # -> /dist, generates the PWA service worker
npm run preview        # serve /dist to verify the installed/offline experience
npm run test            # vitest — recurrence, streak, medication/inventory logic, etc. (61 tests)
```

## ☁️ Deploying

Kiwami is a fully static PWA — no router, no backend (the Convex schema in
`convex/` isn't wired to any function yet), so there's genuinely nothing
server-side to configure:

```bash
npm run build   # -> dist/, a fully self-contained static site + service worker
```

Deploy the `dist/` folder to any static host — **Vercel, Netlify, Cloudflare
Pages, GitHub Pages, or a plain S3/CloudFront bucket all work with zero
extra config**, since there's no client-side routing that needs an
SPA-fallback rewrite rule. A couple of things worth knowing:

- `vite.config.ts` has no custom `base` (defaults to `/`) — correct for a
  custom domain or any host that serves from the root. Only a **GitHub
  Pages project site** (e.g. `you.github.io/kiwami`, not a custom domain)
  needs `base: "/kiwami/"` added before building.
- The install prompt, offline support, and app icons are all already wired
  (`vite-plugin-pwa`, `public/manifest.webmanifest`, `public/icons/*`) —
  nothing extra needed for "Add to Home Screen" to work once it's live on
  HTTPS (every host above provides that automatically).
- Run `npm run preview` after building to sanity-check the production
  build locally (with the real service worker, not the dev server) before
  pushing it anywhere.

## 🧱 Architecture

```
UI (features/*/*.tsx)        ← presentational only, never touches Dexie directly
  └─ data hooks (lib/*.ts)   ← the ONLY place Dexie is read/written
       └─ db (src/db/db.ts)  ← typed tables, export/import
```

## 🔒 Privacy

100% on-device. No analytics, no account, no network required to use any
feature. A Convex schema exists for optional future background sync, but no
sync functions are wired up — nothing is sent anywhere today.

## 📄 License

MIT

<div align="center"><sub>Built for a daily-use calendar that doesn't look like everyone else's · by Apurva</sub></div>
