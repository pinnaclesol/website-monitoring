import * as React from 'react';
import { cn } from '../../lib/cn';

export interface ToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  'aria-label'?: string;
}

/**
 * Switch control. Wraps a real (visually-hidden) `<input type="checkbox">`
 * so keyboard/screen-reader users get native toggle semantics for free —
 * the visible track/thumb are just styled siblings driven by `peer-checked`.
 * The thumb is intentionally always white (see `--toggle-thumb` in
 * globals.css) — matching the mockup, which never overrides it for dark
 * mode either.
 */
const Toggle = React.forwardRef<HTMLInputElement, ToggleProps>(
  ({ checked, onCheckedChange, disabled, className, id, name, ...ariaProps }, ref) => {
    return (
      <label
        className={cn(
          'relative inline-flex h-[19px] w-[34px] shrink-0 items-center',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          className
        )}
      >
        <input
          ref={ref}
          id={id}
          name={name}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="peer sr-only"
          {...ariaProps}
        />
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-0 rounded-full bg-border-strong transition-colors duration-200',
            'peer-checked:bg-green',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg'
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute left-[3px] size-[13px] rounded-full bg-toggle-thumb',
            'shadow-[0_1px_2px_0_rgba(0,0,0,0.2)] transition-transform duration-200',
            'peer-checked:translate-x-[15px]'
          )}
        />
      </label>
    );
  }
);
Toggle.displayName = 'Toggle';

export { Toggle };
