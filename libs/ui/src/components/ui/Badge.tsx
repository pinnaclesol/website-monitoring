import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

/**
 * Status pill: colored dot + label. `status` maps 1:1 to the monitor's
 * up/down/paused/checking state and to the green/red/yellow/blue design
 * tokens — never a hardcoded color.
 */
const badgeVariants = cva(
  'inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      status: {
        up: 'border-green-border bg-green-bg text-green',
        down: 'border-red-border bg-red-bg text-red',
        paused: 'border-yellow-border bg-yellow-bg text-yellow',
        checking: 'border-blue-border bg-blue-bg text-blue',
        // Up, but slower than the configured threshold — same tokens as `paused`.
        slow: 'border-yellow-border bg-yellow-bg text-yellow',
      },
    },
    defaultVariants: {
      status: 'up',
    },
  }
);

const dotVariants = cva('size-1.5 shrink-0 rounded-full', {
  variants: {
    status: {
      up: 'bg-green',
      down: 'bg-red',
      paused: 'bg-yellow',
      checking: 'bg-blue animate-pulse',
      slow: 'bg-yellow',
    },
  },
  defaultVariants: {
    status: 'up',
  },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Text content of the pill. Falls back to `children` if omitted. */
  label?: React.ReactNode;
}

function Badge({ className, status, label, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ status, className }))} {...props}>
      <span aria-hidden="true" className={cn(dotVariants({ status }))} />
      {label ?? children}
    </span>
  );
}

export { Badge, badgeVariants };
