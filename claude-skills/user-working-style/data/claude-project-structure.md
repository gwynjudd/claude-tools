# Claude Skill & Project Structure

## Skills

- Skills live under `~/dev/tools/claude-skills/<skill-name>/`
- When creating or extending a skill, prefer extracting reusable logic into shell scripts placed in a **`scripts/`** subdirectory under the skill directory
- The skill's `SKILL.md` should call these scripts rather than inlining the logic

## Standard directory layout

```
skill-name/
├── SKILL.md         # Only file at the top level for skills
├── scripts/         # Shell scripts used by the skill
├── src/             # Source code (if needed)
├── config/          # Runtime state, settings, .env files
├── data/            # Skill data files (e.g. RECIPES.md)
└── .claude/
    └── settings.json
```

Not all projects fit this exactly — be flexible and don't force the structure. Other project types
(Node packages, etc.) may have additional top-level files (package.json, etc.).

## Settings convention

The **primary settings file** is `~/dev/.claude/settings.json` — this governs all day-to-day use
since Claude Code always runs from `~/dev`. Per-skill `.claude/settings.json` files are also
maintained as documentation and apply if a skill directory is ever opened directly.

**Security principle:** No unnecessary prompts for day-to-day use.

| Directory | `permissions.allow` (write) | `permissions.allow` (bash) | `sandbox.filesystem.allowWrite` | Result |
|-----------|----------------------------|---------------------------|----------------------------------|--------|
| `config/` | ✅ yes | ❌ no | ✅ yes | No prompt, write succeeds; execution fails |
| `data/`   | ✅ yes | ❌ no | ✅ yes | No prompt, write succeeds; execution fails |
| `scripts/`| ❌ no  | ✅ yes | ✅ yes | No prompt, execution succeeds; prompt required for edits |
| `src/`    | ❌ no  | ❌ no  | ✅ yes | Prompt required, write succeeds once approved; execution fails |

Each skill's sandbox `allowWrite` covers only that skill's own directory.

## MCP permissions

MCP tool permissions are granted per skill in `~/dev/.claude/settings.json`. When adding a new
skill that requires MCP access, add its tools to that file (and mirror them in the skill's own
`.claude/settings.json`).
