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
import { ThumbsUp, ThumbsDown, RefreshCw, Copy, Check } from 'lucide-react';
import { likeMessage, dislikeMessage } from '@/lib/ai-actions';

// ============================================================================
// Types
// ============================================================================

export interface MessageActionsProps {
  storeId: string;
  messageId: string;
  messageContent: string;
  conversationHistory: Array<{ role: string; content: string }>;
  onRegenerate?: () => void;
  showCopy?: boolean;
  showRegenerate?: boolean;
}

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
// Message Actions - Pre-built component with like/dislike/regenerate/copy
// ============================================================================

export const MessageActions = ({
  storeId,
  messageId,
  messageContent,
  conversationHistory,
  onRegenerate,
  showCopy = true,
  showRegenerate = true,
}: MessageActionsProps) => {
  const [feedback, setFeedback] = React.useState<'like' | 'dislike' | null>(null);
  const [copied, setCopied] = React.useState(false);

  const handleLike = async () => {
    if (feedback === 'like') return; // Already liked
    setFeedback('like');
    await likeMessage(storeId, messageId, messageContent, conversationHistory);
  };

  const handleDislike = async () => {
    if (feedback === 'dislike') return; // Already disliked
    setFeedback('dislike');
    await dislikeMessage(storeId, messageId, messageContent, conversationHistory);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(messageContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = () => {
    onRegenerate?.();
  };

  return (
    <Actions>
      {showCopy && (
        <Action
          tooltip={copied ? 'Copied!' : 'Copy'}
          onClick={handleCopy}
          isActive={copied}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Action>
      )}
      <Action
        tooltip="Like"
        onClick={handleLike}
        isActive={feedback === 'like'}
      >
        <ThumbsUp className="h-4 w-4" />
      </Action>
      <Action
        tooltip="Dislike"
        onClick={handleDislike}
        isActive={feedback === 'dislike'}
      >
        <ThumbsDown className="h-4 w-4" />
      </Action>
      {showRegenerate && onRegenerate && (
        <Action tooltip="Regenerate" onClick={handleRegenerate}>
          <RefreshCw className="h-4 w-4" />
        </Action>
      )}
    </Actions>
  );
};

// ============================================================================
// Export
// ============================================================================

export default { Actions, Action, MessageActions };
