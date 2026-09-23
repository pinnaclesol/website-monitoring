import * as React from 'react';
import { cn } from '../lib/cn';

export type StatCardAccent = 'default' | 'blue' | 'green' | 'red' | 'yellow';

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Icon shown in a colored chip next to the label. */
  icon?: React.ReactNode;
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  /** Drives both the icon chip's color and the value's text color — one knob, not two, so they never disagree. */
  accent?: StatCardAccent;
}

const chipClasses: Record<StatCardAccent, string> = {
  default: 'bg-bg-muted text-text-muted',
  blue: 'bg-blue-bg text-blue',
  green: 'bg-green-bg text-green',
  red: 'bg-red-bg text-red',
  yellow: 'bg-yellow-bg text-yellow',
};

const valueClasses: Record<StatCardAccent, string> = {
  default: 'text-text',
  blue: 'text-blue',
  green: 'text-green',
  red: 'text-red',
  yellow: 'text-yellow',
};

/**
 * A colored icon chip (not a bare gray glyph) is what makes a stat card read
 * as designed rather than a plain data label — one visual anchor per card,
 * driven by the same `accent` that colors the value, so a "Down" card in
 * red reads as a unit instead of a gray icon next to an unrelated red number.
 */
function StatCard({ icon, label, value, sub, accent = 'default', className, ...props }: StatCardProps) {
  return (
    <div
      className={cn(
        'group rounded-lg border border-border bg-bg p-4 shadow-sm transition-all duration-150',
        'hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md',
        className
      )}
      {...props}
    >
      <div className="mb-3 flex items-center gap-2.5">
        {icon ? (
          <span
            aria-hidden="true"
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-md [&_svg]:size-4 [&_svg]:shrink-0',
              chipClasses[accent]
            )}
          >
            {icon}
          </span>
        ) : null}
        <span className="text-[11.5px] font-medium text-text-muted">{label}</span>
      </div>
      <div className={cn('mb-0.5 text-[28px] font-semibold leading-none tracking-tight', valueClasses[accent])}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-[11px] text-text-subtle">{sub}</div> : null}
    </div>
  );
}

export { StatCard };
