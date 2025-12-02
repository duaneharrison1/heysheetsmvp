import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Actions, Action } from "@/components/ui/ai-actions";
import { Task, TaskTrigger, TaskContent, TaskItem, TaskItemFile } from "@/components/ui/ai-task";
import { Bot, User, Copy, Check, ThumbsUp, ThumbsDown, RefreshCcw } from 'lucide-react';
import { likeMessage, dislikeMessage } from '@/lib/ai-actions';
import { Calendar, Clock, MapPin, Phone, ShoppingCart, Star, Package, Search, Database, Sparkles } from "lucide-react";
import ChatBubble from './ChatBubble';
import ProductCard from './ProductCard';
import ServiceCard from './ServiceCard';
import ServicesGrid from './ServicesGrid';
import HoursList from './HoursList';
import BookingCard from './BookingCard';
import LeadForm from './LeadForm';
import PreferencesForm from './PreferencesForm';
import RecommendationList from './RecommendationList';
// Calendar booking UI component - renders date/time picker for service bookings
import { BookingCalendar } from './BookingCalendar';

// Markdown parser for bot responses - renders bold, line breaks, horizontal rules
// Currently disabled - uncomment to enable formatted bot messages
// import { parseMarkdown } from '@/lib/markdown';

interface TaskStep {
  label: string;
  isLoading?: boolean;
  file?: string;
}

interface Message {
  id: string;
  type: 'bot' | 'user';
  content: string;
  timestamp: Date;
  richContent?: any;
  tasks?: {
    title: string;
    icon?: React.ReactNode;
    steps: TaskStep[];
  };
}

interface ChatMessageProps {
  message: Message;
  storeLogo: string;
  storeId: string;
  conversationHistory: Array<{ role: string; content: string }>;
  onActionClick?: (action: string, data?: any) => void;
  onRegenerate?: (messageId: string) => void;
}

