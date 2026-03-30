# Ideas & Todo List

Tasks and ideas to work on in the future. Maintained automatically when the user says
"add X to the todo list" or "I want to work on X in the future" (see working-style SKILL.md).

Completed XS tasks are removed from the list. Larger completed tasks may be kept for reference.

---

| # | Task | Size | ETA / Deadline | Dependencies | Status |
|---|---|---|---|---|---|
| 1 | Windows notification area tool | L | none | none | idea |
| 2 | Start of day notification tool/app | M | none | #1 (likely) | done |
| 3 | Flight search MCP (Amadeus or alternative) | S | none | none | blocked |
| 4 | Todo list app | M | none | none | idea |
| 5 | Discord bot — Spotify playlist aggregator | M | none | none | idea |
| 6 | Plan My Day — cross-device (phone + work laptop) | XL | none | none | idea |

---

## Details

### #1 — Windows notification area tool
- **Summary:** A system tray / notification area app for Windows (running from WSL or native) to surface useful information or alerts.
- **Size:** L — building a persistent tray app is non-trivial; technology choice (Electron, .NET, Java tray) TBD
- **ETA / Deadline:** none
- **Dependencies:** none
- **Added:** 2026-03-28
- **Status:** idea

---

### #2 — Start of day notification tool/app
- **Summary:** A morning briefing tool that summarises the day ahead — likely combining the calendar-summary and email-summary skills into a single daily digest, delivered as a notification or dashboard.
- **Size:** M — core logic is mostly wiring existing skills together; delivery mechanism (notification, terminal, web page) TBD
- **ETA / Deadline:** none
- **Dependencies:** #1 (if delivered via Windows notification area); email-summary and calendar-summary skills already exist
- **Added:** 2026-03-28
- **Status:** idea

---

### #3 — Flight search MCP
- **Summary:** Set up a flight search MCP so flights can be searched directly in Claude. Amadeus self-service portal is being decommissioned July 2026 — dead end. Duffel requires payment info (not preferred). Other options: AviationStack (free tier, 100 req/month), RapidAPI flight search APIs, or scraping-based tools (unreliable). May not be worth the effort for occasional use — WebSearch is sufficient for one-off queries.
- **Size:** S
- **ETA / Deadline:** none
- **Dependencies:** none
- **Added:** 2026-03-29
- **Status:** blocked

---

### #5 — Discord bot — Spotify playlist aggregator
- **Summary:** A Discord bot that monitors a channel for Spotify track/playlist links and automatically adds them to a designated Spotify playlist. Useful for collecting music recommendations shared in a Discord server.
- **Size:** M — needs Discord bot setup, Spotify API OAuth, and link parsing logic
- **ETA / Deadline:** none
- **Dependencies:** none
- **Added:** 2026-03-29
- **Status:** idea

---

### #6 — Plan My Day — cross-device (phone + work laptop)
- **Summary:** Extend Plan My Day beyond this laptop so it's usable on Android phone and work laptop. Requires a backend (calendar/email/todo integration), a CRUD API exposing the skill's features, a PWA for Android (background polling + notifications), and a Claude skill that calls the API for use on the work laptop. XL effort — needs to be broken into subtasks before implementation begins.
- **Size:** XL — multi-component system; to be decomposed into subtasks (backend, API, PWA, skill) before work starts
- **ETA / Deadline:** none
- **Dependencies:** #4 (todo list app likely feeds into backend)
- **Added:** 2026-03-31
- **Status:** idea

---

### #4 — Todo list app
- **Summary:** A small app to read, summarise, and add items to the todo list. Should replace the current markdown file approach with something more interactive — could be a CLI, web UI, or feed into the start-of-day notification (#2).
- **Size:** M
- **ETA / Deadline:** none
- **Dependencies:** none (but could integrate with #2 start-of-day tool)
- **Added:** 2026-03-29
- **Status:** idea
