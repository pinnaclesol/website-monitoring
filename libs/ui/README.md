# @uptime/ui

Shared shadcn/ui primitives, composed components, and the design-token theme for the uptime-monitor dashboard. `apps/web` should always import from here instead of hand-rolling equivalents.

## Usage in `apps/web`

1. Import the stylesheet **once**, in the root layout (e.g. `apps/web/app/layout.tsx`):

   ```ts
   import '@uptime/ui/styles/globals.css';
   ```

   This resolves to `libs/ui/src/styles/globals.css` via the `@uptime/ui/*` path alias in `tsconfig.base.json`. (CSS imports aren't always resolved through TS path aliases depending on the bundler config — if that import doesn't resolve for `apps/web`, use the relative path instead, e.g. `../../../libs/ui/src/styles/globals.css` from `apps/web/app/layout.tsx`.) It declares every design token (`--bg`, `--text`, `--green`/`--red`/`--yellow`/`--blue` + `-bg`/`-border` variants, radii, fonts) as light-mode defaults and their `[data-theme="dark"]` overrides, plus the Tailwind v4 `@theme` aliases that turn them into utility classes (`bg-bg`, `text-text-muted`, `border-red-border`, `rounded-lg`, ...).

2. Toggle dark mode by setting `data-theme="dark"` on an ancestor element (e.g. `<html data-theme={theme}>`); omit it (or set any other value) for light mode.

3. Import components from the package root:

   ```ts
   import { Button, Badge, Input, Card, LoginForm, cn } from '@uptime/ui';
   ```

## Rules for contributors (see `.claude/agents/ui-agent.md`)

- Never hardcode a hex color or one-off style in a component — use the theme's utility classes. If a screen needs something the token set doesn't have yet, add the token to `src/styles/globals.css`.
- New low-level primitives go in `src/components/ui/`; anything app-specific or composed from multiple primitives goes in `src/components/`.
- Every component must render correctly with and without `[data-theme="dark"]` on an ancestor.
