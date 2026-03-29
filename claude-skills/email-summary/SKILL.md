---
name: email-summary
description: >
  Load this skill when the user asks to check, summarise, review, or get a digest of their emails,
  or asks what emails they have received. Summarises recent emails from Gmail, filtering junk and
  highlighting what requires action. Groups results by category: family, people, bills, rental
  property, scouting, school/kids, and security alerts. Default period is last 24 hours; the user
  can specify a different period (e.g. "last week", "3d"). Supports --audit flag to also analyse
  discarded emails for missed categories.
---

# Email Summary

When this skill is invoked, fetch and summarise emails from Gmail for the specified period.

**Default period:** last 24 hours (`1d`). If the user specifies a different period (e.g. "3 days",
"last week", "2d"), convert it to Gmail query syntax (e.g. `3d`, `7d`).

**Flags:**
- `--audit` — after the standard summary, analyse the discarded emails and append an audit section (see Step 5)

---

## Step 1: Fetch Emails

Run `search_emails` with this query to get candidates, using `maxResults: 50`:

```
newer_than:{period} -category:promotions -category:updates -category:social
```

Also run a second search to catch anything in the primary inbox that might have been missed:

```
newer_than:{period} in:inbox
```

Combine and deduplicate results by message ID.

---

## Step 2: Read Each Email

For each message in the results, call `read_email` with the `messageId` to get the full sender,
subject, and body content.

If `read_email` returns a response containing "This email message was sent in HTML format" with no
readable body, the email is HTML-only with a useless plain-text fallback. In that case, fetch the
HTML directly using the tool at `~/dev/tools/fetch-email-html.js`:

```
node ~/dev/tools/ai-helpers/fetch-email-html.js <messageId> --max-chars 4000
```

This calls the Gmail API directly, extracts the HTML part, and strips it to readable plain text.
Use `--max-chars` to increase the limit if content appears truncated.

---

## Step 3: Classify

Assign each email to exactly one category. If it doesn't fit any, mark it as DISCARD.

### FAMILY
Emails from or mentioning immediate and close family members.

**Immediate family (high priority):**
- Devika Judd
- Sam Judd / Samuel Judd
- Emily Judd
- Bill Judd
- Stephanie Judd
- Alex Baker / Alexandra Baker
- Mark Baker
- Lalage Judd (also known as Lalage Sales)

