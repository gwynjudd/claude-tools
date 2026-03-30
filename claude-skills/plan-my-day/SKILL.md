---
name: plan-my-day
description: >
  Load this skill when the user asks to plan their day, get a morning briefing, see what's
  on today, or asks "what's on today" / "plan my day" / "what do I have on". Combines
  today's calendar, recent emails, and open todo items into a single morning digest.
---

# Plan My Day

Produces a unified morning briefing combining calendar, email, and todo list.

When this skill runs, record the current timestamp:
```bash
date -Iseconds > ~/dev/tools/claude-skills/plan-my-day/.last-run
```

---

## Step 1: Today's Calendar

First, call `mcp__gcal__get-current-time` to get the authoritative current date and time in `Pacific/Auckland` timezone. Use this to calculate:
- **yesterday:** the calendar day before the current NZ date (00:00:00 – 23:59:59)
- **today:** the current NZ date (00:00:00 – 23:59:59)
- **+30 days:** current NZ date + 30 days at 23:59:59

Make two calls to `mcp__gcal__list-events` with the same calendars and filters for both:
- `calendarId`: `["gwynjudd@gmail.com", "family06336024575101905076@group.calendar.google.com", "n8ejujfh7eo85d1b6ond4m5688m4d556@import.calendar.google.com"]`
- `timeZone`: `Pacific/Auckland`
- `fields`: `["description", "location", "attendees"]`

**Call A — yesterday:** `timeMin` yesterday 00:00:00, `timeMax` yesterday 23:59:59. Look for anything that may have slipped or needs rescheduling — tasks, reminders, or appointments that were due yesterday and may not have been completed.

**Call B — today + next 30 days:** `timeMin` today 00:00:00, `timeMax` today+30 23:59:59. Today's events shown in full; the rest used for the "coming up" section filtered to 🔴/🟡 priority using the nearness × preparation matrix from the calendar-summary skill.

Filter out all-day placeholder events (e.g. "Home") and events from Devika's imported calendar that are clearly personal to her (webinars, spiritual sessions).

---

## Step 2: Email Summary

Call `mcp__gmail__search_emails` with:
```
newer_than:1d -category:promotions -category:updates -category:social
```
and also `newer_than:1d in:inbox`.

Deduplicate, read each with `mcp__gmail__read_email`. Apply the same classification rules as the email-summary skill (FAMILY, PEOPLE, BILLS, RENTAL PROPERTY, SCOUTING, SCHOOL/KIDS, SECURITY ALERTS — discard the rest). For HTML-only emails use `node ~/dev/tools/ai-helpers/fetch-email-html.js <id> --max-chars 4000`.

For this briefing, keep it brief — one line per email, action items only.

---

## Step 3: Todo List

Read `~/dev/tools/claude-skills/user-working-style/TODO.md`. Show only items with status `idea` or `in-progress`, ordered by the table. Skip `done` and `blocked` items.

---

## Step 4: Present the Briefing

Format as follows:

---

## Plan My Day — {Day, D Month YYYY}

### ⏮ Yesterday — anything slipped?
- {event/reminder} — _{suggestion: reschedule / follow up / mark done}_

_If nothing to flag: omit this section entirely._

---

### 📅 Today
| Time | Event | Notes |
|---|---|---|
| {time or All day} | {event} | {location or key note} |

_If nothing today: "Nothing in the calendar today."_

**Coming up (next 30 days):**
- {Tue 7 Apr} — {event} _{priority: 🔴/🟡/🟢}_
- _(show 🔴 and 🟡 items only; skip routine low-prep recurring events)_

---

### 📧 Emails
| Priority | From | Subject | Action |
|---|---|---|---|
| 🔴/🟡/🟢 | {name} | {subject} | {one-line action or "No action"} |

_If no notable emails: "Nothing notable in the last 24 hours."_

---

### ✅ Todo
| # | Task | Size | Status |
|---|---|---|---|
| {#} | {task} | {size} | {idea/in-progress} |

---

## Notes

- Keep the briefing tight — this is a quick morning scan, not a deep dive
- If the user asks to act on anything (reply to email, create calendar event, update todo), do it
- After presenting, ask if they'd like to dig into anything
