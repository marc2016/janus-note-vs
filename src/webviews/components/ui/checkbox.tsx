import * as React from 'react';
import { cn } from '../../lib/utils';
import { MdiIcon } from './MdiIcon';
import { mdiCheck } from '@mdi/js';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked = false, onCheckedChange, id, disabled, ...props }, ref) => {
    return (
      <span className="relative inline-flex items-center justify-center shrink-0">
        <input
          type="checkbox"
          id={id}
          ref={ref}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className={cn(
            'peer appearance-none h-4 w-4 shrink-0 rounded-sm border border-[var(--vscode-checkbox-border,rgba(128,128,128,0.5))] bg-[var(--vscode-checkbox-background,transparent)] shadow-sm transition-colors cursor-pointer checked:bg-[var(--vscode-button-background,#007acc)] checked:border-[var(--vscode-button-background,#007acc)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--vscode-focusBorder,#007acc)] disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          {...props}
        />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[var(--vscode-button-foreground,#ffffff)] opacity-0 peer-checked:opacity-100 transition-opacity">
          <MdiIcon path={mdiCheck} size={12} />
        </span>
      </span>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };

