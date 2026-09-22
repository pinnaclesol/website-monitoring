---
name: review
description: Get an independent code review of current changes before committing. Delegates to the code-reviewer agent.
allowed-tools: Bash, Read, Glob, Grep
context: fork
agent: code-reviewer
user-invocable: true
---

Review the current uncommitted changes in the uptime-monitor monorepo.

1. Run `git diff` and `git status` to collect all changed files.
2. Read each changed file in full.
3. Apply the code-reviewer agent's checklist:
   - Module boundaries (`apps/web` → `@uptime/ui`/`@uptime/auth` only; `apps/api` = BullMQ producer only; `apps/worker` = sole caller of monitored-site URLs)
   - Alert-state correctness (single open `Incident` per down site, dedup via `AlertState.lastAlertSentAt`, no premature reminders, retry via BullMQ job options not hand-rolled timers)
   - Security (no logged/returned secrets, internal-API-key guard present, bcrypt-only password handling)
   - Database conventions (singleton `UptimePrismaService`, no manual migration edits)
   - Design-token compliance (no ad-hoc hex colors, dark mode works)
4. Report findings as: ✅ looks good | ⚠️ minor concern | ❌ must fix — with file:line references.
