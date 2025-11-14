import * as React from 'react'
import { cn } from '@/lib/utils'

interface ChatBubbleProps {
  type: 'bot' | 'user'
  children: React.ReactNode
  timestamp?: Date
  className?: string
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ type, children, timestamp, className }) => {
  const isUser = type === 'user'

  const bubbleClasses = cn(
    'rounded-2xl px-4 py-3',
    isUser
      ? 'bg-primary text-primary-foreground'
      : 'bg-card text-card-foreground shadow-sm border border-border',
    className
  )

  return (
    <div role="article" aria-label={isUser ? 'Message from you' : 'Message from assistant'}>
      <div className={bubbleClasses} aria-live={isUser ? undefined : 'polite'}>
        {children}
        {timestamp && (
          <div className="text-xs opacity-70 mt-2">
            <time dateTime={timestamp.toISOString()}>{timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
          </div>
        )}
      </div>
    </div>
  )
}

export default ChatBubble
