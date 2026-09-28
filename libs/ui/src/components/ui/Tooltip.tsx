'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Hover/focus-triggered info popover — not the browser's native `title`
 * attribute, which can't be styled and looks inconsistent across OSes.
 * Portaled to `document.body` with `position: fixed` (same reason
 * `DropdownContent` is, see that file): an ancestor with `overflow-x-auto`
 * (the monitors table) would otherwise clip it for any row near an edge.
 * Deliberately hand-rolled rather than `@radix-ui/react-tooltip` — same
 * "simple enough not to need it" call already made for `Dropdown`.
 */
function Tooltip({ content, children, className }: TooltipProps) {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
  const triggerRef = React.useRef<HTMLSpanElement>(null);

  React.useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPosition(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({ top: rect.top - 8, left: rect.left + rect.width / 2 });
  }, [open]);

  return (
    <>
      <span
        ref={triggerRef}
        tabIndex={0}
        className="inline-flex cursor-help items-center outline-none"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {children}
      </span>
      {open && position && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="tooltip"
              style={{ position: 'fixed', top: position.top, left: position.left, transform: 'translate(-50%, -100%)' }}
              className={cn(
                'pointer-events-none z-40 w-max max-w-[240px] rounded-md border border-border bg-bg px-2.5 py-1.5 text-[11.5px] leading-snug text-text shadow-lg',
                className
              )}
            >
              {content}
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-full -mt-px size-2 -translate-x-1/2 rotate-45 border-b border-r border-border bg-bg"
              />
            </div>,
            document.body
          )
        : null}
    </>
  );
}

export { Tooltip };
