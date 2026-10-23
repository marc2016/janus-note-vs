import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--vscode-focusBorder,#007acc)] disabled:pointer-events-none disabled:opacity-45 cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--vscode-button-background,#007acc)] text-[var(--vscode-button-foreground,#ffffff)] hover:bg-[var(--vscode-button-hoverBackground,#0062a3)] border border-[var(--vscode-button-border,transparent)] shadow-sm font-medium',
        destructive:
          'bg-red-600 text-white hover:bg-red-700 shadow-sm font-medium border border-red-700',
        outline:
          'border border-[var(--vscode-button-border,var(--vscode-editorWidget-border,rgba(128,128,128,0.4)))] bg-transparent text-[var(--vscode-foreground,#cccccc)] hover:bg-[var(--vscode-toolbar-hoverBackground,rgba(255,255,255,0.1))] hover:text-[var(--vscode-foreground,#ffffff)]',
        secondary:
          'bg-[var(--vscode-button-secondaryBackground,#3a3d41)] text-[var(--vscode-button-secondaryForeground,#ffffff)] hover:bg-[var(--vscode-button-secondaryHoverBackground,#45494e)] border border-[var(--vscode-button-border,rgba(128,128,128,0.25))] shadow-sm font-medium',
        ghost:
          'hover:bg-[var(--vscode-toolbar-hoverBackground,rgba(255,255,255,0.1))] text-[var(--vscode-foreground,#cccccc)] hover:text-[var(--vscode-foreground,#ffffff)]',
        link: 'text-[var(--vscode-textLink-foreground,#3794ff)] underline-offset-4 hover:underline',
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