// Rich content components are extracted to separate files for reuse and clarity

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, storeLogo, storeId, conversationHistory, onActionClick, onRegenerate }) => {
  // State for action feedback
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);

  // Handle copy message content
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  // Handle like/dislike feedback - sends to Supabase
  const handleFeedback = async (type: 'like' | 'dislike') => {
    if (feedback === type) return; // Already selected
    setFeedback(type);
    
    // Send to Supabase
    if (type === 'like') {
      await likeMessage(storeId, message.id, message.content, conversationHistory);
    } else {
      await dislikeMessage(storeId, message.id, message.content, conversationHistory);
    }
  };

  // Handle regenerate
  const handleRegenerate = () => {
    if (onRegenerate) {
      onRegenerate(message.id);
    }
  };
  const renderRichContent = () => {
    if (!message.richContent) return null;

    const { type, data } = message.richContent;

    switch (type) {
      case 'products':
        if (!data || data.length === 0) {
          return (
            <div className="mt-3 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">No products available at the moment.</p>
            </div>
          );
        }

        const scrollRef = useRef<HTMLDivElement | null>(null);
        const [canScrollLeft, setCanScrollLeft] = React.useState(false);
        const [canScrollRight, setCanScrollRight] = React.useState(false);

        // Refs for each product item to measure heights
        const itemRefs = React.useRef<Array<HTMLDivElement | null>>([]);
        const [maxItemHeight, setMaxItemHeight] = React.useState<number | null>(null);

        const measureHeights = () => {
          const heights = itemRefs.current.map(el => el ? Math.ceil(el.getBoundingClientRect().height) : 0);
          const mh = heights.length ? Math.max(...heights) : 0;
          setMaxItemHeight(mh || null);
        };

        const updateScrollButtons = () => {
          const el = scrollRef.current;
          if (!el) return;
          const { scrollLeft, scrollWidth, clientWidth } = el;
          const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
          const tolerance = 4; // small tolerance for rounding
          setCanScrollLeft(scrollLeft > tolerance);
          setCanScrollRight(scrollLeft < maxScrollLeft - tolerance);
        };

        const scrollBy = (delta: number) => {
          if (!scrollRef.current) return;
          scrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
          // after scrolling, update button states (allow smooth scroll to finish)
          setTimeout(updateScrollButtons, 250);
        };

        React.useEffect(() => {
          updateScrollButtons();
          // measure heights after a tick to ensure DOM is painted
          setTimeout(measureHeights, 50);
          const el = scrollRef.current;
          if (!el) return;
          const onScroll = () => updateScrollButtons();
          el.addEventListener('scroll', onScroll, { passive: true });

          // ResizeObserver to detect size changes (images loading, font changes, etc.)
          let ro: ResizeObserver | null = null;
          try {
            if ((window as any).ResizeObserver) {
              ro = new ResizeObserver(() => {
                measureHeights();
                updateScrollButtons();
              });
              itemRefs.current.forEach((it) => { if (it) ro!.observe(it); });
            }
          } catch (e) {
            ro = null;
          }

          const onResize = () => { updateScrollButtons(); measureHeights(); };
          window.addEventListener('resize', onResize);

          return () => {
            el.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onResize);
            if (ro) {
              try { ro.disconnect(); } catch (_) { /* ignore */ }
            }
          };
        }, [data]);

        return (
          <div className="relative mt-3">
            <button
              onClick={() => scrollBy(-300)}
              disabled={!canScrollLeft}
              aria-disabled={!canScrollLeft}
              className={`absolute left-0 top-1/2 transform -translate-y-1/2 bg-primary text-white p-1.5 rounded-full shadow-md z-10 ${!canScrollLeft ? 'opacity-40 pointer-events-none' : ''}`}
              aria-label="Previous products"
            >
              ←
            </button>

            <div ref={scrollRef} className="flex gap-3 overflow-x-auto no-scrollbar px-4 py-2 w-full box-border">
              {data.map((product: any, index: number) => (
                <div
                  key={index}
                  ref={(el) => { itemRefs.current[index] = el; }}
                  className="flex-shrink-0 w-48 sm:w-56 md:w-64 box-border"
                  style={maxItemHeight ? { minHeight: `${maxItemHeight}px` } : undefined}
                >
                  <ProductCard product={product} onActionClick={onActionClick} />
                </div>
              ))}
            </div>

            <button
              onClick={() => scrollBy(300)}
              disabled={!canScrollRight}
              aria-disabled={!canScrollRight}
              className={`absolute right-0 top-1/2 transform -translate-y-1/2 bg-primary text-white p-1.5 rounded-full shadow-md z-10 ${!canScrollRight ? 'opacity-40 pointer-events-none' : ''}`}
              aria-label="Next products"
            >
              →
            </button>
          </div>
        );

      case 'services':
        if (!data || data.length === 0) {
          return (
            <div className="mt-3 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">No services available at the moment.</p>
            </div>
          );
        }

        return (
          <div className="mt-3">
            <ServicesGrid services={data} onActionClick={onActionClick} />
          </div>
        );

      case 'hours':
        if (!data || data.length === 0) {
          return (
            <div className="mt-3 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Operating hours not available.</p>
            </div>
          );
        }
        return (
          <div className="mt-3">
            <HoursList hours={data} />
          </div>
        );

      case 'bookings':
        if (!data || data.length === 0) {
          return (
            <div className="mt-3 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">No bookings found.</p>
            </div>
          );
        }
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            {data.slice(0, 4).map((booking: any, index: number) => (
              <BookingCard 
                key={index} 
                booking={booking} 
                onActionClick={onActionClick}
              />
            ))}
          </div>
        );

      case 'quick_actions':
        return (
          <div className="flex flex-wrap gap-2 mt-3">
            {data.map((action: string, index: number) => (
              <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => onActionClick?.(action)}
                >
                  {action}
                </Button>
            ))}
          </div>
        );

      case 'lead_form':
        return (
          <div className="mt-3">
            <LeadForm
              {...data}
              maxWidth="500px"
              onSubmit={(formData: any) => {
                console.log('[ChatMessage] LeadForm submitted:', formData);
                onActionClick?.('submit_lead', formData);
              }}
            />
          </div>
        );

      // PreferencesForm component - collects user preferences for recommendations
      case 'preferences_form':
      case 'PreferencesForm':
        return (
          <div className="mt-3">
            <PreferencesForm
              {...data}
              maxWidth="500px"
              onSubmit={(formData: any) => {
                console.log('[ChatMessage] PreferencesForm submitted:', formData);
                onActionClick?.('get_recommendations', formData);
              }}
            />
          </div>
        );

      // RecommendationList component - displays personalized recommendations
      case 'recommendations':
      case 'RecommendationList':
        return (
          <div className="mt-3">
            <RecommendationList
              recommendations={data.recommendations || data}
              preferences={data.preferences}
              onActionClick={onActionClick}
            />
          </div>
        );

      // Renders calendar UI for booking appointments - shows available slots and handles date/time selection
      case 'booking_calendar':
      case 'BookingCalendar':  // Backend sends PascalCase
        return (
          <div className="mt-3">
            <BookingCalendar
              service={data.service}
              slots={data.slots}
              unavailableDates={data.unavailableDates}
              prefill={data.prefill}
              onActionClick={onActionClick}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`group flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
      {message.type === 'bot' && (
        <div className="mt-1 flex-shrink-0">
          <Avatar className="w-9 h-9" variant="bot">
            <AvatarFallback className="avatar-fallback">
              <Bot className="w-4 h-4" />
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      <div className={`max-w-[85%] min-w-0 overflow-hidden box-border ${message.type === 'user' ? 'max-w-[70%]' : ''}`}>
        <ChatBubble type={message.type} timestamp={message.timestamp}>
          {/* To enable markdown formatting, uncomment the import above and change to: {parseMarkdown(message.content)} */}
          <div className="text-sm leading-relaxed">{message.content}</div>
        </ChatBubble>
        
        {/* AI Task list showing work progress */}
        {message.type === 'bot' && message.tasks && (
          <Task className="mt-2">
            <TaskTrigger 
              title={message.tasks.title} 
              icon={message.tasks.icon || <Sparkles className="h-4 w-4" />}
              count={message.tasks.steps.length}
            />
            <TaskContent>
              {message.tasks.steps.map((step, index) => (
                <TaskItem key={index} isLoading={step.isLoading}>
                  {step.label}
                  {step.file && <TaskItemFile name={step.file} />}
                </TaskItem>
              ))}
            </TaskContent>
          </Task>
        )}
        
        {renderRichContent()}
        
        {/* AI Actions for bot messages (always visible). Labels are screen-reader only; no tooltip popovers in chat. */}
        {message.type === 'bot' && (
          <Actions className="mt-1.5">
            <Action
              onClick={handleCopy}
              isActive={copied}
              label={copied ? 'Copied' : 'Copy'}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Action>
            <Action
              onClick={() => handleFeedback('like')}
              isActive={feedback === 'like'}
              label="Like"
            >
              <ThumbsUp className="h-3.5 w-3.5" fill={feedback === 'like' ? 'currentColor' : 'none'} />
            </Action>
            <Action
              onClick={() => handleFeedback('dislike')}
              isActive={feedback === 'dislike'}
              label="Dislike"
            >
              <ThumbsDown className="h-3.5 w-3.5" fill={feedback === 'dislike' ? 'currentColor' : 'none'} />
            </Action>
            <Action
              onClick={handleRegenerate}
              label="Regenerate"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
            </Action>
          </Actions>
        )}
      </div>

      {message.type === 'user' && (
        <div className="mt-1 flex-shrink-0">
          <Avatar className="w-9 h-9" variant="user">
            <AvatarFallback className="avatar-fallback">
              <User className="w-4 h-4" />
            </AvatarFallback>
          </Avatar>
        </div>
      )}
    </div>
  );
};

export default ChatMessage;