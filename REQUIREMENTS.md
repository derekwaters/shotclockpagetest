# Shot Clock Trainer

## Synopsis

A single-page web app for practising basketball shot clock operation against a real game recording. The user runs their own shot clock alongside the video and receives an accuracy score based on a reference timing file.

## Technology Stack

- **Next.js 16** (App Router, `src/app/` directory, `'use client'` directive on the page)
- **React 19**, JavaScript (not TypeScript)
- Static export: `output: 'export'` in `next.config.mjs`
- Hosted at the `/shotclock` subpath: `basePath: '/shotclock'`
- `NEXT_PUBLIC_BASE_PATH` env var must be set to `/shotclock` in all environments (dev and production) so that `fetch()` calls for public assets resolve correctly against the subpath
- Path alias `@/*` → `src/*`
- Styles via CSS Modules (`page.module.css`)

## Deployment

The app is a static export (`out/` directory) deployed at `/shotclock/` on a web server. A `Containerfile` is provided to build a two-stage container using podman: Node 22 Alpine builds the export, then nginx Alpine serves the `out/` directory on port 80.

## Visual Design

### Colour Palette

| Role | Value |
|---|---|
| Page background | `#111` |
| Panel row top border / primary accent | `#f97316` (orange) |
| Panel separators | `#222` / `#333` |
| Quarter badge, note bar text | `#f97316` |
| Clock display — stopped/dim | `#ccc` |
| Clock display — active/running | `#fff` |
| Running status pill | `#4ade80` (green) |
| Clock urgent (≤ 5 s, > 0) | `#f97316` with pulsing opacity animation |
| Clock expired (0 s) / violation pill | `#ef4444` (red) |
| Ideal shot clock (help mode) | `#60a5fa` (blue) |
| Accuracy percentage | `#facc15` (yellow) |
| Label / meta text | `#666` |
| Event note bar background | `#0d0d0d` |
| Guide modal background | `#1a1a1a` |

### Fonts

Use **Geist Sans** for body text and **Geist Mono** for all clock digit displays. Both are loaded via `next/font` in `src/app/layout.js` (standard `create-next-app` setup). Apply them as CSS variables (`--font-geist-sans`, `--font-geist-mono`).

## Page Layout

The page fills the full viewport height (`height: 100vh`, `overflow: hidden`). It is a vertical flex column divided into:

1. **Video section** — `flex: 2`
2. **Panels area** — `flex: 1`, itself a vertical flex column containing:
   - **Panel row** — `flex: 1`, three equal side-by-side panels
   - **Event note bar** — fixed height ≈ 36 px

### Video Section

Embeds the YouTube video with ID `_UuXmPtR94c` using the YouTube IFrame API. The player fills the full width and height of the section. While the video is loading, a centred "Loading video…" overlay is shown on a black background.

The IFrame API script (`https://www.youtube.com/iframe_api`) is injected dynamically. The player is created once the API is ready via `window.onYouTubeIframeAPIReady`.

Player config: `controls: 1, disablekb: 1, modestbranding: 1, rel: 0, fs: 0, iv_load_policy: 3`.

The panels area is separated from the video by a 2 px orange (`#f97316`) top border.

### Panel Row

Three panels side-by-side (`flex: 1` each), separated by 1 px borders (`#222`/`#333`).

#### Game Clock Panel (left)

Displays, top to bottom:
- Small uppercase label: "Game Clock" (dim)
- Quarter badge: "Q1", "Q2", etc. (orange, `1rem`)
- Game clock time in `M:SS` format (large Geist Mono, `clamp(1.8rem, 4vw, 3rem)`); initial value `12:00`
- Status pill (small, rounded border): `PAUSED` when video is paused, `RUNNING` (green border/text) when clock is running, `STOPPED` otherwise

The game clock is driven entirely by the timings file — the user does not control it directly.

#### Shot Clock Panel (centre)

Displays, top to bottom:
- Small uppercase label: "Shot Clock" (dim)
- **Normal mode**: single large Geist Mono shot clock value (`clamp(2.5rem, 6vw, 4.5rem)`); initial value `24`
- **Help mode**: two equal columns with a vertical divider:
  - "Yours" — the user's shot clock (same styling as normal mode)
  - "Ideal" — the ideal shot clock from the timings file (blue, `clamp(1.5rem, 3.5vw, 2.8rem)`)