**Wider family (lower priority — flag but don't elevate):**
- Any other sender with surname Judd or Baker not listed above
- Label these as "Wider family — [name]" so they're visible but not confused with immediate family

Match on: sender name, sender email address, or the name appearing in the email body as a primary subject.

### PEOPLE
Emails from real humans — personal, direct, conversational — who are not family members.
- Include: emails where the sender appears to be an individual person with a real name
- Exclude: anything sent from noreply@, no-reply@, donotreply@, info@, hello@, automated systems,
  mass-send tools (Mailchimp, etc.), or anything with an unsubscribe footer

### BILLS & FINANCES
Invoices, payment due notices, account statements, overdue notices, utility bills.
- Flag as requiring action if: payment is due or overdue, account needs attention

### RENTAL PROPERTY
Anything relating to a rental property the user owns.
- Signals: property manager, tenant, real estate agent, maintenance requests, inspections,
  lease, rent payment, property address references

### SCOUTING
Scout-related emails of any kind.
- Signals: Scouts, Scouting, scout group/troop/pack/hall, leader, commissioner, camp, jamboree,
  district, region, Scouts Australia (or any national body)
- Always flag: event invitations (include date/time), emergency contact requests,
  RSVPs required, any deadlines mentioned

### SCHOOL / KIDS
Emails from schools, school systems (e.g. Compass), or organisations relating to the user's
children.
- Signals: school name, Compass portal, teacher, principal, student name, parent notification,
  school events, reports, fees, excursions, parent-teacher conferences
- Always flag: events with dates, permission slips, fees due, time-sensitive notices

### SECURITY ALERTS
Emails about account security from trusted services (Google, Apple, Microsoft, banks, etc.).
- Include: login alerts, password changes, recovery phone/email changes, new device notifications,
  two-factor authentication changes, suspicious activity warnings
- Exclude: routine marketing from the same companies (those go to DISCARD)
- Always flag: anything that wasn't initiated by the user (unexpected changes, unrecognised devices)

### DISCARD
Everything else: newsletters, promotions, social media notifications, marketing, automated
shipping/order confirmations for routine purchases, calendar invite noise.
Do not report these individually — just count them. When `--audit` is active, retain the full
list for Step 5 rather than discarding entirely.

---

## Step 4: Present the Summary

Only show categories that have at least one email. Format as follows:

---

## Email Summary — last {period}

### 👨‍👩‍👧‍👦 Family ({count})

| Priority | From | Subject | Action | Summary | Link |
|---|---|---|---|---|---|
| 🔴/🟡/🟢 | {Name} | {Subject} | {Action or None} | {1-sentence summary} | [Open](https://mail.google.com/mail/u/0/#all/{messageId}) |

_Wider family emails shown with 🟡 priority and labelled "Wider family — [name]"_

---

### 👤 From People ({count})

**{Sender Name}** — {Subject}
[{messageId}](https://mail.google.com/mail/u/0/#all/{messageId})
> {1–2 sentence summary of what they said or want}

_(repeat for each email)_

---

### 💰 Bills & Finances ({count})

**{Sender}** — {Subject}
[{messageId}](https://mail.google.com/mail/u/0/#all/{messageId})
> {Summary}
> **Action:** {what needs to be done, e.g. "Pay $142.50 by 15 Apr"}  ← only if action needed

---

### 🏠 Rental Property ({count})

**{Sender}** — {Subject}
[{messageId}](https://mail.google.com/mail/u/0/#all/{messageId})
> {Summary}
> **Action:** {what needs to be done, if anything}

---

### 🏕️ Scouting ({count})

**{Sender}** — {Subject}
[{messageId}](https://mail.google.com/mail/u/0/#all/{messageId})
> {Summary}
> **Action items:** {bullet list — event invites with dates, emergency contact requests, RSVPs, deadlines}

---

### 🏫 School / Kids ({count})

**{Sender}** — {Subject}
[{messageId}](https://mail.google.com/mail/u/0/#all/{messageId})
> {Summary}
> **Action:** {what needs to be done, if anything — permission slips, fees, event dates}

---

### 🔐 Security Alerts ({count})

**{Sender}** — {Subject}
[{messageId}](https://mail.google.com/mail/u/0/#all/{messageId})
> {Summary}
> **Action:** {flag anything unexpected — unrecognised device, change the user didn't make, etc.}

---

_{Total} emails checked · {N} junk/automated skipped_

---

## Step 5: Audit Section (only when `--audit` is active)

After the standard summary, go through every DISCARD email and do two things:

### 5a — Missed category candidates

Look for any discarded email that a reasonable person might actually want to know about.
Consider things like:
- Emails from organisations the user is a member of (clubs, community groups, schools, church, etc.)
- Government or council correspondence
- Health-related emails (appointments, reminders, test results)
- Work-related emails that don't fit "people" (team tools, HR systems, etc.)
- Anything that contains a date, deadline, or required action — even if automated

For each candidate, briefly note what it is and why it might matter. Then suggest whether it
warrants a new permanent category.

### 5b — Discard breakdown

Group all remaining discarded emails by type and count them. Format as:

---

### 🔍 Discard Audit

**Possible missed categories:**
- **{Sender / Type}** — {Subject or description} · _{Why it might matter}_
  _(if none found, say "Nothing obvious missed")_

**What was discarded:**
| Category | Count |
|---|---|
| Newsletters & subscriptions | {n} |
| Promotional / marketing | {n} |
| Shipping & order notifications | {n} |
| Social media alerts | {n} |
| Automated system notifications | {n} |
| Calendar noise | {n} |
| Other automated | {n} |

_{Only show rows with count > 0}_

---

## Notes

- If no interesting emails were found, say so clearly rather than showing empty sections
- Scouting event dates should always be shown prominently — bold the date
- Keep summaries short — this is a digest, not a transcript
- If the user asks to act on an email (reply, mark, delete), use the appropriate Gmail MCP tool

---

## Future Enhancements (not yet active)

When a calendar skill is available, this skill should be updated to:
- Offer to add scouting events and deadlines directly to the calendar
- Create tasks or reminders from action items found in emails
