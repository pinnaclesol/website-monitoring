import * as React from 'react';
import { cn } from '../lib/cn';

export interface IncidentBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

function WarningIcon() {
  return (
    <svg
      width="15"
      height="15"
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
 * separate visibility boolean to avoid the two staying out of sync. Owns its
 * own icon (a colored chip, matching StatCard's icon-chip pattern) — callers
 * should pass only the message content, not a second icon.
 */
function IncidentBanner({ children, className, ...props }: IncidentBannerProps) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className={cn(
        'relative mb-5 flex items-start gap-3.5 overflow-hidden rounded-xl border border-red-border bg-red-bg py-3.5 pl-5 pr-4 shadow-md',
        'before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-red',
        className
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-red/15 text-red ring-4 ring-red/10"
      >
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-red/20" />
        <WarningIcon />
      </span>
      <div className="min-w-0 flex-1 pt-1 text-[13px] leading-snug text-red">{children}</div>
    </div>
  );
}

export { IncidentBanner };
