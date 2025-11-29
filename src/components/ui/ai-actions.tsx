/**
 * AI Actions Component
 * Interactive action buttons for AI chat interfaces.
 * Provides copy, like, dislike, and regenerate actions for messages.
 * 
 * Based on Vercel AI SDK patterns.
 * Apache License 2.0
 */
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ============================================================================
// Actions Container
// ============================================================================

export type ActionsProps = React.ComponentProps<'div'>;

export const Actions = ({ className, children, ...props }: ActionsProps) => (
  <div 
    className={cn('flex items-center gap-0.5', className)} 
    {...props}
  >
    {children}
  </div>
);

// ============================================================================
// Action Button
// ============================================================================

export type ActionProps = React.ComponentProps<typeof Button> & {
  /** Tooltip text shown on hover */
  tooltip?: string;
  /** Accessible label for screen readers */
  label?: string;
  /** Whether to show active/selected state */
  isActive?: boolean;
};

export const Action = ({
  tooltip,
  children,
  label,
  className,
  variant = 'ghost',
  size = 'sm',
  isActive = false,
  ...props
}: ActionProps) => {
  const button = (
    <Button
      className={cn(
        'h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/80',
        isActive && 'text-primary',
        className
      )}
      size="icon"
      type="button"
      variant={variant}
      {...props}
    >
      {children}
      <span className="sr-only">{label || tooltip}</span>
    </Button>
  );

  if (tooltip) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};

// ============================================================================
// Export
// ============================================================================

export default { Actions, Action };
