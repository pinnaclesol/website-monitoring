'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../../lib/cn';

interface DropdownContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

const DropdownContext = React.createContext<DropdownContextValue | null>(null);

function useDropdownContext(component: string) {
  const context = React.useContext(DropdownContext);
  if (!context) {
    throw new Error(`<${component}> must be rendered inside a <Dropdown>.`);
  }
  return context;
}

export interface DropdownProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Hand-rolled trigger + menu (row actions like "..." > Copy URL / Open site
 * / Remove). Matches the mockup's plain click-to-open menu exactly —
 * deliberately not `@radix-ui/react-dropdown-menu` for something this
 * simple; reach for that instead if focus-trapping/roving-tabindex-level
 * a11y becomes an actual requirement later.
 *
 * `DropdownContent` is portaled to `document.body` (fixed-positioned off the
 * trigger's own bounding rect) rather than absolutely positioned inside this
 * wrapper — a real bug this fixes: the monitors table wraps in
 * `overflow-x-auto`, which clips any `position: absolute` menu that would
 * render outside that scroll container's bounds (e.g. a row near the bottom
 * of the table). A portal can't be clipped by an ancestor's overflow.
 */
function Dropdown({ children, className }: DropdownProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      // The portaled menu lives outside rootRef in the DOM — check it too.
      const menuEl = document.getElementById(MENU_PORTAL_ID);
      if (menuEl?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRef }}>
      <div ref={rootRef} className={cn('relative inline-block', className)}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export interface DropdownTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const DropdownTrigger = React.forwardRef<HTMLButtonElement, DropdownTriggerProps>(
  ({ asChild = false, onClick, ...props }, forwardedRef) => {
    const { open, setOpen, triggerRef } = useDropdownContext('DropdownTrigger');
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={(node: HTMLButtonElement | null) => {
          triggerRef.current = node;
          if (typeof forwardedRef === 'function') forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        type={asChild ? undefined : 'button'}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
          onClick?.(event);
          setOpen(!open);
        }}
        {...props}
      />
    );
  }
);
DropdownTrigger.displayName = 'DropdownTrigger';

const MENU_PORTAL_ID = 'ui-dropdown-portal-root';

export type DropdownContentProps = React.HTMLAttributes<HTMLDivElement>;

const DropdownContent = React.forwardRef<HTMLDivElement, DropdownContentProps>(
  ({ className, ...props }, ref) => {
    const { open, triggerRef } = useDropdownContext('DropdownContent');
    const [position, setPosition] = React.useState<{ top: number; right: number } | null>(null);

    React.useLayoutEffect(() => {
      if (!open || !triggerRef.current) {
        setPosition(null);
        return;
      }
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }, [open, triggerRef]);

    if (!open || !position || typeof document === 'undefined') return null;

    return createPortal(
      <div
        ref={ref}
        id={MENU_PORTAL_ID}
        role="menu"
        style={{ position: 'fixed', top: position.top, right: position.right }}
        className={cn(
          'z-30 min-w-[150px] overflow-hidden rounded border border-border bg-bg shadow-lg',
          className
        )}
        {...props}
      />,
      document.body
    );
  }
);
DropdownContent.displayName = 'DropdownContent';

export interface DropdownItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  danger?: boolean;
}

const DropdownItem = React.forwardRef<HTMLButtonElement, DropdownItemProps>(
  ({ className, danger, onClick, ...props }, ref) => {
    const { setOpen } = useDropdownContext('DropdownItem');
    return (
      <button
        ref={ref}
        type="button"
        role="menuitem"
        onClick={(event) => {
          onClick?.(event);
          setOpen(false);
        }}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-text transition-colors hover:bg-bg-muted',
          '[&_svg]:size-4 [&_svg]:shrink-0',
          danger && 'text-red',
          className
        )}
        {...props}
      />
    );
  }
);
DropdownItem.displayName = 'DropdownItem';

function DropdownSeparator({ className }: { className?: string }) {
  return <div role="separator" className={cn('my-0.5 h-px bg-border', className)} />;
}

export { Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownSeparator };
