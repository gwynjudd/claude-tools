# Plan my Day application

To explore some ideas of creating an application using the claude client SDK or agent SDK in typescript

Basically, it will be a tool that will encompass the behaviour of the plan-my-day tool

- takes options to configure behaviour
- performs all of the standard tool calls that PMD would do
- spawn sub-agents to perform the AI decision making like categorising emails
- present the result to the caller

The plan-my-day skill might then just call the tool which will do most of the work.

## Advantages over the current approach

- should be faster/less overhead, as most of the work is done in typescript, only the AI decision making will be done by agents
- less token usage for the same reason
- simpler to reason on and understand - the current architecture is becoming quite unweildy
- more secure - correctly implemented, the agents will require no permissions whatsoever

## Agent SDK vs. Client SDK

Agent SDK: lets me create agents which can use built-in tools, hooks, subagents etc
Client SDK: lets me use the claude API directly to create applications which have AI features

My initial thinking is, the client SDK is a better fit. It will allow me to create an application that integrates AI features (such as "classify an email"), using the existing tools which have been created.
https://platform.claude.com/docs/en/api/sdks/typescript

On further consideration, perhaps the Agent SDK is what I want. I can still create an application, however it may define and use agents using the SDK and use those to perform the required AI decision making.
https://code.claude.com/docs/en/agent-sdk/typescript

## Goal:

To create an application that can help plan the users day.

### Main features:

Calendar
Todo
Tasks
Email

### Architecture

It's clear to me that the architecture of the PMD skill and the other skills isn't quite right.

The PMD skill should encapsulate all of the behaviour required to do the day planning feature. It should not call the other skills at all.

- calendar-summary - should really be limited to the CRUD activities for things like create, update, delete, and respond to events
- email-summary - probably shouldn't exist at all. I don't edit, reply to or create new emails in calude code

Only the tasks marked as (** AI **) should go through an agent.

### Calendar

- Fetch calendar events for the window [yesterday, today+30d)
- For each event
    - An event is considered cached if it exists in the cache, AND the cache fingerprint has not changed
    - For events in devika's calendar, include events which may be relevant to both of us (birthdays, shared appointments, etc), skip events which are personal to her
    - (** AI **) perform AI classification in the prep level criteria (HIGH, MEDIUM, LOW) on all events which are not cached or skipped
- Update the cache with the fetched event including prep level criteria

Example, using the Agent SDK:

```typescript
// json contains the set of events to be classified (cached and skipped events would be filtered out)
const json = `
...
`;

const prompt = `
You are classifying a set of calendar events for a daily briefing.

The set of events is given by the following JSON:

${json}

For each event in the JSON, assign:
- "prep_level": "HIGH", "MEDIUM", or "LOW"
- "notes": one sentence — what prep is needed, or why it's flagged

# Prep Level Criteria

Use these definitions when assigning a preparation level to a calendar event.
Base the assessment on the event title, description, location, duration, and calendar.

