# Email Summary Skill — Script-Based Refactor

**Status:** In progress  
**Last updated:** 2026-04-11

---

## Why

The email-summary skill (`~/dev/tools/claude-skills/email-summary/SKILL.md`) currently
drives all work through AI tool calls: two `mcp__gmail__search_emails` calls plus N
individual `mcp__gmail__read_email` calls (one per email). Token cost scales linearly with
inbox volume. Most of this work is mechanical — fetch, deduplicate, match against known
senders, download attachments — and doesn't need AI judgment.

**Goal:** Offload mechanical work to scripts/tools. Remove the Gmail MCP dependency
entirely. The AI's job narrows to: classify ambiguous emails, summarise, extract action
items, render output.

---

## Background: Existing Code

### `~/dev/tools/ai-helpers/fetch-email-html.js`
Already calls the Gmail API directly (no MCP). Has working implementations of:
- OAuth token loading + access token refresh (reads `~/.gmail-mcp/credentials.json` and
  `~/.gmail-mcp/gcp-oauth.keys.json`)
- `fetchMessage(accessToken, msgId)` — Gmail API call
- HTML → plain text conversion (strips style/script, converts tags, decodes entities)

This is the source of truth for OAuth and HTML→text patterns. New TypeScript modules
should extract and reuse this logic, not rewrite it.

### `~/dev/tools/claude-skills/email-summary/scripts/fetch-email-html.sh`
Thin bash wrapper around the above. Pattern to follow for all new shell wrappers.

### `~/dev/.claude/settings.json`
Primary permissions file. Currently allows `mcp__gmail__*` tools and
`Bash(email-summary/scripts/*)`. Needs updating in Slice -1 and Slice 6.

---

## Conventions

- **TypeScript** (not JS) for anything more than ~1 page. Run via `tsx` — no build step.
- **Shell scripts** in `scripts/` are thin wrappers: `npx tsx src/<tool>.ts "$@"`
- **Config** (categories, known senders, folder mappings) lives in `config/` as JSON —
  not hardcoded in source
- **Tests** via `vitest` in `tests/`
- **Credentials** always at `~/.gmail-mcp/credentials.json` and
  `~/.gmail-mcp/gcp-oauth.keys.json` — do not move or duplicate
- **Re-auth:** Tokens expire ~weekly (GCP app in test mode). `gmail-reauth.ts` handles
  full browser OAuth flow when refresh token expires.

---

## Target Directory Layout

> **Note:** Layout was revised from original plan. ai-helpers has been deleted;
> all code lives under email-summary. tsup builds to dist/; scripts call `node dist/<tool>.js`.

```
~/dev/tools/claude-skills/email-summary/
├── SKILL.md                   # UPDATE in Slice 7
├── package.json               # tsup, vitest, typescript, @types/node; bin entries
├── tsconfig.json              # ESNext target, NodeNext modules
├── tsup.config.ts             # bundles src/*.ts → dist/*.js with shebang
├── config/
│   ├── family.json
│   ├── categories.json
│   └── folders.json           # NEW in Slice 5
├── dist/                      # built output (gitignored)
│   ├── fetch-email-html.js
│   ├── pre-classify.js
│   ├── gmail-reauth.js
│   ├── fetch-emails.js        # after Slice 3
│   └── save-attachment.js     # after Slice 5
├── plans/
│   └── refactor.md
├── scripts/
│   ├── fetch-email-html.sh    # exec node dist/fetch-email-html.js
│   ├── gmail-reauth.sh        # exec node dist/gmail-reauth.js
│   ├── fetch-emails.sh        # NEW in Slice 3
│   ├── pre-classify.sh        # exec node dist/pre-classify.js
│   └── save-attachment.sh     # NEW in Slice 5
├── src/
│   ├── gmail-api.ts           # shared Gmail API module (not a bin entry)
│   ├── gmail-reauth.ts
│   ├── fetch-email-html.ts
│   ├── fetch-emails.ts        # NEW in Slice 3
│   ├── pre-classify.ts
│   └── save-attachment.ts     # NEW in Slice 5
└── tests/
    ├── gmail-api.test.ts
    ├── fetch-emails.test.ts   # NEW in Slice 3
    ├── pre-classify.test.ts
    └── save-attachment.test.ts # NEW in Slice 5
```

