/**
 * AI Task Component
 * Task lists showing AI's work progress like Claude Artifacts.
 * Collapsible task list with file references.
 * 
 * Based on Vercel AI SDK patterns.
 * Apache License 2.0
 */
import * as React from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { ChevronDown, Search, FileText, Loader2 } from 'lucide-react';

// ============================================================================
// TaskItemFile - File reference badge
// ============================================================================

export type TaskItemFileProps = React.ComponentProps<'span'> & {
  /** File name to display */
  name?: string;
};

export const TaskItemFile = ({
  children,
  name,
  className,
  ...props
}: TaskItemFileProps) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-md border bg-secondary px-1.5 py-0.5 text-foreground text-xs font-medium',
      className
    )}
    {...props}
  >
    <FileText className="h-3 w-3 text-muted-foreground" />
    {name || children}
  </span>
);

// ============================================================================
// TaskItem - Individual task step
// ============================================================================

export type TaskItemProps = React.ComponentProps<'div'> & {
  /** Show loading spinner */
  isLoading?: boolean;
};

export const TaskItem = ({ 
  children, 
  className, 
  isLoading,
  ...props 
}: TaskItemProps) => (
  <div 
    className={cn('flex items-center gap-2 text-muted-foreground text-sm', className)} 
    {...props}
  >
    {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
    {children}
  </div>
);

// ============================================================================
// Task - Main collapsible container
// ============================================================================

export type TaskProps = React.ComponentProps<typeof Collapsible>;

export const Task = ({
  defaultOpen = true,
  className,
  ...props
}: TaskProps) => (
  <Collapsible
    className={cn('w-full', className)}
    defaultOpen={defaultOpen}
    {...props}
  />
);

// ============================================================================
// TaskTrigger - Clickable header to expand/collapse
// ============================================================================

export type TaskTriggerProps = Omit<React.ComponentProps<typeof CollapsibleTrigger>, 'children'> & {
  /** Title text shown in the trigger */
  title: string;
  /** Custom icon (defaults to Search) */
  icon?: React.ReactNode;
  /** Number of items (optional badge) */
  count?: number;
};

export const TaskTrigger = ({
  className,
  title,
  icon,
  count,
  ...props
}: TaskTriggerProps) => (
  <CollapsibleTrigger asChild className={cn('group w-full', className)} {...props}>
    <div className="flex cursor-pointer items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
      {icon ?? <Search className="h-4 w-4" />}
      <p className="text-sm flex-1">{title}</p>
      {count !== undefined && (
        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{count}</span>
      )}
      <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
    </div>
  </CollapsibleTrigger>
);

// ============================================================================
// TaskContent - Collapsible content area
// ============================================================================

export type TaskContentProps = React.ComponentProps<typeof CollapsibleContent>;

export const TaskContent = ({
  children,
  className,
  ...props
}: TaskContentProps) => (
  <CollapsibleContent
    className={cn('overflow-hidden', className)}
    {...props}
  >
    <div className="mt-3 space-y-1.5 border-l-2 border-muted pl-4 ml-2">
      {children}
    </div>
  </CollapsibleContent>
);

// ============================================================================
// Export
// ============================================================================

export default { Task, TaskTrigger, TaskContent, TaskItem, TaskItemFile };
