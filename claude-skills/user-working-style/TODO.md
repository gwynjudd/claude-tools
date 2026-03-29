# Ideas & Todo List

Tasks and ideas to work on in the future. Maintained automatically when the user says
"add X to the todo list" or "I want to work on X in the future" (see working-style SKILL.md).

---

| # | Task | Size | ETA / Deadline | Dependencies | Status |
|---|---|---|---|---|---|
| 1 | Windows notification area tool | L | none | none | idea |
| 2 | Start of day notification tool/app | M | none | #1 (likely) | idea |
| 3 | Organise AI skill tool scripts into own directory | XS | none | none | done |
| 4 | Push skills/tools to personal GitHub | XS | none | #3 | idea |
| 5 | Book Melbourne flights (AKL→MEL) | XS | 2026-04-10 | none | done |
| 6 | Flight search MCP (Amadeus or alternative) | S | none | none | idea |

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

### #3 — Organise AI skill tool scripts into own directory
- **Summary:** Move the `.js` helper scripts (e.g. `fetch-email-html.js`, `extract-email-body.js`) out of `~/dev/tools/` into a dedicated subdirectory (e.g. `~/dev/tools/ai-helpers/`) to keep things tidy.
- **Size:** XS — mostly moving files and updating references in the email-summary skill
- **ETA / Deadline:** none
- **Dependencies:** none
- **Added:** 2026-03-28
- **Status:** idea

---

### #4 — Push skills/tools to personal GitHub
- **Summary:** Create a repo on personal GitHub and push the `~/dev/tools/claude-skills/` directory and helper scripts so they're backed up and version-controlled.
- **Size:** XS — repo setup + initial push
- **ETA / Deadline:** none
- **Dependencies:** #3 (tidy up first)
- **Added:** 2026-03-28
- **Status:** idea

---

### #5 — Book Melbourne flights (AKL→MEL)
- **Summary:** Book flights for the Melbourne Trip (Sat 11 Apr – Sat 18 Apr). Moving house — need to arrive by Fri 10 or Sat 11 Apr. Return Sat 18 Apr or later. Called Devika 2026-03-29 to confirm dates.
- **Size:** XS
- **ETA / Deadline:** 2026-04-10 (fly-out date)
- **Dependencies:** none
- **Added:** 2026-03-28
- **Status:** in-progress

---

### #6 — Flight search MCP
- **Summary:** Set up a flight search MCP so flights can be searched directly in Claude. Amadeus API was the preferred option but signup was broken. Alternatives: Duffel (requires payment info), or retry Amadeus when their signup is fixed.
- **Size:** S
- **ETA / Deadline:** none
- **Dependencies:** none
- **Added:** 2026-03-29
- **Status:** idea
