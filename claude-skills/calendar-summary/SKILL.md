---
name: calendar-summary
description: >
  Load this skill when the user asks to check, summarise, or review their calendar, upcoming
  events, schedule, or asks what's coming up. Fetches events from all Google calendars and
  presents them prioritised by urgency and preparation required. Default window is the next
  4 weeks. The user can specify a different window (e.g. "next week", "2 weeks", "3 months").
---

# Calendar Summary

Fetch upcoming events from all calendars and present them prioritised by urgency and
preparation required. Uses the `cal` CLI — no MCP calls needed.

**Default window:** next 4 weeks (`4w`). Convert user-specified windows to CLI format:
"next week" → `1w`, "2 weeks" → `2w`, "next month" → `1m`, "3 months" → `3m`.

---

## Step 1: Fetch events

```bash
scripts/fetch-events.sh --window {window}
```

Save the output to `tmp/fetch.json` using the **Write tool** (pre-approved, no prompt).

Events with `cached: true` already have `prep_level` and `notes` filled in.
Events with `cached: false` need AI judgement.

---

## Step 2: Judge uncached events

For each event where `cached: false`, assign:
- `prep_level`: `HIGH`, `MEDIUM`, or `LOW`
- `notes`: one sentence — what prep is needed, or why it's at this level

Read `config/prep-level-criteria.md` for the definitions.

**Devika's calendar** (`n8ejujfh7eo85d1b6ond4m5688m4d556@import.calendar.google.com`):
include events relevant to both of you (birthdays, shared appointments). Skip events
clearly personal to her (webinars, spiritual sessions, self-improvement talks).

Produce a compact judgements array (only `id`, `prep_level`, `notes`):
```json
[{"id": "...", "prep_level": "HIGH", "notes": "..."}]
```

Write it to `tmp/judgements.json` using the **Write tool** (pre-approved, no prompt).

If all events are cached (`cached: false` count is zero), skip this step and proceed to Step 3 with an empty array `[]`.

---

## Step 3: Apply judgements, update cache, and present

```bash
scripts/apply-judgements.sh --fetch tmp/fetch.json --format human < tmp/judgements.json
```

This patches the fetch output with your judgements, updates the cache, and outputs the
three-tier grouped table (🔴 Urgent / 🟡 Coming up / 🟢 On the radar).

---

## CRUD operations

To create, update, delete, or respond to an event, use:
```bash
scripts/manage-event.sh create  --title "..." --start "2026-05-01T10:00" --end "2026-05-01T11:00"
scripts/manage-event.sh update  --id <eventId> --calendar <calId> --title "..."
scripts/manage-event.sh delete  --id <eventId> --calendar <calId>
scripts/manage-event.sh respond --id <eventId> --calendar <calId> --status accepted|declined|tentative
```

---

## Auth

If token errors occur:
```bash
scripts/calendar-reauth.sh
```

To migrate tokens from the old google-calendar-mcp store:
```bash
node dist/cli.js auth migrate
```
