# Plan: Refactor calendar-summary for lower token usage

## Status

- [x] Step 1: `tools/google-oauth/` — library
- [x] Step 2: calendar-summary TypeScript scaffold
- [x] Step 3: `calendar-api.ts`
- [x] Step 4: `commands/events-fetch.ts` + `types.ts` + unit tests
- [x] Step 5: `commands/cache-update.ts` + system test
- [x] Step 6: `commands/events-present.ts` (all 3 formats)
- [x] Step 7: Shell wrappers + settings + SKILL.md
- [x] Step 8: `commands/event-manage.ts`
- [x] Step 9: `plan-my-day/sub-agents/calendar.md` thin wrapper
- [x] Step 10: `config/prep-level-criteria.md` + update references

---

## Context

Every invocation of the calendar-summary skill burns tokens on purely mechanical work (fetching calendars, computing nearness scores, formatting tables). The only step that requires AI judgement is assigning a preparation level (HIGH/MEDIUM/LOW) to each event — and even that is repeated each run for events the AI has already seen. Additionally, `plan-my-day/sub-agents/calendar.md` duplicates ~80% of calendar-summary's logic.

This plan introduces:
- A shared `google-oauth` library (unified token store, used by all skills)
- A single `cal` CLI (same pattern as plan-my-day's `pmd` CLI)
- An event judgement cache (AI only judges new/changed events)
- A thin plan-my-day calendar sub-agent that defers entirely to `cal`

---

## Environment / Key Paths

**Existing token files (to migrate FROM):**
- Calendar: `~/.config/google-calendar-mcp/tokens.json` — multi-account format `{"normal": {access_token, refresh_token, expiry_date, scope, token_type}}`
- Gmail: `~/.gmail-mcp/credentials.json` — flat format `{access_token, refresh_token, expiry_date, scope, token_type}`
- Tasks: `~/.google-tasks-mcp/credentials.json` — flat format (same as Gmail)

**Existing OAuth keys (same GCP project for all three):**
- `~/.calendar-mcp/gcp-oauth.keys.json` — format: `{installed: {client_id, client_secret, redirect_uris, ...}}`
- `~/.gmail-mcp/gcp-oauth.keys.json` — same format, same GCP project

**New unified locations:**
- `~/.config/google-oauth/tokens.json` — merged token store
- `~/.config/google-oauth/gcp-oauth.keys.json` — copy from either existing keys file

**Reference implementations:**
- OAuth pattern: `~/dev/tools/claude-skills/email-summary/src/gmail-api.ts` + `gmail-reauth.ts`
- CLI pattern: `~/dev/tools/claude-skills/plan-my-day/tools/src/cli.ts` + `scripts/_pmd.sh`
- Build config pattern: `~/dev/tools/claude-skills/plan-my-day/tools/package.json` + `tsup.config.ts`

**Two-copies rule:** Every skill file under `~/dev/tools/claude-skills/<skill>/` must be synced to `~/.claude/skills/<skill>/`. The `google-oauth` library goes under `~/dev/tools/google-oauth/` (not under `claude-skills/` — it's a shared library, not a skill).

**Event cache location:** `~/.config/calendar-summary/event-cache.json`

---

## New Component: `tools/google-oauth/`

A TypeScript **library** (not a CLI). Referenced as a local npm package by each skill.

```
tools/google-oauth/
├── src/
│   ├── index.ts          # Public API exports
│   ├── token-store.ts    # Read/write ~/.config/google-oauth/tokens.json
│   └── reauth.ts         # OAuth authorization_code flow (local redirect server on port 3000)
├── env/
│   └── gcp-oauth.keys.json.example   # Documents shape only; real file at ~/.config/google-oauth/
├── package.json          # name: "@gwynj/google-oauth", exports: "./dist/index.js"
├── tsconfig.json
└── tsup.config.ts        # entry: src/index.ts, format: esm, no shebang (library)
```

**Credential files** live at `~/.config/google-oauth/` — user state, gitignored, not in project:
```json
// tokens.json
{
  "calendar": { "normal":  { "access_token": "...", "refresh_token": "...", "expiry_date": 1234567890, "scope": "...", "token_type": "Bearer" } },
  "gmail":    { "default": { ... } },
  "tasks":    { "default": { ... } }
}
```

**Public API (`src/index.ts`):**
```typescript
// Returns a valid access token, refreshing silently if expired (60s buffer)
export async function getAccessToken(
  service: 'calendar' | 'gmail' | 'tasks',
  account?: string   // default: 'normal' for calendar, 'default' for gmail/tasks
): Promise<string>

// Full OAuth authorization_code flow: prints URL, starts server on :3000, writes token
export async function reauth(
  service: 'calendar' | 'gmail' | 'tasks',
  account?: string
): Promise<void>

// One-time migration: calendar tokens only (gmail/tasks stay on their own paths for now)
export async function migrateCalendarTokens(): Promise<void>
```

**No standalone CLI.** `cal auth reauth` in calendar-summary's CLI calls `reauth('calendar')`.

**`calendar-summary/package.json` dependency:**
```json
"@gwynj/google-oauth": "file:../../google-oauth"
```

**Migration scope — calendar only.** `migrateCalendarTokens()` reads `~/.config/google-calendar-mcp/tokens.json` (already multi-account `{"normal": {...}}`) and writes it into `~/.config/google-oauth/tokens.json` under the `"calendar"` key. Gmail and Tasks are out of scope — those skills continue to use their own existing token paths unchanged.

The `gmail` and `tasks` keys in the token store are reserved for future migrations. `getAccessToken` already accepts `service` to make those drop-in, but nothing populates those keys yet.

**Future (out of scope here):** `email-summary/src/gmail-api.ts` and `plan-my-day` gtasks auth swap their own token handling for `import { getAccessToken } from '@gwynj/google-oauth'`, at which point siblings of `migrateCalendarTokens` handle those services.

**Refresh logic** (from `gmail-api.ts` pattern — use same approach):
```typescript
if (token.expiry_date && Date.now() < token.expiry_date - 60_000) return token.access_token;
// POST https://oauth2.googleapis.com/token with grant_type=refresh_token
// Read keys from ~/.config/google-oauth/gcp-oauth.keys.json (.installed.client_id/secret)
// Update tokens.json atomically (write to temp file, rename)
```

---

## calendar-summary CLI Structure

Single `cal` CLI with subcommands, same pattern as plan-my-day's `pmd`:

```
tools/claude-skills/calendar-summary/
├── src/
│   ├── cli.ts                  # Router — dispatches to command modules
│   ├── calendar-api.ts         # Google Calendar REST helpers (raw fetch, no MCP)
│   ├── types.ts                # Shared interfaces (exported)
│   └── commands/
│       ├── events-fetch.ts     # cal events fetch
│       ├── events-present.ts   # cal events present
│       ├── cache-update.ts     # cal cache update
│       └── event-manage.ts     # cal event create|update|delete|respond
├── __tests__/
│   ├── nearness.test.ts
│   ├── fingerprint.test.ts
│   ├── priority-matrix.test.ts
│   ├── present.test.ts
│   └── system/
│       └── events-fetch.system.test.ts   # real API; skipped unless CAL_SYSTEM_TEST=1
├── scripts/
│   ├── _cal.sh              # Locates dist/cli.js; defines cal_run()
│   ├── fetch-events.sh      # → cal events fetch "$@"
│   ├── update-cache.sh      # → cal cache update "$@"
│   ├── present.sh           # → cal events present "$@"
│   ├── manage-event.sh      # → cal event <subcommand> "$@"
│   └── calendar-reauth.sh   # → cal auth reauth "$@"
├── config/
│   ├── prep-level-criteria.md   # Source of truth for HIGH/MEDIUM/LOW definitions
│   └── excluded-calendars.json  # Calendar IDs to skip (currently hardcoded in SKILL.md)
├── plans/
│   └── refactor-token-usage.md  # This file
├── package.json             # name: "calendar-summary-cli", bin: {cal: dist/cli.js}
├── tsconfig.json
├── tsup.config.ts           # entry: src/cli.ts, format: esm, banner: shebang
└── SKILL.md
```

**CLI subcommands:**
```
cal events fetch [--window 4w|14d|3m] [--yesterday] [--account normal]
  → stdout: FetchEventsOutput JSON

cal events present [--format human|json|pmd] [--input <file>]
  → reads FetchEventsOutput JSON from stdin (or --input file)
  → stdout: formatted output

cal cache update
  → reads fully-judged FetchEventsOutput JSON from stdin
  → writes/merges into ~/.config/calendar-summary/event-cache.json (atomic write)

cal event create|update|delete|respond [options]
  → wraps Calendar REST write endpoints

cal auth reauth [--account normal]
  → calls reauth('calendar', account) from @gwynj/google-oauth

cal auth migrate
  → calls migrateCalendarTokens() from @gwynj/google-oauth
```

**Shell wrapper pattern:**
```bash
# _cal.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAL_CLI="$SCRIPT_DIR/../dist/cli.js"
cal_run() { NODE_NO_WARNINGS=1 exec node "$CAL_CLI" "$@"; }

# fetch-events.sh
source "$SCRIPT_DIR/_cal.sh"
cal_run events fetch "$@"
```

---

## Key Interfaces

```typescript
// types.ts
export type Nearness = 'IMMINENT' | 'VERY_SOON' | 'THIS_WEEK' | 'NEXT_WEEK' | 'THIS_MONTH' | 'LATER';
export type PrepLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end:   { dateTime?: string; date?: string; timeZone?: string };
  status?: string;
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string; self?: boolean }>;
  recurrence?: string[];
  htmlLink?: string;
  calendarId: string;      // injected: the calendar this event belongs to
  calendarName: string;    // injected: summaryOverride ?? summary from CalendarListEntry
}

export interface ScoredEvent extends CalendarEvent {
  days_until: number;
  nearness: Nearness;
  cached: boolean;
  prep_level?: PrepLevel;  // present when cached=true
  notes?: string;          // one-sentence note; present when cached=true
}

export interface FetchEventsOutput {
  generated_at: string;             // ISO timestamp
  window_days: number;
  today: string;                    // YYYY-MM-DD Pacific/Auckland
  events: ScoredEvent[];
  yesterday_events?: ScoredEvent[]; // only when --yesterday flag used
}

// ~/.config/calendar-summary/event-cache.json  — object keyed by event ID
export interface CacheEntry {
  fingerprint: string;   // sha256(title + '\0' + desc + '\0' + location + '\0' + start)
  prep_level: PrepLevel;
  notes: string;
  last_assessed: string; // YYYY-MM-DD
}
```

**Fingerprint:** SHA-256 of `(summary ?? '') + '\0' + (description ?? '') + '\0' + (location ?? '') + '\0' + (start.dateTime ?? start.date ?? '')`. Changes when event content changes; stable when only attendees or htmlLink change.

**Nearness scoring:**
```
0 days        → IMMINENT   (today or multi-day event already in progress)
1–3 days      → VERY_SOON
4–7 days      → THIS_WEEK
8–14 days     → NEXT_WEEK
15–28 days    → THIS_MONTH
29+ days      → LATER
```

**Priority matrix** (used by `events-present.ts`):
```
             HIGH prep  MEDIUM prep  LOW prep
IMMINENT       🔴          🔴           🟡
VERY_SOON      🔴          🔴           🟡
THIS_WEEK      🔴          🟡           🟢
NEXT_WEEK      🟡          🟡           🟢
THIS_MONTH     🟡          🟢           🟢
LATER          🟢          🟢           —
```
`—` = omit from output (LATER + LOW prep events are dropped).

---

## calendar-api.ts

Calls Google Calendar REST API directly (no MCP). Uses `getAccessToken('calendar')` from `@gwynj/google-oauth`.

Key functions:
```typescript
listCalendars(): Promise<CalendarListEntry[]>
listEvents(calendarId: string, timeMin: string, timeMax: string, tz: string, fields: string[]): Promise<CalendarEvent[]>
```

**Excluded calendars** — read from `config/excluded-calendars.json` at runtime, not hardcoded:
```json
[
  "scouts.nz_qsicfe0rdfi30sr4s2e8dqaa44@group.calendar.google.com",
  "scouts.nz_qqtoqo377tpkctugnamud25lq8@group.calendar.google.com",
  "r240u21ogp03cjfi34ra5ah0io@group.calendar.google.com",
  "classroom101607816945687842931@group.calendar.google.com",
  "1stmtalbertstjudes@group.scouts.nz",
  "a91493d1mv7jja03hhusglpabs@group.calendar.google.com"
]
```

**Devika's calendar filter** (`n8ejujfh7eo85d1b6ond4m5688m4d556@import.calendar.google.com`): include events relevant to both; skip events clearly personal to her (webinars, spiritual sessions, somatic practices, self-improvement talks, meditation/yoga alone). This filter remains in SKILL.md as an AI instruction (not codeable as a rule).

---

## Output Formats

| Format | Output | Used by |
|---|---|---|
| `human` | Three-tier grouped table: 🔴 Urgent / 🟡 Coming up / 🟢 On the radar | calendar-summary SKILL.md |
| `json` | FetchEventsOutput JSON with all prep_levels filled | Piping / programmatic |
| `pmd` | Yesterday section + Today table + Coming up bullets (🔴🟡 only) + weekday Heads-up | plan-my-day |

`pmd` format output shape (for reference when implementing `events-present.ts`):
```
### ⏮ Yesterday — anything slipped?
- {event} — _suggestion: ..._

---

### 📅 Today
| Time | Event | Notes |
|---|---|---|
| {HH:MMam/pm or All day} | {event} | {location or key note} |

**Heads up:** you have [event] at [time] — ...   ← weekdays only, 8am–6pm events

**Coming up (next 30 days):**
- {Tue 7 Apr} — {event} _{🔴 or 🟡}_
```

---

## Updated SKILL.md Flow

```
Step 1: scripts/fetch-events.sh --window {window}
  → FetchEventsOutput JSON

Step 2: AI judges only events where cached=false
  Read config/prep-level-criteria.md for criteria.
  Assign prep_level + one-sentence notes for each uncached event.
  Fill into the JSON in memory.

Step 3: scripts/update-cache.sh   ← stdin: fully-judged JSON

Step 4: scripts/present.sh --format human
```

After cache warm-up, Step 2 has zero events to judge — Steps 1/3/4 are pure script calls.

**CRUD operations:** `scripts/manage-event.sh create|update|delete|respond` replaces `mcp__gcal__*`.

---

## Shared Prep-Level Criteria (`config/prep-level-criteria.md`)

HIGH/MEDIUM/LOW definitions currently duplicated in SKILL.md and calendar.md move to a single config file. Both files instruct the AI to `Read` it at judgement time.

---

## Revised plan-my-day/sub-agents/calendar.md

Thin wrapper — all logic in the CLI:

```markdown
## Fetch and score events

Run: scripts/fetch-events.sh --window 30d --yesterday
→ FetchEventsOutput JSON with nearness scores and any cached prep_levels

## Judge uncached events (if any cached=false)

Read ~/dev/tools/claude-skills/calendar-summary/config/prep-level-criteria.md
Assign prep_level + notes for each uncached event.
Run scripts/update-cache.sh with judged JSON.

## Present

scripts/present.sh --format pmd
```

No nearness scoring logic, no priority matrix, no Devika filter rules — all in the CLI.

---

## Testing

**Unit tests** (vitest, mocked I/O) — `__tests__/*.test.ts`:
- `nearness.test.ts` — boundary cases: 0 days = IMMINENT, 1/3/4/7/8/14/15/28/29 days
- `fingerprint.test.ts` — changes with title/desc/location/start; stable with attendee/htmlLink changes
- `priority-matrix.test.ts` — all 18 matrix cells; LATER+LOW = undefined/omitted
- `present.test.ts` — all three formats with fixture FetchEventsOutput

**System tests** (`__tests__/system/`) — real Calendar API, skipped unless `CAL_SYSTEM_TEST=1`:
- `events-fetch.system.test.ts` — fetch 7-day window; assert shape (events array, each has nearness, days_until >= 0)

---

## Files to Create / Modify

| File | Action |
|---|---|
| `tools/google-oauth/src/index.ts` | Create — public API |
| `tools/google-oauth/src/token-store.ts` | Create — unified token store R/W |
| `tools/google-oauth/src/reauth.ts` | Create — OAuth flow, local server on :3000 |
| `tools/google-oauth/env/gcp-oauth.keys.json.example` | Create — shape docs only |
| `tools/google-oauth/package.json` + `tsconfig.json` + `tsup.config.ts` | Create |
| `tools/claude-skills/calendar-summary/src/cli.ts` | Create |
| `tools/claude-skills/calendar-summary/src/calendar-api.ts` | Create |
| `tools/claude-skills/calendar-summary/src/types.ts` | Create |
| `tools/claude-skills/calendar-summary/src/commands/events-fetch.ts` | Create |
| `tools/claude-skills/calendar-summary/src/commands/events-present.ts` | Create |
| `tools/claude-skills/calendar-summary/src/commands/cache-update.ts` | Create |
| `tools/claude-skills/calendar-summary/src/commands/event-manage.ts` | Create |
| `tools/claude-skills/calendar-summary/__tests__/nearness.test.ts` | Create |
| `tools/claude-skills/calendar-summary/__tests__/fingerprint.test.ts` | Create |
| `tools/claude-skills/calendar-summary/__tests__/priority-matrix.test.ts` | Create |
| `tools/claude-skills/calendar-summary/__tests__/present.test.ts` | Create |
| `tools/claude-skills/calendar-summary/__tests__/system/events-fetch.system.test.ts` | Create |
| `tools/claude-skills/calendar-summary/scripts/_cal.sh` | Create |
| `tools/claude-skills/calendar-summary/scripts/fetch-events.sh` | Create |
| `tools/claude-skills/calendar-summary/scripts/update-cache.sh` | Create |
| `tools/claude-skills/calendar-summary/scripts/present.sh` | Create |
| `tools/claude-skills/calendar-summary/scripts/manage-event.sh` | Create |
| `tools/claude-skills/calendar-summary/scripts/calendar-reauth.sh` | Create |
| `tools/claude-skills/calendar-summary/config/prep-level-criteria.md` | Create |
| `tools/claude-skills/calendar-summary/config/excluded-calendars.json` | Create |
| `tools/claude-skills/calendar-summary/package.json` + build config | Create |
| `tools/claude-skills/calendar-summary/SKILL.md` | Modify |
| `tools/claude-skills/calendar-summary/.claude/settings.json` | Modify — Bash(scripts/*) |
| `tools/claude-skills/plan-my-day/sub-agents/calendar.md` | Modify — thin wrapper |
| `dev/.claude/settings.json` | Modify — add Bash allow for calendar-summary scripts |
| `~/.claude/skills/calendar-summary/` + `~/.claude/skills/plan-my-day/` | Sync from dev |

---

## Implementation Order

1. **`tools/google-oauth/`** — token store, refresh, reauth; `migrateCalendarTokens()`; build and verify `npm run build` produces `dist/index.js`
2. **Calendar-summary scaffold** — package.json (dep on `@gwynj/google-oauth`), tsconfig, tsup; `npm install`
3. **`calendar-api.ts`** — listCalendars/listEvents against Calendar REST API; manually verify with a test call
4. **`types.ts` + `commands/events-fetch.ts`** — nearness scoring, fingerprint, exclusion filter, cache lookup
5. **Unit tests** (nearness, fingerprint, priority-matrix) — `npm test` passes
6. **`commands/cache-update.ts`** — atomic write; system test (`CAL_SYSTEM_TEST=1 npm test`)
7. **`commands/events-present.ts`** — all three formats; present.test.ts passes
8. **`cli.ts`** — router wiring all commands; shell wrappers (`_cal.sh` + scripts)
9. **SKILL.md + settings**; sync both skill copies to `~/.claude/skills/`
10. **`commands/event-manage.ts`** — CRUD subcommands
11. **`plan-my-day/sub-agents/calendar.md`** — thin wrapper; sync to `~/.claude/skills/plan-my-day/`
12. **`config/prep-level-criteria.md`** — extract criteria; update SKILL.md + calendar.md references

---

## Verification

1. `scripts/fetch-events.sh --window 4w | python3 -m json.tool` — parses cleanly; event count matches known calendar
2. `npm test` — all unit tests pass
3. `CAL_SYSTEM_TEST=1 npm test` — system test fetches real events with correct structure
4. Warm-cache run: run full skill twice back-to-back — second run's Step 2 receives zero uncached events
5. Fingerprint invalidation: manually edit a cache entry's fingerprint → next fetch marks that event `cached=false`
6. `plan-my-day` full run — calendar section format unchanged (Yesterday / Today table / Coming up bullets)
7. Auth recovery: corrupt `access_token` in `~/.config/google-oauth/tokens.json` → `calendar-reauth.sh` produces working replacement
