import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { H2, Lead } from "@/components/ui/heading";
import { Suggestions, Suggestion } from "@/components/ui/ai-suggestions";
import { supabase } from "@/lib/supabase";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { Task, TaskTrigger, TaskContent, TaskItem } from "@/components/ui/ai-task";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Send, Clock, Loader2, Bot, AlertCircle, Globe, Instagram, Twitter, Facebook,
  Phone, Mail, MapPin, Calendar, Store as StoreIcon, Tag, ExternalLink,
  MessageCircle, ShoppingBag, Sparkles, CheckCircle2, Search, Database, Info, X
} from "lucide-react";
// Debugging intentionally disabled on this page to avoid showing
// the global debug panel or toggle here.
import { precacheStoreData, getCachedStoreData, getCacheStats } from "@/lib/storeDataCache";

interface Message {
  id: string;
  type: 'bot' | 'user';
  content: string;
  timestamp: Date;
  richContent?: {
    type: string;
    data: any;
  };
  suggestions?: string[]; // Dynamic suggestions for follow-up prompts
}

// Store type for typing the supabase response used in this component
interface Store {
  id: string;
  name: string;
  type?: string;
  category?: string;
  logo?: string | null;
  sheet_id?: string | null;
  created_at?: string;
  description?: string;
  location?: string;
  website?: string;
  instagram?: string;
  twitter?: string;
  facebook?: string;
  phone?: string;
  email?: string;
  opening_hours?: string;
  services?: string[];
  [key: string]: any;
}

// Helper to determine if store is currently open based on opening_hours
const getStoreStatus = (openingHours?: string): { isOpen: boolean; statusText: string } => {
  if (!openingHours) return { isOpen: false, statusText: 'Hours not available' };
  
  // Simple heuristic - in production this would parse actual hours
  const now = new Date();
  const hour = now.getHours();
  const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
  
  // Default assumption: open 9am-6pm on weekdays, 10am-4pm on weekends
  const isOpen = isWeekday ? (hour >= 9 && hour < 18) : (hour >= 10 && hour < 16);
  
  return {
    isOpen,
    statusText: isOpen ? 'Open Now' : 'Closed'
  };
};

