import React from 'react';
import { cn } from '../../lib/utils';

export interface MdiIconProps extends React.SVGProps<SVGSVGElement> {
  path: string;
  size?: number;
  className?: string;
}

export const MdiIcon: React.FC<MdiIconProps> = ({
  path,
  size = 18,
  className,
  ...props
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      className={cn('inline-block shrink-0 align-middle', className)}
      {...props}
    >
      <path d={path} />
    </svg>
  );
};
