import * as React from 'react';
import { cn } from '../../lib/cn';

export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
}

function EmptyState({ icon, title, description, className, ...props }: EmptyStateProps) {
  return (
    <div className={cn('px-6 py-11 text-center', className)} {...props}>
      {icon ? (
        <div
          aria-hidden="true"
          className="mx-auto mb-3.5 flex size-11 items-center justify-center rounded bg-bg-muted text-text-subtle [&_svg]:size-5"
        >
          {icon}
        </div>
      ) : null}
      <div className="mb-1 text-sm font-medium text-text">{title}</div>
      {description ? <div className="text-[13px] text-text-muted">{description}</div> : null}
    </div>
  );
}

export { EmptyState };
