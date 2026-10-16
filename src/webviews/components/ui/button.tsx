import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--vscode-button-background,#007acc)] text-[var(--vscode-button-foreground,#fff)] hover:opacity-90 shadow',
        destructive:
          'bg-red-500/80 text-white hover:bg-red-500 shadow-sm',
        outline:
          'border border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.3))] bg-transparent text-[var(--vscode-editor-foreground,#ccc)] hover:bg-[var(--vscode-editorWidget-background,rgba(255,255,255,0.05))]',
        secondary:
          'bg-[var(--vscode-button-secondaryBackground,rgba(255,255,255,0.1))] text-[var(--vscode-button-secondaryForeground,#fff)] hover:opacity-90',
        ghost:
          'hover:bg-[var(--vscode-toolbar-hoverBackground,rgba(255,255,255,0.08))] text-[var(--vscode-editor-foreground,#ccc)]',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-8 px-3 py-1.5',
        sm: 'h-7 rounded-md px-2.5 text-xs',
        lg: 'h-10 rounded-md px-6',
        icon: 'h-7 w-7 p-1',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
