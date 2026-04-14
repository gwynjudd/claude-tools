# Calendar Sub-Agent — Plan My Day

You are fetching and formatting the calendar section of a daily briefing.
All fetching, scoring, and formatting is handled by the `cal` CLI — no MCP calls needed.

---

## Step 1: Fetch and score events

```bash
~/dev/tools/claude-skills/calendar-summary/scripts/fetch-events.sh --window 30d --yesterday > ~/dev/tools/claude-skills/calendar-summary/tmp/pmd-cal.json
```

Then read `~/dev/tools/claude-skills/calendar-summary/tmp/pmd-cal.json`.

---

## Step 2: Judge uncached events (if any)

Find all events in the JSON where `cached: false`. If there are none, skip to Step 3.

For each uncached event, assign:
- `prep_level`: `HIGH`, `MEDIUM`, or `LOW`
- `notes`: one sentence — what prep is needed, or why it's flagged

Read `~/dev/tools/claude-skills/calendar-summary/config/prep-level-criteria.md` for the definitions.

**Devika's calendar** (`n8ejujfh7eo85d1b6ond4m5688m4d556@import.calendar.google.com`):
include events relevant to both of you (birthdays, shared appointments, family events).
Skip events clearly personal to her (webinars, spiritual sessions, self-improvement talks,
meditation/yoga she's attending alone).

Once you have assigned all judgements, write them to the skill's tmp directory (NEVER to
`/tmp/`) and pipe to `apply-judgements.sh`:

```bash
cat > ~/dev/tools/claude-skills/calendar-summary/tmp/judgements.json << 'EOF'
[
  {"id": "<event-id>", "prep_level": "HIGH", "notes": "<one sentence>"},
  {"id": "<event-id>", "prep_level": "LOW",  "notes": "<one sentence>"}
]
EOF
cat ~/dev/tools/claude-skills/calendar-summary/tmp/judgements.json \
  | ~/dev/tools/claude-skills/calendar-summary/scripts/apply-judgements.sh \
      --fetch ~/dev/tools/claude-skills/calendar-summary/tmp/pmd-cal.json \
      --format pmd
```

This script patches the events, updates the cache, and prints the formatted calendar
section. Return that output verbatim.

---

## Step 3: Present (all events already cached)

If all events were cached (no judgements needed):

```bash
~/dev/tools/claude-skills/calendar-summary/scripts/present.sh \
  --format pmd \
  --input ~/dev/tools/claude-skills/calendar-summary/tmp/pmd-cal.json
```

Return the output verbatim as the calendar section of the briefing.
