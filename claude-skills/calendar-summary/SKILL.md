---
name: calendar-summary
description: >
  Load this skill when the user asks to check, summarise, or review their calendar, upcoming
  events, schedule, or asks what's coming up. Fetches events from all Google calendars and
  presents them prioritised by urgency and preparation required. Default window is the next
  4 weeks. The user can specify a different window (e.g. "next week", "2 weeks", "3 months").
---

# Calendar Summary

When this skill is invoked, fetch upcoming events from all calendars and present them
prioritised by a combination of how soon they are and how much preparation they require.

**Default window:** next 4 weeks. If the user specifies a different window (e.g. "next week",
"2 weeks", "next month"), convert it to a `timeMax` offset from today.

---

## Step 1: Fetch Calendars

Call `mcp__gcal__list-calendars` to get the full list. Note the `id` and `summary` for each.

---

## Step 2: Fetch Events

**Excluded calendars** — omit these from all fetches and output:
- `scouts.nz_qsicfe0rdfi30sr4s2e8dqaa44@group.calendar.google.com` — Scouts NZ National Calendar
- `scouts.nz_qqtoqo377tpkctugnamud25lq8@group.calendar.google.com` — UNI Regional Calendar 2019
- `r240u21ogp03cjfi34ra5ah0io@group.calendar.google.com` — UNI Territory Training Calendar
- `classroom101607816945687842931@group.calendar.google.com` — First Mt Albert Scouts Scouts
- `1stmtalbertstjudes@group.scouts.nz` — 1st Mt Albert St Judes (scout group calendar)
- `a91493d1mv7jja03hhusglpabs@group.calendar.google.com` — MoanaRua Zone Calendar

**Calendar context:**
- `n8ejujfh7eo85d1b6ond4m5688m4d556@import.calendar.google.com` — this is **Devika's imported calendar**. Include events that are likely relevant to both of you (birthdays, family reminders, shared appointments). Skip events that are clearly personal to her only (webinars, spiritual sessions, self-improvement talks she's attending).

Call `mcp__gcal__list-events` with:
- `calendarId`: all calendar IDs from Step 1 **except the excluded ones above** as an array
- `timeMin`: today at 00:00:00 (local time, NZ timezone: `Pacific/Auckland`)
- `timeMax`: today + window at 23:59:59
- `timeZone`: `Pacific/Auckland`
- `fields`: `["description", "location", "attendees", "recurrence"]`

---

## Step 3: Assess Each Event

For each event, determine two scores:

### 3a — Nearness score

Calculate days until the event starts (use start date for all-day events):
- **Today / already started (multi-day):** 0 days → `IMMINENT`
- **1–3 days:** → `VERY SOON`
- **4–7 days:** → `THIS WEEK`
- **8–14 days:** → `NEXT WEEK`
- **15–28 days:** → `THIS MONTH`
- **29+ days:** → `LATER`

### 3b — Preparation level

Use judgement to assign one of three levels based on the event title, description, location,
duration, and calendar:

**HIGH** — significant planning, logistics, or physical/mental preparation required:
- Multi-day travel, trips, or outdoor adventures (tramping, hiking, camping, crossing, climbing)
- Flights, ferry bookings, or interstate/international travel
- Large organised events (camps, jamborees, conferences, competitions)
- Medical or surgical procedures
- Exams, assessments, or formal presentations
- Hosting a gathering or party at home
- Any event that requires equipment, packing, booking, or coordination with others

**MEDIUM** — some preparation or coordination needed, but manageable same-week:
- Single-day scout activities, hikes, or outings
- Medical, dental, or specialist appointments
- Parent-teacher interviews or school events
- Scheduled maintenance (house, car, vet)
- Social events (dinners, parties you're attending)
- Day trips or local outings
- Work-related meetings or training sessions

**LOW** — minimal or no preparation required:
- Recurring reminders (flea treatment, medication, etc.)
- Brief routine appointments (haircut, etc.)
- Regular weekly/monthly meetings with no special prep
- General reminders or admin tasks

### 3c — Combined priority

Apply this matrix:

| | HIGH prep | MEDIUM prep | LOW prep |
|---|---|---|---|
| IMMINENT (today/started) | 🔴 | 🔴 | 🟡 |
| VERY SOON (1–3 days) | 🔴 | 🔴 | 🟡 |
| THIS WEEK (4–7 days) | 🔴 | 🟡 | 🟢 |
| NEXT WEEK (8–14 days) | 🟡 | 🟡 | 🟢 |
| THIS MONTH (15–28 days) | 🟡 | 🟢 | 🟢 |
| LATER (29+ days) | 🟢 | 🟢 | — |

Events scoring `—` (LATER + LOW prep) are omitted from the main summary unless there are
fewer than 5 events total, in which case include all.

---

## Step 4: Present the Summary

Sort all events by priority (🔴 first, then 🟡, then 🟢), then by date within each tier.
Group by priority tier with a heading for each.

---

## Calendar Summary — next {window}

### 🔴 Urgent / Needs attention now

| Date | Event | Calendar | Prep | Notes |
|---|---|---|---|---|
| {date} | {summary} | {calendar name} | High/Medium | {1-sentence note — what prep is needed, or why it's flagged} |

### 🟡 Coming up — act soon

| Date | Event | Calendar | Prep | Notes |
|---|---|---|---|---|
| … | … | … | … | … |

### 🟢 On the radar

| Date | Event | Calendar | Prep | Notes |
|---|---|---|---|---|
| … | … | … | … | … |

---

_{N} events across {M} calendars · next {window}_

---

## Formatting rules

- **Date format:** use a human-readable format — e.g. `Sat 28 Mar`, `Fri 3 Apr – Sun 5 Apr` for multi-day
- **Calendar name:** use the friendly `summaryOverride` if set, otherwise `summary`; shorten long names
  (e.g. "Regional Training Calendar - Upper North Island" → "UNI Training")
- **Notes column:** keep to one sentence. Focus on what action is needed or why the priority is what it is.
  Examples: "Pack gear and arrange transport", "Confirm RSVP", "Book before Friday", "No action needed"
- If an event has a `location`, include it in the Notes if it adds useful context
- If an event has attendees, note if anyone else is involved (e.g. "with Devika")
- Do not show events the user has declined

---

## Notes

- If no events were found, say so clearly
- If the user asks to create, update, or delete an event, use the appropriate `mcp__gcal__` tool
- If the user asks to RSVP to an event, use `mcp__gcal__respond-to-event`
- When suggesting calendar links, use the `htmlLink` field from the event
