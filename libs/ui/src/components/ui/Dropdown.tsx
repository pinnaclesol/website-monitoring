'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../../lib/cn';

interface DropdownContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
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
 */
function Dropdown({ children, className }: DropdownProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
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
    <DropdownContext.Provider value={{ open, setOpen }}>
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
  ({ asChild = false, onClick, ...props }, ref) => {
    const { open, setOpen } = useDropdownContext('DropdownTrigger');
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
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

export type DropdownContentProps = React.HTMLAttributes<HTMLDivElement>;

const DropdownContent = React.forwardRef<HTMLDivElement, DropdownContentProps>(
  ({ className, ...props }, ref) => {
    const { open } = useDropdownContext('DropdownContent');
    if (!open) return null;
    return (
      <div
        ref={ref}
        role="menu"
        className={cn(
          'absolute right-0 top-[calc(100%+4px)] z-30 min-w-[150px] overflow-hidden rounded border border-border bg-bg shadow-lg',
          className
        )}
        {...props}
      />
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
