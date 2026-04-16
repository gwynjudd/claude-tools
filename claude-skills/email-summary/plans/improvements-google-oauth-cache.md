# Plan: email-summary improvements

## Context

Two independent improvements to the email-summary skill:

1. **Switch to `@gwynj/google-oauth`** — eliminate the bespoke token management in `gmail-api.ts` and `gmail-reauth.ts` in favour of the shared library already used by calendar-summary. Improves consistency and centralises token storage at `~/.config/google-oauth/tokens.json`.

2. **SQLite classification cache** — skip step 2 (pre-classify) and step 3 (AI classification) for emails already seen. Uses `better-sqlite3 ^12.0.0` (already used in plan-my-day, Node 24 compatible). Persists per-email state: pre_classification, ai_classification, attachments_downloaded. Avoids re-spending AI tokens on emails that appear in overlapping time windows (e.g. "last week" includes yesterday's already-processed emails).

---

## Part 1: Switch to google-oauth

### A. Add `migrateGmailTokens()` to google-oauth

**File:** `~/dev/tools/google-oauth/src/index.ts`

Add a migration function analogous to the existing `migrateCalendarTokens()`:

```typescript
export async function migrateGmailTokens(): Promise<void> {
  // Source: ~/.gmail-mcp/credentials.json
  // Format: { access_token, refresh_token, expiry_date, scope, token_type }
  // Write to unified store under gmail/default via writeToken('gmail', 'default', entry)
}
```

Also copy `~/.gmail-mcp/gcp-oauth.keys.json` → `~/.config/google-oauth/gcp-oauth.keys.json` if the unified keys file doesn't already exist.

Export `migrateGmailTokens` and rebuild google-oauth.

### B. Update email-summary

**`package.json`** — add runtime + dev dependencies:
```json
"dependencies": {
  "@gwynj/google-oauth": "file:../../google-oauth",
  "better-sqlite3": "^12.0.0"
},
"devDependencies": {
  "@types/better-sqlite3": "^7.6.0",
  ...existing...
}
```

Update `bin` entries: remove standalone `gmail-reauth` entry; add single `email` entry pointing to `dist/cli.js`. Pipeline binaries (`fetch-emails`, `pre-classify`, etc.) remain unchanged.

**`tsup.config.ts`** — add external + new entry:
```typescript
external: ['better-sqlite3'],
entry: [
  // existing pipeline binaries unchanged
  'src/cli.ts',  // new unified management CLI
],
```
Remove `src/gmail-reauth.ts` from `entry` (its logic moves into `cli.ts`).

**`src/gmail-api.ts`** — remove local token management:
- Delete `TOKEN_PATH`, `OAUTH_PATH` constants (lines 13–15) and `getAccessToken()` function (lines 54–86)
- Add `import { getAccessToken } from '@gwynj/google-oauth'`
- Update the 3 call sites to `getAccessToken('gmail')`

**New `src/cli.ts`** — unified management CLI following the `cal` pattern:

```
email auth reauth    → reauth('gmail')
email auth migrate   → migrateGmailTokens()
email cache store-ai --id <id> --category <CAT>  → storeAiClassification(id, cat)
```

**`src/gmail-reauth.ts`** — delete; its logic lives in `cli.ts auth reauth`.

**Update `scripts/gmail-reauth.sh`** — call `dist/cli.js auth reauth` instead of `dist/gmail-reauth.js`.

**New `scripts/gmail-migrate.sh`** — calls `dist/cli.js auth migrate`.

**`SKILL.md` auth note** — update to:
> If any script exits with an auth error, run `gmail-reauth.sh`. For first-time setup, run `gmail-migrate.sh` to migrate existing tokens.

---

## Part 2: SQLite classification cache

### New `src/email-cache.ts`

DB location: `~/.config/email-summary/email-cache.db` (created on first use via `mkdirSync(..., { recursive: true })`).

Schema:
```sql
CREATE TABLE IF NOT EXISTS email_cache (
  external_id            TEXT PRIMARY KEY,   -- implicit B-tree index; no extra index needed
  pre_classification     TEXT,               -- NULL = no rule match; set = matched rule
  ai_classification      TEXT,               -- NULL = AI hasn't run
  attachments_downloaded INTEGER NOT NULL DEFAULT 0
)
```

The presence of a row means **step 2 has already run** for that email. This distinguishes:
- No row → never seen → run step 2
- Row, `pre_classification` set → rule matched, no AI needed
- Row, `pre_classification = null, ai_classification = null` → step 2 ran, no rule match, AI not yet done → still needs AI
- Row, `ai_classification` set → step 3 done → skip all classification

Public API:
```typescript
interface CacheEntry {
  external_id: string
  pre_classification: string | null
  ai_classification: string | null
  attachments_downloaded: boolean
}

// Bulk lookup — returns only found rows
function getClassifications(ids: string[]): Map<string, CacheEntry>

// Called after step 2 — always creates/updates row (category may be null = no rule match)
function storeStep2Result(id: string, category: string | null): void

// Called after step 3 — upserts ai_classification
function storeAiClassification(id: string, category: string): void

// Called after save-attachment — sets attachments_downloaded = 1
function markAttachmentsDownloaded(id: string): void
```

### Updated `src/pre-classify.ts`

New output shape:
```typescript
export interface CachedEmail extends Email {
  category: string          // pre_classification ?? ai_classification from cache
  attachments_downloaded: boolean
}

export interface Output {
  pre_classified: ClassifiedEmail[]   // new rule-classified + cache hits needing attachments
  unclassified: Email[]               // new unclassified + interrupted cache entries needing AI
  from_cache: CachedEmail[]           // fully done — skip all steps
}
```

Updated `classifyAll()` logic:
1. `getClassifications(allIds)` — one bulk DB call
2. For each email:
   - **No cache entry** (new email): run rule-based `classify()`
     - Match → `storeStep2Result(id, category)` → `pre_classified`
     - No match → `storeStep2Result(id, null)` → `unclassified`
   - **Row, `ai_classification` set**:
     - `fullyDone = attachments_downloaded || category ∉ ['RENTAL_PROPERTY','GIVING'] || !hasAttachments`
     - Yes → `from_cache`
     - No → `pre_classified` (cached category, `confidence:'high'`) — still needs attachment download
   - **Row, `pre_classification` set, no `ai_classification`** (rule matched, possibly interrupted before attachments):
     - Same `fullyDone` check as above
     - Yes → `from_cache`; No → `pre_classified`
   - **Row, both null** (step 2 ran, email went to unclassified, AI not done):
     - → `unclassified` (skip re-running rules; needs AI)

### Updated `src/save-attachment.ts`

After successful `rename()`:
```typescript
import { markAttachmentsDownloaded } from './email-cache.js'
markAttachmentsDownloaded(opts.messageId)
```

### `src/cli.ts` — cache subcommand

`email cache store-ai --id <id> --category <CAT>` calls `storeAiClassification(id, cat)`.

Called once per AI-classified email from SKILL.md. SKILL.md loops through all `unclassified` emails after classification and calls it for each (including DISCARDs).

### Updated `SKILL.md`

**Step 2 output** — document `from_cache`:
```json
{
  "pre_classified": [...],
  "unclassified": [...],
  "from_cache": [{"id","from","fromEmail","subject","date","snippet","body","hasAttachments","category","attachments_downloaded"}]
}
```

After step 2:
> `from_cache` emails are fully processed — include them in the summary without any further steps.

After step 3 (for each AI-classified email, including DISCARD):
```bash
~/dev/tools/claude-skills/email-summary/scripts/email.sh cache store-ai \
  --id <messageId> --category <CATEGORY>
```

New `scripts/email.sh` wrapper for the `email` CLI binary (`dist/cli.js`).

---

## Critical files

| File | Change |
|---|---|
| `~/dev/tools/google-oauth/src/index.ts` | Add `migrateGmailTokens()` |
| `email-summary/src/gmail-api.ts` | Remove local auth; import `getAccessToken('gmail')` |
| `email-summary/src/gmail-reauth.ts` | **Delete** — logic moves to `cli.ts` |
| `email-summary/src/cli.ts` | **New** — unified management CLI |
| `email-summary/src/email-cache.ts` | **New** — SQLite cache module |
| `email-summary/src/pre-classify.ts` | Integrate cache lookup/write; add `from_cache` output |
| `email-summary/src/save-attachment.ts` | Call `markAttachmentsDownloaded()` after rename |
| `email-summary/package.json` | Add `@gwynj/google-oauth`, `better-sqlite3 ^12`, types; update `bin` |
| `email-summary/tsup.config.ts` | `external: ['better-sqlite3']`; swap `gmail-reauth` for `cli` in entries |
| `email-summary/SKILL.md` | Update step 2 docs; add cache write after step 3; add `from_cache` handling |
| `email-summary/scripts/gmail-reauth.sh` | Call `dist/cli.js auth reauth` |
| `email-summary/scripts/gmail-migrate.sh` | **New** — calls `dist/cli.js auth migrate` |
| `email-summary/scripts/email.sh` | **New** — general wrapper for `dist/cli.js` |
| `email-summary/tests/gmail-api.test.ts` | Mock `@gwynj/google-oauth` instead of filesystem |
| `email-summary/tests/pre-classify.test.ts` | Mock `email-cache` module; test `from_cache` output |

---

## Build order

1. `cd ~/dev/tools/google-oauth && npm run build`
2. `cd ~/dev/tools/claude-skills/email-summary && npm install && npm run build`

---

## Verification

1. **Token migration:** `scripts/gmail-migrate.sh` → `~/.config/google-oauth/tokens.json` contains `gmail.default`
2. **Auth smoke test:** `fetch-emails.sh --period 1d` succeeds without touching `~/.gmail-mcp/`
3. **Cache population:** `pre-classify.sh` on emails → `~/.config/email-summary/email-cache.db` created with rows; DB has `pre_classification` set for rule-matched emails and null for unclassified
4. **Cache hit — no AI:** Re-run `pre-classify.sh` on same emails → all appear in `from_cache` (for emails with `ai_classification` set) or `pre_classified` (for partially processed); `unclassified` is empty except for truly new emails
5. **Interrupted entry resumes:** Manually insert a row `(id, null, null, 0)` → next run puts that email in `unclassified` (needs AI, not `from_cache`)
6. **Tests:** `npm test` passes; pre-classify tests cover all four cache path branches
