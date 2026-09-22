import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../lib/cn';

/**
 * Presentational shell only — NOT wired to routes. `apps/web` composes
 * `SidebarNavItem` with `asChild` + Next.js `<Link>`/`usePathname()` for
 * real navigation and active-state detection.
 */
const Sidebar = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <aside
      ref={ref}
      className={cn(
        'fixed left-0 top-0 z-10 flex min-h-screen w-[248px] flex-col overflow-y-auto border-r border-border bg-bg-secondary',
        className
      )}
      {...props}
    />
  )
);
Sidebar.displayName = 'Sidebar';

function DefaultLogoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

export interface SidebarHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Wordmark next to the logo mark. Not hardcoded to any one product on purpose. */
  productName?: string;
  /** Icon rendered inside the logo mark; defaults to a generic monitor glyph. */
  icon?: React.ReactNode;
}

function SidebarHeader({
  productName = 'Uptime Monitor',
  icon,
  className,
  ...props
}: SidebarHeaderProps) {
  return (
    <div className={cn('border-b border-border px-4 pb-3.5 pt-[18px]', className)} {...props}>
      <div className="flex items-center gap-2.5 text-[14.5px] font-semibold text-text">
        <div
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-accent text-accent-fg"
        >
          {icon ?? <DefaultLogoIcon />}
        </div>
        {productName}
      </div>
    </div>
  );
}

const SidebarNav = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <nav ref={ref} className={cn('flex-1 px-2 pt-2', className)} {...props} />
  )
);
SidebarNav.displayName = 'SidebarNav';

export interface SidebarNavItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  /** Render as the child element (e.g. a Next.js `<Link>`) for real navigation. */
  asChild?: boolean;
}

/**
 * Icon + label nav row. No separate `icon` prop — same convention as
 * `Button`: pass the icon and label together as children (`<svg/>Dashboard`)
 * and it's sized via `[&_svg]`. This also keeps `asChild` working: Radix
 * `Slot` requires exactly one child element, so when `asChild` is set the
 * caller's single `<Link>` must itself contain the icon + label.
 */
const SidebarNavItem = React.forwardRef<HTMLButtonElement, SidebarNavItemProps>(
  ({ active, asChild = false, className, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : 'button'}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex w-full items-center gap-2 rounded-sm py-1.5 pl-[22px] pr-2 text-left text-[13px] text-text-muted transition-colors',
          'hover:bg-bg-muted hover:text-text',
          '[&_svg]:size-4 [&_svg]:shrink-0',
          active && 'bg-bg-muted font-medium text-text',
          className
        )}
        {...props}
      />
    );
  }
);
SidebarNavItem.displayName = 'SidebarNavItem';

const SidebarFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('border-t border-border px-2 py-2.5', className)} {...props} />
  )
);
SidebarFooter.displayName = 'SidebarFooter';

export { Sidebar, SidebarHeader, SidebarNav, SidebarNavItem, SidebarFooter };
