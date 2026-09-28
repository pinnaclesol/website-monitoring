---
name: new-component
description: Scaffold a new shared UI component in libs/ui, pre-wired to the design-token system. Usage: /new-component <name>
allowed-tools: Read, Write, Glob, Grep
user-invocable: true
---

Scaffold a new shared component named `$ARGUMENTS` in `libs/ui`.

## Rules

- Decide first: is this a low-level primitive (goes in `libs/ui/src/components/ui/`, shadcn/ui style) or a composed/app-specific component (goes in `libs/ui/src/components/`)?
- Every color/spacing/typography choice must use the existing design-token Tailwind theme (CSS vars via `[data-theme]`, Geist/Geist Mono) — no hardcoded hex values.
- Must render correctly in both light and dark mode — check both before considering it done.
- Reuse existing primitives (Button, Badge, Input, Dialog, Toggle, etc.) rather than reimplementing their behavior.
- Export it from `libs/ui/src/index.ts`.

## Steps

1. Check `libs/ui/src/components/ui/` for an existing primitive that already covers this — if one's close, extend it instead of duplicating.
2. Create `libs/ui/src/components/<ui-or-not>/<name>.tsx` using the established prop patterns (see a sibling component for the shape — e.g. how `Button`/`Badge` accept `variant`/`size`).
3. Add it to `libs/ui/src/index.ts`.
4. If it introduces a new visual pattern not already covered by a token (a new status color, a new spacing scale value), add the token to the shared theme rather than inlining it — then use the token.
5. Confirm the file created and remind the user to sanity-check it in both themes.