---

## Slices

### Slice -1 — Settings & permissions
**Done by:** main agent  
**Status:** done

Update `~/dev/.claude/settings.json` — add:
```json
"Edit(~/dev/tools/claude-skills/email-summary/config/)",
"Write(~/dev/tools/claude-skills/email-summary/config/)",
"Edit(~/dev/tools/claude-skills/email-summary/plans/)",
"Write(~/dev/tools/claude-skills/email-summary/plans/)",
"Bash(~/dev/tools/ai-helpers/*.sh)"
```
Keep `mcp__gmail__*` rules for now — removed in Slice 6 once scripts are verified.  
`sandbox.filesystem.allowWrite` already covers the full skill directory — no change needed.

---

### Slice 0 — Scaffolding
**Done by:** main agent  
**Status:** done  
**Depends on:** Slice -1

- `email-summary/package.json` — `tsx`, `typescript`, `vitest`, `@types/node`
- `email-summary/tsconfig.json` — ESNext target, NodeNext modules
- Verify: `cd email-summary && npx tsx --version`

---

### Slice 1 — Shared Gmail API module
**Done by:** Agent A  
**Status:** done  
**Depends on:** Slice 0

**File:** `~/dev/tools/ai-helpers/gmail-api.ts`  
**Tests:** `~/dev/tools/ai-helpers/gmail-api.test.ts`

Extract from `fetch-email-html.js` and expand into a TypeScript module. Export:

```ts
getAccessToken(): Promise<string>
  // Loads ~/.gmail-mcp/credentials.json
  // Refreshes via https://oauth2.googleapis.com/token if expired
  // Saves updated token back to credentials.json

searchMessages(query: string, maxResults: number): Promise<MessageSummary[]>
  // Returns [{ id, threadId }]

fetchMessage(id: string): Promise<GmailMessage>
  // format=full

downloadAttachment(messageId: string, attachmentId: string): Promise<Buffer>

htmlToText(html: string): string
  // Strip style/script, convert block tags to newlines, decode entities
  // Normalise whitespace
```

Also update `fetch-email-html.js` to import `getAccessToken`, `fetchMessage`, and
`htmlToText` from `gmail-api.ts` rather than reimplementing them.

**Tests:** Mock `fetch` globally. Cover:
- Token still valid → no refresh call
- Token expired → refresh called, new token saved to file
- Refresh fails → throws with message
- `htmlToText`: tables, links (`[text] [url]`), `&nbsp;` / `&amp;` / `&lt;` entities,
  excess blank lines collapsed

**Verify:** `fetch-email-html.sh <any-message-id>` still works after the refactor.

---

### Slice 2 — Re-auth tool
**Done by:** Agent A (alongside Slice 1)  
**Status:** done  
**Depends on:** Slice 0

**File:** `~/dev/tools/ai-helpers/gmail-reauth.ts`  
**Wrapper:** `~/dev/tools/ai-helpers/gmail-reauth.sh`

Flow:
1. Read client config from `~/.gmail-mcp/gcp-oauth.keys.json` (`.installed` key)
2. Build Google OAuth URL: `offline` access_type, scopes `gmail.readonly` + `gmail.modify`
3. Print the URL for the user to open in a browser
4. Start local HTTP server on `localhost:3000` awaiting callback with `?code=`
5. POST to `https://oauth2.googleapis.com/token` to exchange code for tokens
6. Save full token response to `~/.gmail-mcp/credentials.json`
7. Print success message

No unit tests (requires browser). Manual verify: run script, complete flow, confirm
`credentials.json` updated, confirm `fetch-email-html.sh` works.

