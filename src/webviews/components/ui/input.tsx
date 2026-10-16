import * as React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-8 w-full rounded-md border border-[var(--vscode-input-border,rgba(128,128,128,0.3))] bg-[var(--vscode-input-background,#1e1e1e)] px-3 py-1 text-sm text-[var(--vscode-input-foreground,#ccc)] shadow-sm transition-colors placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--vscode-focusBorder,#007acc)] disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