For events in **Devika's calendar** ("n8ejujfh7eo85d1b6ond4m5688m4d556@import.calendar.google.com"):
only include events relevant to both of you (birthdays, shared appointments, family events).
Skip events clearly personal to her (webinars, spiritual sessions, self-improvement talks,
meditation/yoga she's attending alone).

---

## HIGH — significant planning, logistics, or physical/mental preparation required

- Multi-day travel, trips, or outdoor adventures (tramping, hiking, camping, crossing, climbing)
- Flights, ferry bookings, or interstate/international travel
- Large organised events (camps, jamborees, conferences, competitions)
- Medical or surgical procedures
- Exams, assessments, or formal presentations
- Hosting a gathering or party at home
- Any event that requires equipment, packing, booking, or coordination with others

## MEDIUM — some preparation or coordination needed, but manageable same-week

- Single-day scout activities, hikes, or outings
- Medical, dental, or specialist appointments
- Parent-teacher interviews or school events
- Scheduled maintenance (house, car, vet)
- Social events (dinners, parties you're attending)
- Day trips or local outings
- Work-related meetings or training sessions

## LOW — minimal or no preparation required

- Recurring reminders (flea treatment, medication, etc.)
- Brief routine appointments (haircut, etc.)
- Regular weekly/monthly meetings with no special prep
- General reminders or admin tasks

Once you have assigned all judgements, return them in the JSON format:

[
  {"id": "<event-id>", "prep_level": "HIGH", "notes": "<one sentence>"},
  {"id": "<event-id>", "prep_level": "LOW",  "notes": "<one sentence>"}
]

`;
for await (const message of query({ prompt })) {
	if (message.type === 'result') {
		if (message.subtype === 'success') {
			console.log(message.result); // parse JSON, update cache
		} else {
			console.log(`Stopped: ${message.subtype}`);
		}
	}
}
```

#### Priority matrix

```markdown
             HIGH prep  MEDIUM prep  LOW prep
IMMINENT       🔴          🔴           🟡
VERY_SOON      🔴          🔴           🟡
THIS_WEEK      🔴          🟡           🟢
NEXT_WEEK      🟡          🟡           🟢
THIS_MONTH     🟡          🟢           🟢
LATER          🟢          🟢           —
```

#### Output

Output for this section will show the following sections:

* yesterday
* today
* heads up
* coming up

```markdown
### ⏮ Yesterday — anything slipped?

- {event} — _suggestion: ..._

---

### 📅 Today

| Time                    | Event   | Notes                  |
| ----------------------- | ------- | ---------------------- |
| {HH:MMam/pm or All day} | {event} | {location or key note} |

**Heads up:** you have [event] at [time] — ... ← weekdays only, 8am–6pm events

**Coming up (next 30 days):**

- {Tue 7 Apr} — {event} _{🔴 or 🟡}_
```

### Todo

No AI required.

* Read tasks list for the status `in-progress`
  * Skip tasks with `status: "done"` or `status: "blocked"`.
* Read the daily habit list
* Count the tasks list for the status `idea`

For each task, add a **Best time** suggestion:
- **Workday ok** — lighter tasks: quick phone calls, brief admin, online purchases, short appointments
- **Evening or weekend** — heavier tasks: errands, multi-hour projects, physical tasks, things needing focus
- If today is a weekend, omit the distinction and leave Best time blank or note "Any time"

#### Output

Output for this section:

```markdown

### 🔁 Daily Habits
- [ ] {habit title}

---

### ✅ Todo

#### In progress
| # | Task | Size | Status | Best time |
|---|---|---|---|---|
| {id} | {title} | {size} | {status} | {suggestion} |

(If no in-progress tasks: _Nothing in progress._)

#### Idea backlog
_{N} ideas — ask to see the full list._

```

### Tasks

No AI required.

- Fetch all tasks from all calendars
- Sync tasks to the PMD database
    - mark as added, completed, or updated

#### Output

Output for this section:

```typescript
const total = added + completed + updated;
return total === 0
	? 'Google Tasks: nothing new'
	: `Google Tasks: added ${added}, completed ${completed}, updated ${updated}`;
```


### Email

- Fetch all emails in the last 1 day
    - Consider, should probably fetch all emails since the last time it was run to ensure none are missed
- Perform pre-classification on the emails
    - unclassified
    - has attachments not downloaded
    - fully processed (from cache)
- (** AI **) Perform AI classification on all unclassified emails
- Download attachments for emails in RENTAL_PROPERTY or GIVING

```typescript
const prompt = `
You are classifying a set of emails for a daily briefing.

The set of emails is given by the following JSON:

${json}

For each email, assign it to exactly one category. If it doesn't fit any,
mark it as "DISCARD".

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
- Known senders: Aspire Property Management (aspireproperty.co.nz, email.propertyme.com),
  any sender with "property management" in their name or email domain
- Always include: financial statements, rental market updates, maintenance completions,
  payment date notices, any query about the property or tenancy

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

### GIVING
Emails related to charitable donations or organisations the user donates to.
- Include: donation receipts, tax receipts, thank-you emails from charities, campaign updates from
  charities the user has donated to, requests for donations from known organisations
- Exclude: cold solicitations from unknown organisations (those go to DISCARD)
- Always flag: tax receipts (useful for records), donation confirmations, any action required

**Known organisations:**
- Barnardos
- Red Cross
- Blind Low Vision NZ
- Invisible Girl Project
- Save the Children

### SECURITY ALERTS
Emails about account security from trusted services (Google, Apple, Microsoft, banks, etc.).
- Include: login alerts, password changes, recovery phone/email changes, new device notifications,
  two-factor authentication changes, suspicious activity warnings
- Exclude: routine marketing from the same companies (those go to DISCARD)
- Always flag: anything that wasn't initiated by the user (unexpected changes, unrecognised devices)

### DISCARD
Everything else: newsletters, promotions, social media notifications, marketing, automated
shipping/order confirmations for routine purchases, calendar invite noise.
Do not report these individually — just count them. When "--audit" is active, retain the full
list for Step 4 rather than discarding entirely.

After classifying each email in "unclassified" (including DISCARDs), return the results in the following json format:

[
  {"id": "<message-id>", "category": "<category>"}
]
`;
for await (const message of query({ prompt })) {
	if (message.type === 'result') {
		if (message.subtype === 'success') {
			console.log(message.result); // parse JSON, update cache
		} else {
			console.log(`Stopped: ${message.subtype}`);
		}
	}
}
```

#### Output

Output for this section:

```markdown
### 📧 Emails

| Priority | From          | Subject   | Action                                  |
| -------- | ------------- | --------- | --------------------------------------- |
| 🔴/🟡/🟢 | {sender name} | {subject} | {one-line action or "No action needed"} |
```