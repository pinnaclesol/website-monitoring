import * as React from 'react';
import { cn } from '../../lib/cn';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

/**
 * Styled native `<select>` (e.g. the monitors-table status filter). The
 * mockup renders its chevron as a hardcoded-color SVG data-URI
 * `background-image`, which bakes a literal color into markup and can't
 * react to `[data-theme="dark"]` — here it's a real SVG element colored via
 * the `text-text-subtle` token instead, absolutely positioned to land in
 * the same spot.
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <span className="relative inline-block w-full">
        <select
          ref={ref}
          className={cn(
            'h-9 w-full cursor-pointer appearance-none rounded border border-border bg-bg py-2 pl-3 pr-[30px] text-sm text-text transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute right-[10px] top-1/2 -translate-y-1/2 text-text-subtle"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    );
  }
);
Select.displayName = 'Select';

export { Select };