export default function StorePage() {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<Store | null>(null);
  const [hasSheet, setHasSheet] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentSuggestions, setCurrentSuggestions] = useState<string[]>([]);
  const [currentTaskStep, setCurrentTaskStep] = useState(0); // Track which task step is active (0, 1, 2)
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Mobile responsiveness: track if store info sheet is open
  const isMobile = useIsMobile();
  const [showStoreInfoSheet, setShowStoreInfoSheet] = useState(false);
  const [hasShownInitialSheet, setHasShownInitialSheet] = useState(false);

  // Initial quick actions shown when chat first loads
  const initialQuickActions = [
    'Show me products',
    'Show me services',
    'Operating hours',
    'Store information'
  ];

  // Debug store (disabled on StorePage) — no-ops to avoid rendering or
  // toggling the global debug panel from this page.
  // Signatures mirror the real store so calls in this file remain valid.
  const addRequest = (_req?: any) => {};
  const updateRequest = (_id?: any, _payload?: any) => {};
  const addDebugMessage = (_msg?: any) => {};
  const selectedModel: string | undefined = undefined;
  // A/B Test: Native tool calling mode (disabled here)
  const useNativeToolCalling = false;

  // Hide global debug UI elements while on the Store page (DOM-only, restored on unmount)
  useEffect(() => {
    const hiddenEls: { el: Element; previousDisplay: string | null }[] = [];

    // Helper to hide elements and remember previous display
    const hide = (el: Element | null) => {
      if (!el) return;
      const previous = (el as HTMLElement).style?.display || null;
      (el as HTMLElement).style.display = 'none';
      hiddenEls.push({ el, previousDisplay: previous });
    };

    // Hide the floating debug toggle (common container in App.tsx)
    hide(document.querySelector('.fixed.bottom-4.left-4.z-50'));

    // Hide any element containing the "Debug Panel" heading
    const panels = Array.from(document.querySelectorAll('div')).filter(d => d.textContent?.includes('Debug Panel'));
    panels.forEach(p => {
      // Walk up to the nearest fixed container to hide the full panel
      let node: Element | null = p;
      while (node && !(node instanceof HTMLElement && getComputedStyle(node).position === 'fixed')) {
        node = node.parentElement;
      }
      hide(node || p);
    });

    // Also hide any button explicitly labelled for opening the debug panel
    hide(document.querySelector('button[title*="Open debug panel"]'));

    return () => {
      // Restore previous display values
      hiddenEls.forEach(({ el, previousDisplay }) => {
        (el as HTMLElement).style.display = previousDisplay || '';
      });
    };
  }, []);

  useEffect(() => {
    if (storeId) {
      loadStore();
      checkAuth();
    }
  }, [storeId]);

  // Precache store data when store loads (warm cache BEFORE user sends message)
  useEffect(() => {
    const warmCache = async () => {
      if (!store?.id || !store?.sheet_id) return;

      console.log('[StorePage] Warming cache for store:', store.id);

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const cached = await precacheStoreData(store.id, supabaseUrl, anonKey);

        console.log('[StorePage] Cache warmed:', {
          services: cached.services.length,
          products: cached.products.length,
          hours: cached.hours.length,
        });

        // Log cache stats in dev
        if (import.meta.env.DEV) {
          const stats = getCacheStats(store.id);
          console.log('[StorePage] Cache stats:', stats);
        }
      } catch (error) {
        // Non-critical - just log warning
        console.warn('[StorePage] Cache warming failed (non-critical):', error);
      }
    };

    warmCache();
  }, [store?.id, store?.sheet_id]);

  // Show store info sheet initially on mobile when store loads
  useEffect(() => {
    if (isMobile && store && !hasShownInitialSheet && !loading) {
      setShowStoreInfoSheet(true);
      setHasShownInitialSheet(true);
    }
  }, [isMobile, store, hasShownInitialSheet, loading]);

  // Auto-progress through task steps when typing
  useEffect(() => {
    if (!isTyping) {
      setCurrentTaskStep(0); // Reset when not typing
      return;
    }

    // Progress to step 2 after 1.5s
    const timer1 = setTimeout(() => {
      setCurrentTaskStep(1);
    }, 3000);

    // Progress to step 3 after 3s
    const timer2 = setTimeout(() => {
      setCurrentTaskStep(2);
    }, 6000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isTyping]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setIsAuthenticated(!!user);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const loadStore = async () => {
    try {
      setLoading(true);
      console.log('[StorePage] Loading store:', storeId);

      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('id', storeId)
        .single();

      console.log('[StorePage] Query result:', { data, error });

      if (error || !data) {
        if (error?.code === 'PGRST116') {
          console.error('[StorePage] Store not found - it may not exist in the database');
        } else if (error?.message?.includes('policy')) {
          console.error('[StorePage] RLS policy blocked access');
        } else {
          console.error('[StorePage] Failed to load store:', error);
        }
        navigate('/');
        return;
      }

      // Cast supabase result into our local Store type (supabase client typings vary)
      const storeData = data as unknown as Store;

      setStore(storeData);
      setHasSheet(!!storeData?.sheet_id);

      // Initial bot message
      const initialMessage: Message = {
        id: '1',
        type: 'bot',
        content: `Hey there! 👋 I'm your assistant at ${storeData?.name ?? 'this store'}. How can I help you today?`,
        timestamp: new Date()
      };
      setMessages([initialMessage]);
      // show initial quick actions using the same suggestions component
      setCurrentSuggestions(initialQuickActions);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || !storeId) return;

    // Debug tracking (lightweight on this page)
    const requestId = Date.now().toString();
    const requestStart = Date.now();

    addRequest({
      id: requestId,
      timestamp: requestStart,
      userMessage: content.trim(),
      model: selectedModel,
      timings: { requestStart },
      status: 'pending',
    });

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    // Track user message in debug store
    if (import.meta.env.DEV) {
      addDebugMessage({
        id: userMessage.id,
        type: 'user',
        content,
        timestamp: Date.now()
      });
    }

    setInputValue('');
    setIsTyping(true);
    // clear visible suggestions while waiting for the assistant
    setCurrentSuggestions([]);

    try {
      // Prepare conversation history
      const conversationHistory = updatedMessages
        .filter(msg => msg.type === 'user' || msg.type === 'bot')
        .map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        }));

      // 🆕 ADD CORRELATION ID TO REQUEST
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'X-Request-ID': requestId,
      };

      updateRequest(requestId, { status: 'classifying' });

      // Get cached data to pass to chat-completion (avoids refetching)
      const cachedData = storeId ? getCachedStoreData(storeId) : null;
      if (cachedData) {
        console.log('[StorePage] Passing cached data to chat-completion:', {
          services: cachedData.services.length,
          products: cachedData.products.length,
          hours: cachedData.hours.length,
        });
      }

      // Check if native tool calling mode is enabled (from debug store)
      const endpoint = useNativeToolCalling ? 'chat-completion-native' : 'chat-completion';

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            messages: conversationHistory,
            storeId,
            model: selectedModel,
            cachedData, // Pass cached data to avoid refetching
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Chat request failed');
      }

      const data = await response.json();
      console.log('Chat response data:', data);
      const aiResponse = data.text || "I apologize, I couldn't generate a response.";
      const suggestions = data.suggestions || [];

      // Update current suggestions for display above input
      setCurrentSuggestions(suggestions);

      // Update lightweight timing
      const totalDuration = Date.now() - requestStart;

      updateRequest(requestId, {
        response: {
          text: aiResponse,
          richContent: data.richContent,
          duration: 0,
        },
        timings: {
          requestStart,
          totalDuration,
          intentDuration: data.debug?.intentDuration,
          functionDuration: data.debug?.functionDuration,
          responseDuration: data.debug?.responseDuration,
        },
        toolSelection: data.debug?.toolSelection,
        functionCalls: data.debug?.functionCalls,
        tokens: data.debug?.tokens,
        cost: data.debug?.cost,
        steps: data.debug?.steps, // 🆕 ADD: Step-by-step breakdown
        status: 'complete',
      });

      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: aiResponse,
        suggestions, // Include suggestions in the message
        // Attach richContent if functionResult returned UI components
        richContent: (() => {
          try {
            const fr = data.functionResult;
            if (!fr) return undefined;
            // Prefer explicit components array (products -> 'products', HoursList -> 'hours')
            if (Array.isArray(fr.components) && fr.components.length) {
              const productsComp = fr.components.find((c: any) => c.type === 'products' || c.type === 'Products');
              if (productsComp && productsComp.props && Array.isArray(productsComp.props.products)) {
                return { type: 'products', data: productsComp.props.products };
              }
              const servicesComp = fr.components.find((c: any) => c.type === 'services' || c.type === 'Services');
              if (servicesComp && servicesComp.props && Array.isArray(servicesComp.props.services)) {
                return { type: 'services', data: servicesComp.props.services };
              }

              const hoursComp = fr.components.find((c: any) => c.type === 'HoursList');
              if (hoursComp && hoursComp.props && Array.isArray(hoursComp.props.hours)) {
                return { type: 'hours', data: hoursComp.props.hours };
              }

              const leadFormComp = fr.components.find((c: any) => c.type === 'LeadForm');
              if (leadFormComp && leadFormComp.props) {
                return { type: 'lead_form', data: leadFormComp.props };
              }

              // PreferencesForm component - for collecting user preferences
              const preferencesFormComp = fr.components.find((c: any) => c.type === 'PreferencesForm');
              if (preferencesFormComp && preferencesFormComp.props) {
                return { type: 'PreferencesForm', data: preferencesFormComp.props };
              }

              // RecommendationList component - for displaying personalized recommendations
              const recommendationListComp = fr.components.find((c: any) => c.type === 'RecommendationList');
              if (recommendationListComp && recommendationListComp.props) {
                return { type: 'RecommendationList', data: recommendationListComp.props };
              }

              // BookingCalendar component - renders date/time picker for service bookings
              const bookingCalendarComp = fr.components.find((c: any) => c.type === 'BookingCalendar' || c.type === 'booking_calendar');
              if (bookingCalendarComp && bookingCalendarComp.props) {
                return { type: 'BookingCalendar', data: bookingCalendarComp.props };
              }
            }
            // Fallback: if functionResult.data.hours exists
            if (fr.data && Array.isArray(fr.data.hours) && fr.data.hours.length) {
              return { type: 'hours', data: fr.data.hours };
            }
            // Fallback: if functionResult.data.products exists
            if (fr.data && Array.isArray(fr.data.products) && fr.data.products.length) {
              return { type: 'products', data: fr.data.products };
            }
            return undefined;
          } catch (e) {
            console.error('Error mapping functionResult.components to richContent', e);
            return undefined;
          }
        })(),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botResponse]);

      // Track bot message in debug store
      if (import.meta.env.DEV) {
        addDebugMessage({
          id: botResponse.id,
          type: 'bot',
          content: aiResponse,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Error getting bot response:', error);

      // 🆕 TRACK ERROR
      updateRequest(requestId, {
        status: 'error',
        error: {
          stage: 'request',
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      });

      const fallbackResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, fallbackResponse]);

      // Clear suggestions on error
      setCurrentSuggestions([]);

      // Track error message in debug store
      if (import.meta.env.DEV) {
        addDebugMessage({
          id: fallbackResponse.id,
          type: 'bot',
          content: fallbackResponse.content,
          timestamp: Date.now()
        });
      }
    } finally {
      setIsTyping(false);
    }
  };

  /**
   * Handle chat actions from UI components.
   * All actions go through the LLM path for classification and response.
   */
  const handleChatAction = async (action: string, _data?: Record<string, any>) => {
    // All actions go through LLM path
    sendMessage(action);
  };

  // Regenerate: resend the last user message before the given bot message
  const handleRegenerate = (messageId: string) => {
    // Find the bot message index
    const botIndex = messages.findIndex(m => m.id === messageId);
    if (botIndex <= 0) return;
    
    // Find the user message right before this bot message
    let userMessageContent = '';
    for (let i = botIndex - 1; i >= 0; i--) {
      if (messages[i].type === 'user') {
        userMessageContent = messages[i].content;
        break;
      }
    }
    
    if (userMessageContent) {
      // Remove the bot message we're regenerating
      setMessages(prev => prev.filter(m => m.id !== messageId));
      // Resend the user message
      sendMessage(userMessageContent);
    }
  };

  // Build conversation history for feedback
  const getConversationHistory = () => {
    return messages.map(m => ({
      role: m.type === 'user' ? 'user' : 'assistant',
      content: m.content
    }));
  };

  // (quick actions now provided via `initialQuickActions` + dynamic suggestions)

  // Store info panel content - reused in both desktop sidebar and mobile sheet
  const StoreInfoContent = () => (
    <div className="p-6 space-y-6">
      
      {/* Store Header */}
      <div className="text-center">
        <Avatar className="w-20 h-20 mx-auto mb-4 ring-4 ring-background shadow-lg" variant="user">
          <AvatarFallback className="avatar-fallback font-bold text-xl bg-primary text-primary-foreground">
            {store.name.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <h1 className="text-xl font-bold text-foreground mb-1">{store.name}</h1>
        
        {/* Category & Type Badges */}
        <div className="flex items-center justify-center gap-2 mt-2">
          {store.category && (
            <Badge variant="secondary" className="text-xs">
              <Tag className="w-3 h-3 mr-1" />
              {store.category}
            </Badge>
          )}
          {store.type && (
            <Badge variant="outline" className="text-xs capitalize">
              <StoreIcon className="w-3 h-3 mr-1" />
              {store.type}
            </Badge>
          )}
        </div>

        {/* Open/Closed Status */}
        {store.opening_hours && (
          <div className="mt-3">
            {(() => {
              const status = getStoreStatus(store.opening_hours);
              return (
                <Badge 
                  variant={status.isOpen ? "default" : "secondary"} 
                  className={`text-xs ${status.isOpen ? 'bg-green-600 hover:bg-green-600' : 'bg-gray-500 hover:bg-gray-500 text-white'}`}
                >
                  <span className={`w-2 h-2 rounded-full mr-2 ${status.isOpen ? 'bg-green-300 animate-pulse' : 'bg-gray-300'}`} />
                  {status.statusText}
                </Badge>
              );
            })()}
          </div>
        )}
      </div>

      <Separator className="bg-border" />

      {/* Description / About */}
      {store.description && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">About</h3>
          <p className="text-sm text-foreground leading-relaxed">{store.description}</p>
        </div>
      )}

      {/* Opening Hours */}
      {store.opening_hours && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Hours</h3>
          <div className="flex items-start gap-3 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <span className="text-foreground">{store.opening_hours}</span>
          </div>
        </div>
      )}

      {/* Contact Information */}
      {(store.location || store.phone || store.email || store.website) && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contact</h3>
          <div className="space-y-3">
            {store.location && (
              <div className="flex items-start gap-3 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span className="text-foreground">{store.location}</span>
              </div>
            )}
            
            {store.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <a href={`tel:${store.phone}`} className="text-foreground hover:text-primary transition-colors">{store.phone}</a>
              </div>
            )}
            
            {store.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <a href={`mailto:${store.email}`} className="text-foreground hover:text-primary transition-colors truncate">{store.email}</a>
              </div>
            )}
            
            {store.website && (
              <div className="flex items-center gap-3 text-sm">
                <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <a href={store.website} target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-primary transition-colors flex items-center gap-1">
                  Visit Website
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Social Links */}
      {(store.instagram || store.twitter || store.facebook) && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Social</h3>
          <div className="flex gap-2">
            {store.instagram && (
              <a 
                href={`https://instagram.com/${store.instagram}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2.5 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white hover:opacity-90 transition-opacity shadow-sm"
                title="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
            )}
            {store.twitter && (
              <a 
                href={`https://twitter.com/${store.twitter}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2.5 rounded-lg bg-black text-white hover:opacity-90 transition-opacity shadow-sm"
                title="X (Twitter)"
              >
                <Twitter className="w-4 h-4" />
              </a>
            )}
            {store.facebook && (
              <a 
                href={`https://facebook.com/${store.facebook}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="p-2.5 rounded-lg bg-blue-600 text-white hover:opacity-90 transition-opacity shadow-sm"
                title="Facebook"
              >
                <Facebook className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Services / What you can do */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          <Sparkles className="w-3 h-3 inline mr-1" />
          What I Can Help With
        </h3>
        <div className="space-y-2">
          {(store.services && store.services.length > 0) ? (
            store.services.map((service, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-foreground">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span>{service}</span>
              </div>
            ))
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <MessageCircle className="w-4 h-4 text-primary flex-shrink-0" />
                <span>Answer questions about products</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <ShoppingBag className="w-4 h-4 text-primary flex-shrink-0" />
                <span>Browse services & offerings</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                <span>Check operating hours</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                <span>Get location & contact info</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer - Store Created Date */}
      <div className="pt-4 border-t border-border">
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Calendar className="w-3 h-3" />
          <span>Active since {store.created_at ? new Date(store.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A'}</span>
        </div>
      </div>

    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Store not found</h1>
          <Button onClick={() => navigate('/')}>Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col">

      {/* Warning if no sheet */}
      {!hasSheet && isAuthenticated && (
        <div className="bg-yellow-50">
          <div className="w-full px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold">No sheet connected</p>
                <p>
                  Connect a Google Sheet to enable data-driven responses.{' '}
                  <Link to={`/settings/${storeId}`} className="underline font-medium">
                    Connect now
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content: Responsive Layout */}
      <div className="flex-1 flex w-full min-h-0">
        {/* Store Profile Side Panel - Hidden on mobile, visible on md+ - sticky with internal scroll */}
        <div className="hidden md:flex md:flex-col w-96 flex-shrink-0 bg-card border-r border-border h-full overflow-y-auto">
          <StoreInfoContent />
        </div>

        {/* Chat Section - Full width on mobile */}
        <div className="flex-1 flex flex-col bg-muted min-w-0 h-full">
          {/* Chat header (bot profile) - fixed at top, never scrolls */}
          <div className="flex-shrink-0 flex items-center gap-3 px-4 md:px-6 py-3 bg-card border-b border-border/10 shadow-[var(--shadow-card-sm)]">
            <Avatar className="w-10 h-10" variant="bot">
              <AvatarFallback className="avatar-fallback">
                <Bot className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <H2 className="text-base">Store Assistant</H2>
              <Lead className="truncate">I am your virtual assistant — ask me anything about this store.</Lead>
            </div>
            {/* Mobile: Store info toggle button */}
            {isMobile && (
              <Button
                variant="outline"
                size="icon"
                className="flex-shrink-0"
                onClick={() => setShowStoreInfoSheet(true)}
              >
                <Info className="w-4 h-4" />
                <span className="sr-only">Store Info</span>
              </Button>
            )}
          </div>

          {/* Messages area - this is the ONLY thing that scrolls */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                storeLogo={store.name.substring(0, 2).toUpperCase()}
                storeId={storeId!}
                conversationHistory={getConversationHistory()}
                onActionClick={handleChatAction}
                onRegenerate={handleRegenerate}
              />
            ))}

            {/* initial quick actions moved to the suggestions bar above the input */}

            {isTyping && (
              <div className="flex gap-3 items-start">
                <Avatar className="w-9 h-9 flex-shrink-0" variant="bot">
                  <AvatarFallback className="avatar-fallback">
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-[280px] pt-1">
                  <Task defaultOpen={false}>
                    <TaskTrigger 
                      title="Processing your request..." 
                      icon={<Sparkles className="h-4 w-4" />}
                      count={currentTaskStep + 1}
                    />
                    <TaskContent>
                      {currentTaskStep >= 0 && (
                        <TaskItem isLoading={currentTaskStep === 0}>Analyzing your message</TaskItem>
                      )}
                      {currentTaskStep >= 1 && (
                        <TaskItem isLoading={currentTaskStep === 1}>Searching store data</TaskItem>
                      )}
                      {currentTaskStep >= 2 && (
                        <TaskItem isLoading={currentTaskStep === 2}>Generating response</TaskItem>
                      )}
                    </TaskContent>
                  </Task>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input footer - fixed at bottom, never scrolls */}
          <div className="flex-shrink-0 p-4 md:p-6 bg-card border-t border-border/10 shadow-[var(--shadow-card-sm)]">
            {/* Suggestions area - shows follow-up prompts only */}
            {currentSuggestions.length > 0 && !isTyping && (
              <div className="mb-3">
                <Suggestions>
                  {/* Regular AI-suggested follow-up prompts */}
                  {currentSuggestions.map((suggestion, index) => (
                    <Suggestion
                      key={index}
                      suggestion={suggestion}
                      onClick={handleChatAction}
                    />
                  ))}
                </Suggestions>
              </div>
            )}
            <div className="flex gap-3 items-center">
              <Input
                   value={inputValue}
                   onChange={(e) => { setInputValue(e.target.value); }}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter' && !e.shiftKey) {
                       e.preventDefault();
                       sendMessage(inputValue);
                     }
                   }}
                   onFocus={() => {
                     // Keep suggestions visible when input is focused
                   }}
                   placeholder="Type your message..."
                   className="flex-1 rounded-full bg-muted border border-input focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                 />
              <Button
                onClick={() => sendMessage(inputValue)}
                size="sm"
                className="rounded-full w-11 h-11 p-0"
                disabled={!inputValue.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Store Info Sheet */}
      <Sheet open={showStoreInfoSheet} onOpenChange={setShowStoreInfoSheet}>
        <SheetContent side="left" className="w-full sm:max-w-md p-0 overflow-y-auto">
          <SheetHeader className="px-6 pt-6 pb-0">
            <SheetTitle className="sr-only">{store.name} - Store Information</SheetTitle>
          </SheetHeader>
          <StoreInfoContent />
        </SheetContent>
      </Sheet>

    </div>
  );
}