- Status pill: `VIOLATION` (red border/text) when shot clock is at 0; otherwise `PAUSED` / `RUNNING` / `STOPPED`
- Accuracy display (only shown once at least one reference timing event has been processed):
  - Large yellow percentage (`clamp(1.4rem, 3.5vw, 2.2rem)`)
  - Small grey line: "accuracy · correct/total"

**Shot clock display format**: integer seconds when ≥ 5 s; one decimal place when < 5 s (e.g. `4.7`).

**Visual states for the user's shot clock**:
- **Urgent** (> 0 s and ≤ 5 s, running): orange, repeating opacity pulse (`0.5s ease-in-out alternate`)
- **Expired** (0 s): red, no pulse

#### Controls Panel (right)

Four buttons stacked vertically, each `width: 100%`, with a label on the left and a keyboard shortcut badge (`<kbd>`) on the right:

| Button | Shortcut | Notes |
|---|---|---|
| Start / Stop Shot Clock | `Space` | Toggle; `disabled` when video is not playing; green when starting, red when stopping |
| Full Reset (24s) | `R` | Blue |
| Alt Reset (14s) | `T` | Purple |
| Help Mode | — | Badge shows `ON` or `OFF`; styled distinctly when on vs off |

A small video status line below the buttons: "⏳ Loading…", "▶ Playing", or "⏸ Paused".

### Event Note Bar

A thin bar (`flex: 0 0 36px`) spanning the full width. Dark background (`#0d0d0d`), top border `#1e1e1e`. Three children in a flex row:

- **Note text** (`flex: 1`, `text-align: center`): the `notes` value from the most recently fired timing event. Uppercase orange (`#f97316`), `0.85rem`, `font-weight: 600`, `letter-spacing: 0.1em`. Truncated with ellipsis if too wide.
- **Button group** (`flex-shrink: 0`): two small flat buttons, both styled consistently (dim text, subtle border, uppercase, `0.58rem`):
  - **Guide** — `<button>` that opens the guide modal; if the video is playing it is paused first
  - **Send Feedback** — `<a>` styled as a button with `href="mailto:derek@frisbeeworld.com?subject=Shot%20Clock%20Trainer%20Feedback"`

## Guide Modal

A fixed full-screen overlay (`z-index: 100`, dark semi-transparent backdrop `rgba(0,0,0,0.85)`) containing a centred dialog `90vw × 90vh`.

Dialog structure:
- **Header** (sticky, `border-bottom`): "Shot Clock Trainer Guide" title (small orange uppercase), Close button (right)
- **Body** (scrollable, `padding: 24px 32px`): renders `shotclockguide.md` content as JSX

**Behaviour**:
- Opening pauses the video (and therefore the clocks) if it is playing
- Closes when: Close button clicked, `Escape` pressed, backdrop clicked

**Guide content styling** (via CSS descendant selectors on the wrapper div):

| Element | Style |
|---|---|
| `h1` | `1.4rem`, white |
| `h2` | `1rem`, orange `#f97316`, uppercase, `letter-spacing: 0.06em`, `border-bottom` |
| `h3` | `0.9rem`, yellow `#facc15` |
| `p`, `li` | `0.9rem`, `#ccc`, `line-height: 1.7` |

The guide content comes from `shotclockguide.md` in the project root. Embed it as a `GuideContent` function component written as JSX, defined above the main page component in `page.js`.

## Clock Timings

Loaded at runtime: `` fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/timings.csv`) ``. The file lives at `public/timings.csv`.

Lines starting with `#` are comments and ignored. The first non-comment line is the CSV header.

### CSV Columns

| Column | Type | Description |
|---|---|---|
| `video_time` | Float | Seconds from the start of the YouTube video |
| `event_type` | String | One of the event types listed below |
| `quarter` | Integer | 1–4 |
| `game_clock` | String | Remaining time in quarter as `MM:SS` (e.g. `11:45`) |
| `shot_clock` | Float | Shot clock value in seconds; blank if not applicable |
| `notes` | String | Short description shown in the event note bar when the event fires; blank for no change |

### Event Types and Their Effects

