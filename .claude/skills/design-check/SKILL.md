---
name: design-check
description: Audit the current diff's frontend files against the design-token system for color/spacing/dark-mode consistency. Usage: /design-check
allowed-tools: Bash, Read, Glob, Grep
context: fork
agent: ui-agent
user-invocable: true
---

Audit the current uncommitted changes in `apps/web` and `libs/ui` for design-token drift.

1. Run `git diff` and `git status` to collect changed frontend files (`.tsx`, `.css`, `tailwind.config.ts`).
2. Read each changed file in full.
3. Check for:
   - Literal hex/rgb color values instead of theme tokens (`text-[#...]`, inline `style={{ color: '...' }}`, raw CSS hex).
   - New components missing a `[data-theme="dark"]` counterpart, or that visibly break in dark mode.
   - Ad-hoc spacing/typography values that duplicate an existing token instead of reusing it.
   - New badge/button/toggle/modal/toast/dropdown variants that don't match the established shapes in `libs/ui` (check for accidental reinvention).
   - Components that should be in `libs/ui` (used or reusable across views) but were added directly in `apps/web` instead.
4. Report findings as: ✅ consistent | ⚠️ minor drift | ❌ must fix — with file:line references and, for each ❌/⚠️, the specific token that should have been used instead.
