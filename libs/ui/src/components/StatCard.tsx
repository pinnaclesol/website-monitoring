import * as React from 'react';
import { cn } from '../lib/cn';

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Small icon shown before the label (e.g. a monitor/signal glyph). */
  icon?: React.ReactNode;
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  /** Matches the mockup's `.stat-value.green`/`.stat-value.red` accents. */
  valueColor?: 'default' | 'green' | 'red';
}

const valueColorClasses: Record<NonNullable<StatCardProps['valueColor']>, string> = {
  default: 'text-text',
  green: 'text-green',
  red: 'text-red',
};

function StatCard({
  icon,
  label,
  value,
  sub,
  valueColor = 'default',
  className,
  ...props
}: StatCardProps) {
  return (
    <div
      className={cn('rounded-lg border border-border bg-bg px-5 py-4 shadow-sm', className)}
      {...props}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-text-muted">
        {icon ? (
          <span aria-hidden="true" className="[&_svg]:size-3.5 [&_svg]:shrink-0">
            {icon}
          </span>
        ) : null}
        {label}
      </div>
      <div
        className={cn(
          'mb-0.5 text-[26px] font-semibold leading-none',
          valueColorClasses[valueColor]
        )}
      >
        {value}
      </div>
      {sub ? <div className="text-[11px] text-text-subtle">{sub}</div> : null}
    </div>
  );
}

export { StatCard };
