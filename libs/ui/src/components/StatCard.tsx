import * as React from 'react';
import { cn } from '../lib/cn';

export type StatCardAccent = 'default' | 'blue' | 'green' | 'red' | 'yellow';

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Icon shown in a colored chip next to the label. */
  icon?: React.ReactNode;
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  /** Drives the icon chip's color, the value's text color, and the corner glow — one knob, not three, so they never disagree. */
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

/** A soft, oversized color wash in the corner — the same accent as the chip/value, at low opacity — is what gives the card depth instead of a flat white rectangle. */
const glowClasses: Record<StatCardAccent, string> = {
  default: 'bg-text-subtle/10',
  blue: 'bg-blue/15',
  green: 'bg-green/15',
  red: 'bg-red/15',
  yellow: 'bg-yellow/15',
};

/**
 * A colored icon chip (not a bare gray glyph) is what makes a stat card read
 * as designed rather than a plain data label — one visual anchor per card,
 * driven by the same `accent` that colors the value and the corner glow, so
 * a "Down" card in red reads as a unit instead of unrelated colored pieces.
 */
function StatCard({ icon, label, value, sub, accent = 'default', className, ...props }: StatCardProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-lg border border-border bg-bg p-4 shadow-sm transition-all duration-150',
        'hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md',
        className
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -right-5 -top-5 size-24 rounded-full blur-2xl transition-opacity duration-150 group-hover:opacity-80',
          glowClasses[accent]
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11.5px] font-medium text-text-muted">{label}</div>
          <div className={cn('mt-1.5 text-[30px] font-semibold leading-none tracking-tight', valueClasses[accent])}>
            {value}
          </div>
        </div>
        {icon ? (
          <span
            aria-hidden="true"
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4 [&_svg]:shrink-0',
              chipClasses[accent]
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      {sub ? <div className="relative mt-2.5 text-[11px] text-text-subtle">{sub}</div> : null}
    </div>
  );
}

export { StatCard };
