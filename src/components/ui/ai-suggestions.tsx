"use client";
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

// Swipable horizontal container for suggestion pills
export interface SuggestionsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Suggestions = ({
  className,
  children,
  ...props
}: SuggestionsProps) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  return (
    <div
      ref={scrollRef}
      className={cn(
        'flex gap-2 overflow-x-auto scrollbar-none snap-x snap-mandatory',
        '-mx-1 px-1 py-1', // Allow pills to not get clipped
        className
      )}
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export type SuggestionProps = Omit<ComponentProps<typeof Button>, 'onClick'> & {
  suggestion: string;
  onClick?: (suggestion: string) => void;
};

export const Suggestion = ({
  suggestion,
  onClick,
  className,
  variant = 'outline',
  size = 'sm',
  children,
  ...props
}: SuggestionProps) => {
  const handleClick = () => {
    onClick?.(suggestion);
  };

  return (
    <Button
      className={cn(
        'cursor-pointer rounded-full px-4 py-1.5 h-auto text-xs font-medium',
        'flex-shrink-0 snap-start whitespace-nowrap',
        'border-primary/20 hover:bg-primary/5 hover:border-primary/40',
        'transition-colors duration-150',
        className
      )}
      onClick={handleClick}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {children || suggestion}
    </Button>
  );
};

export default { Suggestions, Suggestion };