---

### Slice 3 — Batch email fetcher
**Done by:** Agent B  
**Status:** done  
**Depends on:** Slice 1

**File:** `email-summary/src/fetch-emails.ts`  
**Wrapper:** `email-summary/scripts/fetch-emails.sh`  
**Tests:** `email-summary/tests/fetch-emails.test.ts`

CLI: `npx tsx src/fetch-emails.ts --period <1d|7d|...> [--max-body-chars N]`

Logic:
1. Search 1: `newer_than:{period} -category:promotions -category:updates -category:social`
   with `maxResults: 50`
2. Search 2: `newer_than:{period} in:inbox` with `maxResults: 50`
3. Deduplicate by message ID
4. For each message: fetch full content; if body is empty or contains
   "This email message was sent in HTML format", use `htmlToText` on the HTML part
5. Output JSON array to stdout (one line):
   ```json
   [{"id","from","fromEmail","subject","date","snippet","body","hasAttachments"}]
   ```

`fromEmail` is the raw email address extracted from the `From` header.

**Tests:** Mock `gmail-api.ts` module. Cover:
- Deduplication when same ID appears in both searches
- Period string → Gmail query (e.g. `3d`, `7d`)
- HTML-only email falls back to `htmlToText`
- `--max-body-chars` truncates body
- `hasAttachments` true when message has `filename` parts

---

### Slice 4 — Rule-based pre-classifier
**Done by:** Agent C  
**Status:** done  
**Depends on:** Slice 0 (for package.json/vitest); does NOT need Slice 1 (no Gmail API calls)

**File:** `email-summary/src/pre-classify.ts`  
**Wrapper:** `email-summary/scripts/pre-classify.sh`  
**Tests:** `email-summary/tests/pre-classify.test.ts`

CLI: reads JSON array from stdin, writes result to stdout.

Rules applied in order (first match wins):

| Check | Config source | Category |
|-------|--------------|----------|
| `from` or `fromEmail` matches family list | `config/family.json` | `FAMILY` |
| `fromEmail` domain in rental domains list | `config/categories.json` → `rentalDomains` | `RENTAL_PROPERTY` |
| `from` name matches charity names list | `config/categories.json` → `charities` | `GIVING` |
| `fromEmail` matches discard address patterns | `config/categories.json` → `discardAddressPatterns` | `DISCARD` |
| `body` contains any discard body signal | `config/categories.json` → `discardBodySignals` | `DISCARD` |

Name matching is case-insensitive. Domain matching checks the full domain only (not substrings).

Output:
```json
{
  "pre_classified": [{"id","from","fromEmail","subject","date","snippet","body","hasAttachments","category","confidence"}],
  "unclassified": [{"id","from","fromEmail","subject","date","snippet","body","hasAttachments"}]
}
```
`confidence` is always `"high"` for rule-based matches.

**Config files to create:**

`config/family.json`:
```json
{
  "names": ["Devika Judd","Sam Judd","Samuel Judd","Emily Judd","Bill Judd",
            "Stephanie Judd","Alex Baker","Alexandra Baker","Mark Baker","Lalage Judd","Lalage Sales"],
  "emails": []
}
```

`config/categories.json`:
```json
{
  "rentalDomains": ["aspireproperty.co.nz","email.propertyme.com"],
  "charities": ["Barnardos","Red Cross","Blind Low Vision NZ","Invisible Girl Project","Save the Children"],
  "discardAddressPatterns": ["noreply@","no-reply@","donotreply@","do-not-reply@"],
  "discardBodySignals": ["unsubscribe","manage your preferences","manage preferences","opt out","opt-out"]
}
```

**Tests:** Fixture emails covering: each family name variant, rental domain, charity name,
discard address pattern, unsubscribe body signal; case-insensitivity; domain substring
should NOT match; no-match → unclassified.

---

### Slice 5 — Attachment downloader
**Done by:** Agent D  
**Status:** done  
**Depends on:** Slice 1

