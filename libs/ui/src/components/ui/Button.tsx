import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

/**
 * Button shapes/colors come entirely from design tokens declared in
 * `libs/ui/src/styles/globals.css` (--accent, --red, --border, ...) via
 * their Tailwind utility aliases (bg-accent, text-accent-fg, border-red-border, ...).
 * No literal color values here — every variant must look correct in both
 * light (default) and `[data-theme="dark"]`.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg ' +
    'disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'border border-transparent bg-accent text-accent-fg hover:opacity-90',
        outline: 'border border-border bg-bg text-text hover:bg-bg-muted',
        ghost: 'border border-transparent bg-transparent text-text hover:bg-bg-muted',
        danger: 'border border-red-border bg-red-bg text-red hover:bg-red-border',
      },
      size: {
        default: 'h-9 rounded px-4 text-sm',
        sm: 'h-8 rounded-sm px-3 text-xs',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as the child element instead of a <button> (e.g. wrap a Next.js <Link>). */
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
