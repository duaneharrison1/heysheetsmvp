import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { H2, Lead } from "@/components/ui/heading";
import { supabase } from "@/lib/supabase";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { Send, Clock, Loader2, Bot, AlertCircle, Globe, Instagram, Twitter, Facebook, Phone, Mail, MapPin, Calendar } from "lucide-react";
import { useDebugStore } from "@/stores/useDebugStore";
import { generateCorrelationId } from "@/lib/debug/correlation-id";
import { requestTimer } from "@/lib/debug/timing";

interface Message {
  id: string;
  type: 'bot' | 'user';
  content: string;
  timestamp: Date;
  richContent?: {
    type: string;
    data: any;
  };
}

// Store type for typing the supabase response used in this component
interface Store {
  id: string;
  name: string;
  type?: string;
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
  [key: string]: any;
}

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Debug store
  const addRequest = useDebugStore((state) => state.addRequest);
  const updateRequest = useDebugStore((state) => state.updateRequest);
  const addDebugMessage = useDebugStore((state) => state.addMessage);
  const selectedModel = useDebugStore((state) => state.selectedModel);

  useEffect(() => {
    if (storeId) {
      loadStore();
      checkAuth();
    }
  }, [storeId]);

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
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || !storeId) return;

    // 🆕 START DEBUG TRACKING
    const requestId = generateCorrelationId();
    const requestStart = Date.now();

    requestTimer.start(requestId, 'total');
    addRequest({
      id: requestId,
      timestamp: requestStart,
      userMessage: content.trim(),
      model: selectedModel,
      timings: { requestStart },
      status: 'pending',
    });
    // 🆕 END DEBUG TRACKING

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

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-completion`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            messages: conversationHistory,
            storeId,
            model: selectedModel, // 🆕 Pass selected model
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

      // 🆕 UPDATE DEBUG TRACKING
      const totalDuration = requestTimer.end(requestId, 'total');

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
        intent: data.debug?.intent,
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

  const handleChatAction = (action: string) => {
    sendMessage(action);
  };

  const quickActions = [
    'Show me products',
    'Show me services',
    'Operating hours',
    'Store information'
  ];

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
    <div className="min-h-screen bg-background flex flex-col">

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

  {/* Main Content: Two Column Layout */}
    <div className="flex-1 flex w-full min-h-0">
        {/* Store Profile Side Panel */}
    <Card className="w-96 flex-shrink-0 rounded-none bg-transparent border border-border/10 shadow-[var(--shadow-card-sm)]">
          <CardContent className="p-6 flex-1 overflow-y-auto">
            {/* Store Avatar and Name */}
            <div className="flex flex-col items-center text-center mb-6">
              <Avatar className="w-20 h-20 mb-4" variant="user">
                <AvatarFallback className="avatar-fallback font-bold text-xl">
                  {store.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <CardTitle className="text-xl font-bold mb-1">{store.name}</CardTitle>
              {store.type && (
                <span className="text-sm text-muted-foreground capitalize">{store.type}</span>
              )}
            </div>

            {/* Description */}
            {store.description && (
              <div className="mb-6">
                <h3 className="font-semibold mb-2">About</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{store.description}</p>
              </div>
            )}

            {/* Contact Information */}
            <div className="mb-6 space-y-3">
              <h3 className="font-semibold">Contact</h3>
              
              {store.location && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span>{store.location}</span>
                </div>
              )}
              
              {store.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <a href={`tel:${store.phone}`} className="hover:text-primary">{store.phone}</a>
                </div>
              )}
              
              {store.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <a href={`mailto:${store.email}`} className="hover:text-primary">{store.email}</a>
                </div>
              )}
              
              {store.website && (
                <div className="flex items-center gap-3 text-sm">
                  <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <a href={store.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                    Website
                  </a>
                </div>
              )}
            </div>

            {/* Social Links */}
            {(store.instagram || store.twitter || store.facebook) && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Follow Us</h3>
                <div className="flex gap-3">
                  {store.instagram && (
                    <a 
                      href={`https://instagram.com/${store.instagram}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white hover:opacity-90 transition-opacity"
                    >
                      <Instagram className="w-4 h-4" />
                    </a>
                  )}
                  {store.twitter && (
                    <a 
                      href={`https://twitter.com/${store.twitter}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 rounded-full bg-blue-500 text-white hover:opacity-90 transition-opacity"
                    >
                      <Twitter className="w-4 h-4" />
                    </a>
                  )}
                  {store.facebook && (
                    <a 
                      href={`https://facebook.com/${store.facebook}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 rounded-full bg-blue-600 text-white hover:opacity-90 transition-opacity"
                    >
                      <Facebook className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Store Created Date */}
            {store.created_at && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Calendar className="w-3 h-3" />
                <span>Active since {new Date(store.created_at).toLocaleDateString()}</span>
              </div>
            )}
          </CardContent>
        </Card>

  {/* Chat Section */}
  <div className="flex-1 flex flex-col bg-muted min-w-0 min-h-0 overflow-hidden">
          {/* Chat header (bot profile) */}
          <div className="flex items-center gap-3 px-6 py-3 bg-card border-b border-border/10 shadow-[var(--shadow-card-sm)]">
            <Avatar className="w-10 h-10" variant="bot">
              <AvatarFallback className="avatar-fallback">
                <Bot className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <div>
              <H2 className="text-base">Store Assistant</H2>
              <Lead>I am your virtual assistant — ask me anything about this store.</Lead>
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                storeLogo={store.name.substring(0, 2).toUpperCase()}
                onActionClick={handleChatAction}
              />
            ))}

            {quickActions.length > 0 && messages.length === 1 && (
              <div className="flex flex-wrap gap-2">
                {quickActions.map((action, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleChatAction(action)}
                    className="text-xs h-8"
                  >
                    {action}
                  </Button>
                ))}
              </div>
            )}

            {isTyping && (
              <div className="flex gap-3">
                <Avatar className="w-9 h-9" variant="bot">
                  <AvatarFallback className="avatar-fallback">
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-card rounded-2xl px-4 py-3 border border-border">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-6 bg-card border-t border-border/10 shadow-[var(--shadow-card-sm)]">
            <div className="flex gap-3 items-center">
              <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(inputValue);
                    }
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
    </div>
  );
}
