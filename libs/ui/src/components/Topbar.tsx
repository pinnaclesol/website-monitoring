import * as React from 'react';
import { cn } from '../lib/cn';

export interface TopbarProps extends React.HTMLAttributes<HTMLElement> {
  /** Right-aligned content (search, filters, "Add monitor" button, ...). */
  actions?: React.ReactNode;
}

/**
 * Presentational `<header>` shell. `children` renders on the left (typically
 * a `Breadcrumb`), `actions` renders right-aligned — matching the mockup's
 * `.topbar-left`/`.topbar-right`.
 */
const Topbar = React.forwardRef<HTMLElement, TopbarProps>(
  ({ className, children, actions, ...props }, ref) => (
    <header
      ref={ref}
      className={cn(
        'sticky top-0 z-[5] flex h-14 items-center justify-between border-b border-border bg-bg px-6',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-3">{children}</div>
      <div className="flex items-center gap-2">{actions}</div>
    </header>
  )
);
Topbar.displayName = 'Topbar';

export interface BreadcrumbProps extends React.HTMLAttributes<HTMLDivElement> {
  section: React.ReactNode;
  page: React.ReactNode;
}

function Breadcrumb({ section, page, className, ...props }: BreadcrumbProps) {
  return (
    <div className={cn('flex items-center gap-1.5 text-[13px] text-text-muted', className)} {...props}>
      <span>{section}</span>
      <span aria-hidden="true" className="text-border-strong">
        /
      </span>
      <span className="font-medium text-text">{page}</span>
    </div>
  );
}

export { Topbar, Breadcrumb };
