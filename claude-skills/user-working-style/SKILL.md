---
name: user-working-style
description: >
  Personal working style preferences for this user. ALWAYS load and follow this skill at the
  start of every conversation. Apply these preferences automatically without asking — they
  govern shell syntax, tooling choices, directory structure, language preferences, and more.
  When the user mentions a new preference or correction during a conversation (e.g. "I prefer X",
  "I always use Y", "use Z instead"), recognise it as a potential skill update and offer to
  record it: "Would you like me to update your working style skill with that preference?"
---

# User Working Style

At the start of every conversation, load all files marked **always** below. Load other files
when the described condition applies.

| File | Description | Load when |
|------|-------------|-----------|
| @data/environment.md | Environment setup (WSL, home dir, projects root) | always |
| @data/shell-terminal.md | Shell & terminal preferences | always |
| @data/editor.md | Editor preferences (VS Code) | always |
| @data/general-preferences.md | General working style preferences | always |
| @data/languages-tooling.md | Language and tooling choices | When writing code or choosing a language or runtime |
| @data/project-directory-structure.md | Project and directory layout | When creating or placing a new project or tool |
| @data/claude-project-structure.md | Claude skill/project structure and settings | When creating or modifying a skill or project |
| @data/todo-list.md | Todo list schema and maintenance | When the user mentions tasks, todos, or the todo list |
| @data/skill-updates.md | How to update this working style skill | When the user states a new preference |
| @data/recipes.md | Cooking recipes | When the user asks about food or recipes |
