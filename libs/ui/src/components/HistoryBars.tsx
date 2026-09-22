import * as React from 'react';
import { cn } from '../lib/cn';

export type HistoryStatus = 'up' | 'down' | 'unknown';

export interface HistoryBarsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Oldest-to-newest (or newest-to-oldest — caller decides) list of per-check results. */
  history: HistoryStatus[];
}

const barStatusClasses: Record<HistoryStatus, string> = {
  up: 'bg-green opacity-80',
  down: 'bg-red opacity-90',
  unknown: 'bg-border-strong opacity-35',
};

const barStatusLabels: Record<HistoryStatus, string> = {
  up: 'Up',
  down: 'Down',
  unknown: 'No data',
};

/**
 * The "last 30 checks" sparkline: a row of thin bars, one per check, colored
 * by result. Pure/presentational — the caller supplies the already-ordered
 * history array (e.g. the last 30 `Check.isUp` values for a monitor).
 */
function HistoryBars({ history, className, ...props }: HistoryBarsProps) {
  return (
    <div className={cn('flex items-center gap-0.5', className)} {...props}>
      {history.map((status, index) => (
        <div
          key={index}
          title={barStatusLabels[status]}
          className={cn(
            'h-5 w-[5px] rounded-sm transition-transform duration-100 hover:scale-y-[1.2]',
            barStatusClasses[status]
          )}
        />
      ))}
    </div>
  );
}

export { HistoryBars };
