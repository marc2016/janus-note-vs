import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vscode-focusBorder,#007acc)]',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[var(--vscode-badge-background,#4d4d4d)] text-[var(--vscode-badge-foreground,#fff)]',
        secondary:
          'border-transparent bg-white/10 text-white/80',
        destructive:
          'border-transparent bg-red-500/20 text-red-400 border-red-500/40',
        todo: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
        in_progress: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
        done: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        high: 'bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25',
        medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25',
        low: 'bg-slate-500/15 text-slate-400 border-slate-500/30 hover:bg-slate-500/25',
        outline: 'border-[var(--vscode-editorWidget-border,rgba(128,128,128,0.35))] text-[var(--vscode-editor-foreground,#d4d4d4)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
