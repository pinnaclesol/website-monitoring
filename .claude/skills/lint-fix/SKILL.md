---
name: lint-fix
description: Run lint and typecheck across all three apps and auto-fix what the PostToolUse hook surfaces.
allowed-tools: Bash, Read, Edit, Glob, Grep
user-invocable: true
---

Run lint + typecheck across the whole monorepo and fix what comes up. This is the deliberate, on-demand companion to the automatic `PostToolUse` hook — the hook only *reports* typecheck/lint issues after every edit; this skill actually fixes them.

1. Run `npx tsc --noEmit -p tsconfig.base.json` and `nx run-many --target=lint --all` (full run, not just affected — this is the deliberate deep pass).
2. For each error/warning, open the file and fix it directly — don't just silence the rule unless it's a legitimate false positive (explain why if so).
3. Re-run both commands to confirm a clean pass.
4. Report a short summary: how many issues found, how many fixed, and any that need a human decision (e.g. a genuine type mismatch requiring a design choice, not just a fix).
