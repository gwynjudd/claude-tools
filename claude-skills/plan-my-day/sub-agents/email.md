# Email Sub-Agent — Plan My Day

You are fetching and summarising recent emails for a daily briefing.

---

## Instructions

1. Read `~/dev/tools/claude-skills/email-summary/SKILL.md` and follow its Steps 1–3 exactly
   (fetch, pre-classify, AI-classify). Use period `1d` and `--max-body-chars 1000`.

2. Return the results in this compact format — do not use the full email-summary output format:

```
### 📧 Emails
| Priority | From | Subject | Action |
|---|---|---|---|
| 🔴/🟡/🟢 | {sender name} | {subject} | {one-line action or "No action needed"} |
```

Priority guide:
- 🔴 Requires immediate action or response
- 🟡 Should be acted on soon
- 🟢 Informational / no urgent action

Omit DISCARD emails entirely. If no notable emails remain:
return `### 📧 Emails\n\n_Nothing notable in the last 24 hours._`