**File:** `email-summary/src/save-attachment.ts`  
**Wrapper:** `email-summary/scripts/save-attachment.sh`  
**Tests:** `email-summary/tests/save-attachment.test.ts`

CLI args:
- `--message-id <id>`
- `--attachment-id <id>`
- `--target-dir <absolute-path>` — caller provides this; skill looks up correct path from
  `config/folders.json`
- `--date <YYYY-MM-DD>`
- `--description <text>`
- `--ext <pdf|jpg|...>`

Behaviour:
1. Download attachment bytes via `gmail-api.ts → downloadAttachment()`
2. Write bytes to a temp file in `os.tmpdir()`
3. Only on successful write: `fs.rename()` to `<target-dir>/YYYY-MM-DD - {description}.{ext}`
4. Print final absolute path to stdout
5. On any failure: exit non-zero, temp file cleaned up, nothing written to target-dir

**Config file to create:**

`config/folders.json`:
```json
{
  "rental": {
    "base": "/mnt/c/Users/gwynj/OneDrive/rental/3-20 Russell road",
    "subtypes": {
      "statement": "Statements",
      "insurance": "Insurance",
      "tax": "Taxes & expenses",
      "maintenance": "Reno quotes",
      "legal": "Legal",
      "healthy_homes": "healthy homes",
      "bank": "bank",
      "default": ""
    }
  },
  "giving": {
    "base": "/mnt/c/Users/gwynj/OneDrive/donations",
    "subtypes": {}
  }
}
```

**Tests:** Mock `gmail-api.ts → downloadAttachment`. Cover:
- Successful download → correct filename format in target dir
- Temp file cleaned up on success (not left in tmpdir)
- API failure → exits non-zero, nothing in target dir
- Partial write failure → nothing in target dir
- Description with special characters → safe filename

---

### Slice 6 — Remove Gmail MCP rules
**Done by:** main agent  
**Status:** done  
**Depends on:** Slices 3, 4, 5 verified working

Update `~/dev/.claude/settings.json` — remove:
- `mcp__gmail__search_emails`
- `mcp__gmail__read_email`
- `mcp__gmail__download_attachment`

Update `email-summary/.claude/settings.json` to match.

---

### Slice 7 — Rewrite SKILL.md
**Done by:** main agent  
**Status:** done  
**Depends on:** Slice 6

Replace the step-by-step workflow with:

```
Step 1: scripts/fetch-emails.sh <period>
        → JSON array of all emails with bodies

Step 2: scripts/pre-classify.sh
        → { pre_classified: [...], unclassified: [...] }

Step 3: AI classifies the unclassified emails
        (PEOPLE, SCOUTING, SCHOOL, BILLS, SECURITY, or DISCARD)

Step 4: AI summarises each kept email (1–2 sentences), extracts action items

Step 5: For rental/giving emails with attachments:
        scripts/save-attachment.sh --message-id <id> --attachment-id <id>
          --target-dir <path from config/folders.json> --date <YYYY-MM-DD>
          --description <text> --ext <ext>

Step 6: AI renders the markdown summary
```

Remove all `mcp__gmail__*` references. Add re-auth note:
> If any script exits with an auth error, run:
> `~/dev/tools/ai-helpers/gmail-reauth.sh`

---

## Execution Order

```
Slice -1  (main)
    ↓
Slice 0   (main)
    ↓
 ┌──┴──────────────┐
 Agent A        Agent C
 Slice 1+2      Slice 4
 └──┬────────────┘
    ↓
 ┌──┴──────────────┐
 Agent B        Agent D
 Slice 3        Slice 5
 └──┬────────────┘
    ↓
Slice 6   (main, after integration test)
    ↓
Slice 7   (main)
```

Agent C (Slice 4) can run in parallel with Agent A since pre-classify has no Gmail API
dependency. Agents B and D both depend on Agent A completing Slice 1 first.
