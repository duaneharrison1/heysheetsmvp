import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { H2, Lead } from "@/components/ui/heading";
import { Suggestions, Suggestion } from "@/components/ui/ai-suggestions";
import { supabase } from "@/lib/supabase";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { Task, TaskTrigger, TaskContent, TaskItem } from "@/components/ui/ai-task";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Send, Loader2, Bot, Sparkles, Bug, Settings2
} from "lucide-react";
import { useDebugStore } from "@/stores/useDebugStore";
import { generateCorrelationId } from "@/lib/debug/correlation-id";
import { requestTimer } from "@/lib/debug/timing";
import { precacheStoreData, getCachedStoreData, getCacheStats } from "@/lib/storeDataCache";
import { DebugPanel } from "@/components/debug/DebugPanel";
// Test scenarios modal - shown when debug panel is open
import { ScenariosModal } from "@/qa/components/ScenariosModal";
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
  [key: string]: any;
}

export default function DebugChat() {
  const navigate = useNavigate();

  // Store selector state (replaces URL param)
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [store, setStore] = useState<Store | null>(null);
  const [currentSuggestions, setCurrentSuggestions] = useState<string[]>([]);
  const [currentTaskStep, setCurrentTaskStep] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showScenariosModal, setShowScenariosModal] = useState(false);
  const [testRunner] = useState(() => new TestRunner());
  const isMobile = useIsMobile();
  const [showDebugSheet, setShowDebugSheet] = useState(false);
  const [reasoningEnabled, setReasoningEnabled] = useState(false);

  // Models that support OpenRouter's reasoning parameter
  const MODELS_WITH_REASONING = [
    'anthropic/claude-3.5-sonnet',
    'anthropic/claude-3.7-sonnet',
    'anthropic/claude-sonnet-4',
    'x-ai/grok-2',
    'x-ai/grok-4.1-fast',
    'deepseek/deepseek-r1',
    'deepseek/deepseek-chat-v3.1',
    'google/gemini-2.0-flash-thinking-exp',
  ];

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
  const useNativeToolCalling = useDebugStore((state) => state.useNativeToolCalling);
  const setUseNativeToolCalling = useDebugStore((state) => state.setUseNativeToolCalling);

  // Fetch user's stores (same as Dashboard)
  const { data: userStores, isLoading: storesLoading } = useQuery({
    queryKey: ['user-stores-debug'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('stores')
        .select('id, name, sheet_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[DebugChat] Error fetching stores:', error);
        return [];
      }

      return data || [];
    }
  });

  // Auto-select first store when stores load
  useEffect(() => {
    if (userStores && userStores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(userStores[0].id);
    }
  }, [userStores, selectedStoreId]);

  // Load store details when selection changes
  useEffect(() => {
    if (selectedStoreId) {
      loadStore(selectedStoreId);
    }
  }, [selectedStoreId]);

  // Precache store data when store loads (warm cache BEFORE user sends message)
  useEffect(() => {
    const warmCache = async () => {
      if (!store?.id || !store?.sheet_id) return;

      console.log('[DebugChat] Warming cache for store:', store.id);

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const cached = await precacheStoreData(store.id, supabaseUrl, anonKey);

        console.log('[DebugChat] Cache warmed:', {
          services: cached.services.length,
          products: cached.products.length,
          hours: cached.hours.length,
        });

        if (import.meta.env.DEV) {
          const stats = getCacheStats(store.id);
          console.log('[DebugChat] Cache stats:', stats);
        }
      } catch (error) {
        console.warn('[DebugChat] Cache warming failed (non-critical):', error);
      }
    };

    warmCache();
  }, [store?.id, store?.sheet_id]);

  // Auto-progress through task steps when typing
  useEffect(() => {
    if (!isTyping) {
      setCurrentTaskStep(0);
      return;
    }

    const timer1 = setTimeout(() => {
      setCurrentTaskStep(1);
    }, 3000);

    const timer2 = setTimeout(() => {
      setCurrentTaskStep(2);
    }, 6000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isTyping]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const loadStore = async (storeId: string) => {
    try {
      console.log('[DebugChat] Loading store:', storeId);

      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('id', storeId)
        .single();

      console.log('[DebugChat] Query result:', { data, error });

      if (error || !data) {
        console.error('[DebugChat] Failed to load store:', error);
        return;
      }

      const storeData = data as unknown as Store;
      setStore(storeData);

      // Initial bot message
      const initialMessage: Message = {
        id: '1',
        type: 'bot',
        content: `Hey there! 👋 I'm your assistant at ${storeData?.name ?? 'this store'}. How can I help you today?`,
        timestamp: new Date()
      };
      setMessages([initialMessage]);
      setCurrentSuggestions(initialQuickActions);
    } catch (error) {
      console.error('[DebugChat] Error loading store:', error);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || !selectedStoreId) return;

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

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

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
    setCurrentSuggestions([]);

    try {
      const conversationHistory = updatedMessages
        .filter(msg => msg.type === 'user' || msg.type === 'bot')
        .map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        }));

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'X-Request-ID': requestId,
      };

      updateRequest(requestId, { status: 'classifying' });

      const cachedData = selectedStoreId ? getCachedStoreData(selectedStoreId) : null;
      if (cachedData) {
        console.log('[DebugChat] Passing cached data to chat-completion:', {
          services: cachedData.services.length,
          products: cachedData.products.length,
          hours: cachedData.hours.length,
        });
      }

      // Use correct endpoint based on mode toggle
      const endpoint = useNativeToolCalling ? 'chat-completion-native' : 'chat-completion';
      console.log('[DebugChat] Using endpoint:', endpoint, '(native:', useNativeToolCalling, ')');

      // Only pass reasoningEnabled if Native mode + supported model
      const shouldEnableReasoning = useNativeToolCalling &&
        MODELS_WITH_REASONING.includes(selectedModel) &&
        reasoningEnabled;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            messages: conversationHistory,
            storeId: selectedStoreId,
            model: selectedModel,
            cachedData,
            reasoningEnabled: shouldEnableReasoning,
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Chat request failed');
      }

      const data = await response.json();
      console.log('Chat response data:', data);

      // Debug: Log reasoning info specifically
      if (shouldEnableReasoning) {
        console.log('[DebugChat] Reasoning debug:', {
          enabled: data.debug?.reasoningEnabled,
          hasReasoning: !!data.debug?.reasoning,
          reasoningLength: data.debug?.reasoning?.length || 0,
          reasoningDuration: data.debug?.reasoningDuration,
          hasReasoningDetails: !!data.debug?.reasoningDetails,
        });
      }

      const aiResponse = data.text || "I apologize, I couldn't generate a response.";
      const suggestions = data.suggestions || [];

      setCurrentSuggestions(suggestions);

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
          reasoningDuration: data.debug?.reasoningDuration,
        },
        intent: data.debug?.intent,
        functionCalls: data.debug?.functionCalls,
        tokens: data.debug?.tokens,
        cost: data.debug?.cost,
        steps: data.debug?.steps,
        reasoning: data.debug?.reasoning,
        reasoningDetails: data.debug?.reasoningDetails,
        status: 'complete',
      });

      // Persist debug request to DB for historical QA / analysis
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id ?? null;

        await supabase.from('debug_requests').insert([{
          id: requestId,
          user_id: userId,
          store_id: selectedStoreId,
          model: selectedModel,
          // architecture is recorded inside `metadata` (avoid top-level column to match DB schema)
          user_message: content.trim(),
          response_text: aiResponse,
          status: 'complete',
          timings: {
            requestStart,
            totalDuration,
            intentDuration: data.debug?.intentDuration,
            functionDuration: data.debug?.functionDuration,
            responseDuration: data.debug?.responseDuration,
            reasoningDuration: data.debug?.reasoningDuration,
          },
          function_calls: data.debug?.functionCalls || null,
          steps: data.debug?.steps || null,
          tokens: data.debug?.tokens || null,
          cost: data.debug?.cost || null,
          reasoning: data.debug?.reasoning || null,
          reasoning_details: data.debug?.reasoningDetails || null,
          metadata: {
            endpoint: endpoint,
            nativeMode: useNativeToolCalling,
            architecture: useNativeToolCalling ? 'native' : 'classifier',
          }
        }]);
      } catch (dbErr) {
        console.error('[DebugChat] Failed to persist debug request:', dbErr);
      }

      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: aiResponse,
        suggestions,
        richContent: (() => {
          try {
            const fr = data.functionResult;
            if (!fr) return undefined;
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

              const preferencesFormComp = fr.components.find((c: any) => c.type === 'PreferencesForm');
              if (preferencesFormComp && preferencesFormComp.props) {
                return { type: 'PreferencesForm', data: preferencesFormComp.props };
              }

              const recommendationListComp = fr.components.find((c: any) => c.type === 'RecommendationList');
              if (recommendationListComp && recommendationListComp.props) {
                return { type: 'RecommendationList', data: recommendationListComp.props };
              }

              const bookingCalendarComp = fr.components.find((c: any) => c.type === 'BookingCalendar' || c.type === 'booking_calendar');
              if (bookingCalendarComp && bookingCalendarComp.props) {
                return { type: 'BookingCalendar', data: bookingCalendarComp.props };
              }
            }
            if (fr.data && Array.isArray(fr.data.hours) && fr.data.hours.length) {
              return { type: 'hours', data: fr.data.hours };
            }
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
      setCurrentSuggestions([]);

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

  const handleChatAction = async (action: string, _data?: Record<string, any>) => {
    sendMessage(action);
  };

  const handleRegenerate = (messageId: string) => {
    const botIndex = messages.findIndex(m => m.id === messageId);
    if (botIndex <= 0) return;

    let userMessageContent = '';
    for (let i = botIndex - 1; i >= 0; i--) {
      if (messages[i].type === 'user') {
        userMessageContent = messages[i].content;
        break;
      }
    }

    if (userMessageContent) {
      setMessages(prev => prev.filter(m => m.id !== messageId));
      sendMessage(userMessageContent);
    }
  };

  const getConversationHistory = () => {
    return messages.map(m => ({
      role: m.type === 'user' ? 'user' : 'assistant',
      content: m.content
    }));
  };

  // Handles running a selected test scenario using the TestRunner
  const handleRunScenario = async (scenario: TestScenario) => {
    if (!selectedStoreId) return;

    setMessages([{
      id: 'scenario-start',
      type: 'bot',
      content: `🧪 Starting test: **${scenario.name}**\n\n${scenario.description || ''}`,
      timestamp: new Date()
    }]);

    setCurrentSuggestions([]);

    try {
      const execution = await testRunner.runScenario(
        scenario,
        selectedStoreId,
        selectedModel,
        selectedModel,
        (result: TestStepResult) => {
          setMessages(prev => [...prev, {
            id: `test-bot-${result.stepIndex}`,
            type: 'bot',
            content: result.botResponse,
            timestamp: new Date(),
            richContent: result.richContent
          }]);
        },
        (userMessage: string, stepIndex: number) => {
          setMessages(prev => [...prev, {
            id: `test-user-${stepIndex}`,
            type: 'user',
            content: userMessage,
            timestamp: new Date()
          }]);
        },
        {
          onTurnStart: (turn: number, userMessage: string) => {
            setMessages(prev => [...prev, {
              id: `test-user-turn-${turn}`,
              type: 'user',
              content: `🤖 ${userMessage}`,
              timestamp: new Date()
            }]);
          },
          onTurnComplete: (result: GoalBasedTurnResult) => {
            setMessages(prev => [...prev, {
              id: `test-bot-turn-${result.turnIndex}`,
              type: 'bot',
              content: result.botResponse,
              timestamp: new Date()
            }]);
          }
        }
      );

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

  // Top content for embedded debug panel - store selector and mode toggle with dark styling
  const debugPanelTopContent = (
    <div className="space-y-3">
      {/* Simple Header - matches Main Store style */}
      <h1 className="text-lg font-bold text-gray-100">Debug Chat</h1>

      {/* Store Selector */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">Test Store</label>
        <select
          value={selectedStoreId || ''}
          onChange={(e) => setSelectedStoreId(e.target.value)}
          className="w-full bg-gray-900 text-gray-100 p-2 rounded border border-gray-700 focus:border-gray-600 focus:outline-none text-sm"
        >
          <option value="" disabled>Select a store...</option>
          {userStores?.map((store: any) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
      </div>

      {/* Architecture Mode */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">Architecture</label>
        <select
          value={useNativeToolCalling ? 'native' : 'classifier'}
          onChange={(e) => setUseNativeToolCalling(e.target.value === 'native')}
          className="w-full bg-gray-900 text-gray-100 p-2 rounded border border-gray-700 focus:border-gray-600 focus:outline-none text-sm"
        >
          <option value="classifier">Classifier + Responder</option>
          <option value="native">Native Tool Calling</option>
        </select>
      </div>

      {/* Reasoning Toggle - only show for Native mode + supported models */}
      {useNativeToolCalling && MODELS_WITH_REASONING.includes(selectedModel) && (
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={reasoningEnabled}
              onChange={(e) => setReasoningEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
            />
            <span className="text-xs text-gray-300">Extended Reasoning</span>
          </label>
        </div>
      )}
    </div>
  );

  if (storesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!userStores || userStores.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30">
        <div className="text-center">
          <Bug className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-4">No stores found</h1>
          <p className="text-muted-foreground mb-4">Create a store first to use Debug Chat.</p>
          <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Main Content: Responsive Layout */}
      <div className="flex-1 flex w-full min-h-0">
        {/* Debug Panel Side Panel - LEFT side, Hidden on mobile, visible on md+ */}
        <div className="hidden md:block w-96 flex-shrink-0 overflow-hidden">
          <DebugPanel embedded={true} topContent={debugPanelTopContent} showAdvancedOptions={true} />
        </div>

        {/* Chat Section - RIGHT side, Full width on mobile */}
        <div className="flex-1 flex flex-col bg-muted min-w-0 min-h-0 overflow-hidden">
          {/* Chat header (bot profile) */}
          <div className="flex items-center gap-3 px-4 md:px-6 py-3 bg-card border-b border-border/10 shadow-[var(--shadow-card-sm)]">
            <Avatar className="w-10 h-10" variant="bot">
              <AvatarFallback className="avatar-fallback">
                <Bot className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <H2 className="text-base">
                {store?.name || 'Store'} Assistant
                <span className="ml-2 text-xs font-normal text-orange-600 bg-orange-100 px-2 py-0.5 rounded">
                  {useNativeToolCalling ? 'Native' : 'Classifier'}
                </span>
              </H2>
              <Lead className="truncate">Debug mode — test your chatbot here</Lead>
            </div>
            {/* Mobile: Debug panel toggle button */}
            {isMobile && (
              <Button
                variant="outline"
                size="icon"
                className="flex-shrink-0"
                onClick={() => setShowDebugSheet(true)}
              >
                <Settings2 className="w-4 h-4" />
                <span className="sr-only">Debug Settings</span>
              </Button>
            )}
          </div>

          <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                storeLogo={store?.name?.substring(0, 2).toUpperCase() || 'DB'}
                storeId={selectedStoreId!}
                conversationHistory={getConversationHistory()}
                onActionClick={handleChatAction}
                onRegenerate={handleRegenerate}
              />
            ))}

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

          <div className="p-4 md:p-6 bg-card border-t border-border/10 shadow-[var(--shadow-card-sm)]">
            {/* Suggestions area - shows follow-up prompts AND test scenarios */}
            {(currentSuggestions.length > 0 || true) && !isTyping && (
              <div className="mb-3">
                <Suggestions>
                  {/* Show test scenarios pill */}
                  <Suggestion
                    suggestion="🧪 Scenarios"
                    onClick={() => setShowScenariosModal(true)}
                  />
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
                disabled={!selectedStoreId}
                placeholder={selectedStoreId ? "Type your message..." : "Select a store first..."}
                className="flex-1 rounded-full bg-muted border border-input focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
              <Button
                onClick={() => sendMessage(inputValue)}
                size="sm"
                className="rounded-full w-11 h-11 p-0"
                disabled={!inputValue.trim() || !selectedStoreId}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Debug Panel Sheet */}
      <Sheet open={showDebugSheet} onOpenChange={setShowDebugSheet}>
        <SheetContent side="left" className="w-full sm:max-w-md p-0 overflow-hidden bg-gray-950">
          <SheetHeader className="sr-only">
            <SheetTitle>Debug Settings</SheetTitle>
          </SheetHeader>
          <DebugPanel embedded={true} topContent={debugPanelTopContent} showAdvancedOptions={true} />
        </SheetContent>
      </Sheet>

      {/* Test scenarios modal - for QA testing */}
      <ScenariosModal
        open={showScenariosModal}
        onOpenChange={setShowScenariosModal}
        onSelectScenario={handleRunScenario}
      />
    </div>
  );
}
