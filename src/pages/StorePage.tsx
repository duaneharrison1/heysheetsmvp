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
import { 
  Send, Clock, Loader2, Bot, AlertCircle, Globe, Instagram, Twitter, Facebook, 
  Phone, Mail, MapPin, Calendar, Store as StoreIcon, Tag, ExternalLink, 
  MessageCircle, ShoppingBag, Sparkles, CheckCircle2, Search, Database
} from "lucide-react";
import { useDebugStore } from "@/stores/useDebugStore";
import { generateCorrelationId } from "@/lib/debug/correlation-id";
import { requestTimer } from "@/lib/debug/timing";
// Test scenarios modal - shown when debug panel is open
import { ScenariosModal } from "@/components/qa/ScenariosModal";
// Test runner for executing QA scenarios
import { TestRunner } from "@/qa/lib/test-runner";
import type { TestScenario, GoalBasedTurnResult, TestStepResult } from "@/qa/lib/types";
import { isGoalBasedScenario } from "@/qa/lib/types";

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
  // State for test scenarios modal
  const [showScenariosModal, setShowScenariosModal] = useState(false);
  // Test runner instance for executing QA scenarios
  const [testRunner] = useState(() => new TestRunner());

  // Initial quick actions shown when chat first loads
  const initialQuickActions = [
    'Show me products',
    'Show me services',
    'Operating hours',
    'Store information'
  ];

  // Debug store
  const addRequest = useDebugStore((state) => state.addRequest);
  const updateRequest = useDebugStore((state) => state.updateRequest);
  const addDebugMessage = useDebugStore((state) => state.addMessage);
  const selectedModel = useDebugStore((state) => state.selectedModel);
  // Check if debug panel is open to show test scenarios option
  const isPanelOpen = useDebugStore((state) => state.isPanelOpen);

  useEffect(() => {
    if (storeId) {
      loadStore();
      checkAuth();
    }
  }, [storeId]);

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
      const suggestions = data.suggestions || [];

      // Update current suggestions for display above input
      setCurrentSuggestions(suggestions);

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

  const handleChatAction = (action: string) => {
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

  // Handles running a selected test scenario using the TestRunner
  const handleRunScenario = async (scenario: TestScenario) => {
    if (!storeId) return;

    // Clear existing messages for fresh test
    setMessages([{
      id: 'scenario-start',
      type: 'bot',
      content: `🧪 Starting test: **${scenario.name}**\n\n${scenario.description || ''}`,
      timestamp: new Date()
    }]);

    // Clear suggestions during test
    setCurrentSuggestions([]);

    try {
      // Run the scenario using TestRunner - handles both scripted and goal-based
      const execution = await testRunner.runScenario(
        scenario,
        storeId,
        selectedModel,  // Chat model
        selectedModel,  // Evaluator model (same for now)
        // Callback for scripted scenario step completion
        (result: TestStepResult) => {
          // Add bot response to chat
          setMessages(prev => [...prev, {
            id: `test-bot-${result.stepIndex}`,
            type: 'bot',
            content: result.botResponse,
            timestamp: new Date(),
            richContent: result.richContent
          }]);
        },
        // Callback for scripted scenario step start
        (userMessage: string, stepIndex: number) => {
          // Add user message to chat
          setMessages(prev => [...prev, {
            id: `test-user-${stepIndex}`,
            type: 'user',
            content: userMessage,
            timestamp: new Date()
          }]);
        },
        // Callbacks for goal-based scenarios
        {
          onTurnStart: (turn: number, userMessage: string) => {
            // Add simulated user message to chat
            setMessages(prev => [...prev, {
              id: `test-user-turn-${turn}`,
              type: 'user',
              content: `🤖 ${userMessage}`,  // Emoji indicates AI-generated
              timestamp: new Date()
            }]);
          },
          onTurnComplete: (result: GoalBasedTurnResult) => {
            // Add bot response to chat
            setMessages(prev => [...prev, {
              id: `test-bot-turn-${result.turnIndex}`,
              type: 'bot',
              content: result.botResponse,
              timestamp: new Date()
            }]);
          }
        }
      );

      // Show test summary at the end
      const isGoalBased = isGoalBasedScenario(scenario);
      const passed = isGoalBased
        ? execution.goalAchieved
        : execution.results?.every(r => r.passed) ?? false;

      const summaryLines = [
        passed ? '✅ **TEST PASSED**' : '❌ **TEST FAILED**',
        '',
        `**Scenario:** ${scenario.name}`,
        `**Type:** ${isGoalBased ? 'Goal-Based' : 'Scripted'}`,
        `**Duration:** ${((execution.endTime || Date.now()) - execution.startTime) / 1000}s`,
      ];

      if (isGoalBased) {
        summaryLines.push(`**Turns:** ${execution.turns?.length || 0}`);
        summaryLines.push(`**Goal Achieved:** ${execution.goalAchieved ? 'Yes ✓' : 'No ✗'}`);
      } else {
        const passedSteps = execution.results?.filter(r => r.passed).length || 0;
        const totalSteps = execution.results?.length || 0;
        summaryLines.push(`**Steps:** ${passedSteps}/${totalSteps} passed`);
      }

      if (execution.overallEvaluation) {
        summaryLines.push('');
        summaryLines.push(`**Quality Score:** ${execution.overallEvaluation.score}/100`);
        summaryLines.push(`**Evaluation:** ${execution.overallEvaluation.reasoning}`);
      }

      setMessages(prev => [...prev, {
        id: 'test-summary',
        type: 'bot',
        content: summaryLines.join('\n'),
        timestamp: new Date()
      }]);

      // Restore initial suggestions
      setCurrentSuggestions(initialQuickActions);

    } catch (error) {
      console.error('Test scenario failed:', error);
      setMessages(prev => [...prev, {
        id: 'test-error',
        type: 'bot',
        content: `❌ **Test failed with error:**\n${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      }]);
      setCurrentSuggestions(initialQuickActions);
    }
  };

  // (quick actions now provided via `initialQuickActions` + dynamic suggestions)

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
        <div className="w-96 flex-shrink-0 bg-card border-r border-border overflow-y-auto">
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
        </div>

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

          <div className="p-6 bg-card border-t border-border/10 shadow-[var(--shadow-card-sm)]">
            {/* Suggestions area - shows follow-up prompts and test scenarios option */}
            {(currentSuggestions.length > 0 || isPanelOpen) && !isTyping && (
              <div className="mb-3">
                <Suggestions>
                  {/* Show test scenarios pill when debug panel is open */}
                  {isPanelOpen && (
                    <Suggestion
                      suggestion="🧪 Scenarios"
                      onClick={() => setShowScenariosModal(true)}
                    />
                  )}
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

      {/* Test scenarios modal - for QA testing */}
      <ScenariosModal
        open={showScenariosModal}
        onOpenChange={setShowScenariosModal}
        onSelectScenario={handleRunScenario}
      />
    </div>
  );
}