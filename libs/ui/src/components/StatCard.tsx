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
  /** Adds a pulsing ring behind the icon chip — reserve for a card reporting something actively wrong right now (e.g. a nonzero "Down" count), not for neutral totals. */
  pulse?: boolean;
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

/** A faint ring around the icon chip, same accent, for depth — matches IncidentBanner's icon treatment. */
const ringClasses: Record<StatCardAccent, string> = {
  default: 'ring-text-subtle/10',
  blue: 'ring-blue/10',
  green: 'ring-green/10',
  red: 'ring-red/10',
  yellow: 'ring-yellow/10',
};

/** The `pulse` prop's ping animation color — one shade lighter than the ring so it reads as motion, not just a static halo. */
const pingClasses: Record<StatCardAccent, string> = {
  default: 'bg-text-subtle/20',
  blue: 'bg-blue/20',
  green: 'bg-green/20',
  red: 'bg-red/20',
  yellow: 'bg-yellow/20',
};

/**
 * A colored icon chip (not a bare gray glyph) is what makes a stat card read
 * as designed rather than a plain data label — one visual anchor per card,
 * driven by the same `accent` that colors the value and the corner glow, so
 * a "Down" card in red reads as a unit instead of unrelated colored pieces.
 */
function StatCard({ icon, label, value, sub, accent = 'default', pulse = false, className, ...props }: StatCardProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border bg-bg p-4 shadow-sm transition-all duration-150',
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
              'relative flex size-10 shrink-0 items-center justify-center rounded-xl ring-4 [&_svg]:size-4 [&_svg]:shrink-0',
              chipClasses[accent],
              ringClasses[accent]
            )}
          >
            {pulse ? (
              <span className={cn('absolute inline-flex size-full animate-ping rounded-xl', pingClasses[accent])} />
            ) : null}
            <span className="relative">{icon}</span>
          </span>
        ) : null}
      </div>
      {sub ? <div className="relative mt-2.5 text-[11px] text-text-subtle">{sub}</div> : null}
    </div>
  );
}

export { StatCard };
