import * as React from 'react';
import { cn } from '../../lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-md border border-[var(--vscode-input-border,rgba(128,128,128,0.3))] bg-[var(--vscode-input-background,#1e1e1e)] px-3 py-2 text-sm text-[var(--vscode-input-foreground,#ccc)] shadow-sm placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--vscode-focusBorder,#007acc)] disabled:cursor-not-allowed disabled:opacity-50 font-mono',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
