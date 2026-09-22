import * as React from 'react';
import { cn } from '../lib/cn';

export interface IncidentBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

function WarningIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

/**
 * Renders nothing when `children` is falsy/empty — pass the active-incident
 * summary text as children only when there's something to show; there's no
 * separate visibility boolean to avoid the two staying out of sync.
 */
function IncidentBanner({ children, className, ...props }: IncidentBannerProps) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className={cn(
        'mb-4 flex items-center gap-2.5 rounded border border-red-border bg-red-bg px-4 py-2.5 text-[13px] font-medium text-red',
        className
      )}
      {...props}
    >
      <WarningIcon />
      <span>{children}</span>
    </div>
  );
}

export { IncidentBanner };