| Event | Effect |
|---|---|
| `QuarterStart` | Set quarter number; set game clock to `game_clock`; stop both clocks |
| `QuarterEnd` | Stop and optionally correct game clock to `game_clock` |
| `GameClockStart` | Set game clock base to `game_clock`; start game clock |
| `GameClockStop` | Stop game clock; optionally correct to `game_clock` |
| `ShotClockStart` | Start ideal shot clock from `shot_clock` value |
| `ShotClockStop` | Stop ideal shot clock; optionally correct to `shot_clock` |
| `ShotClockReset24` | Reset and start ideal shot clock at 24 s |
| `ShotClockReset14` | Reset and start ideal shot clock at 14 s |

Each event fires exactly once per session: the animation loop checks whether `video_time` has been reached, fires the event, and marks it processed using the key `"${videoTime}|${eventType}"`.

## User Accuracy Calculation

**Reference actions**: all timing events of type `ShotClockStart`, `ShotClockStop`, `ShotClockReset24`, `ShotClockReset14`.

**User actions**: recorded whenever the user presses Start/Stop or a Reset button, stamped with the current `player.getCurrentTime()`.

**Matching rule**: a user action matches a reference action if they share the same `type` and their video times are within **1.5 seconds** of each other. Each reference action can be matched at most once (greedy, closest first).

**Score**: `round(matched / total_reference_actions_so_far × 100)`%.

Recalculated after every user action and after every reference action fires.

## Video Behaviour

### Pause and Resume

On pause (`onStateChange` fires a non-PLAYING state):
- If the game clock was running: compute elapsed time, subtract from remaining, save `wasRunning = true`
- If the shot clock was running: compute `Date.now()` elapsed, subtract from remaining, save `wasRunning = true`

On resume (PLAYING state):
- If `wasRunning` is true for either clock: reset the base time and restart

### No Scrubbing

Users must not be able to seek to a different video position.

1. **While playing**: if the animation loop detects `videoTime - lastVideoTime > 4s` (forward jump) or `< -0.3s` (backward jump), call `seekTo(lastVideoTime, true)` and skip the tick.
2. **Seek-while-paused**: save `pausedAt` when pausing. When play resumes, if `|currentTime - pausedAt| > 1s`, call `seekTo(pausedAt, true)` and skip the tick.

### Tab Visibility

When `document.hidden` becomes true while playing, call `player.pauseVideo()`.

## Clock Architecture

**Game clock** — video-time based. Counts down by comparing `player.getCurrentTime()` against a stored `baseVideoTime`. Formula: `remaining = baseSecs - (videoTime - baseVideoTime)`. Stays perfectly synchronised with the video.

**User's shot clock** — wall-clock based (`Date.now()`). Counts down real seconds from when the user pressed Start. Formula: `remaining = secsAtStart - (Date.now() - startedAt) / 1000`.

**Ideal shot clock** (help mode) — video-time based, identical architecture to the game clock, driven by `ShotClockStart` / `ShotClockStop` / `ShotClockReset*` events.

**Animation loop**: `requestAnimationFrame`, capped at ~30 fps (skip ticks where `timestamp - prevTimestamp < 33ms`). Drives all clock display updates and timing event firing.

**Important**: all mutable clock state lives in refs (not React state) to avoid stale closures inside the RAF callback. Only display values (`setGameClockDisplay`, `setShotClockDisplay`, etc.) are React state and trigger re-renders.

## Keyboard Shortcuts

All shortcuts are registered on `window` via a single `keydown` listener. Events from `INPUT`/`TEXTAREA` elements are ignored.

| Key | Action |
|---|---|
| `Space` | Toggle shot clock start/stop (no-op if video is not playing) |
| `R` | Reset shot clock to 24 s |
| `T` | Reset shot clock to 14 s |
| `Escape` | Close guide modal if open |

## Project Files

| Path | Purpose |
|---|---|
| `src/app/page.js` | Entire application — single `'use client'` component plus `GuideContent` |
| `src/app/page.module.css` | All styles |
| `src/app/layout.js` | Root layout; loads Geist fonts via `next/font` |
| `src/app/globals.css` | Global resets |
| `public/timings.csv` | Game timing data |
| `shotclockguide.md` | Guide content (embedded as JSX in `page.js`) |
| `next.config.mjs` | `output: 'export'`, `basePath: '/shotclock'`, `NEXT_PUBLIC_BASE_PATH` |
| `Containerfile` | Two-stage podman build: Node 22 Alpine → nginx Alpine |
