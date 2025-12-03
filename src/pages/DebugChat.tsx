import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useDebugStore } from '@/stores/useDebugStore';
import { DebugPanel } from '@/components/debug/DebugPanel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bug, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { generateCorrelationId } from '@/lib/debug/correlation-id';

type ChatMode = 'classifier' | 'native';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface LastRequestInfo {
  mode: ChatMode;
  endpoint: string;
  model: string;
  reasoningEnabled: boolean;
  duration: number;
  backendEndpoint?: string;
  backendReasoning?: boolean;
  endpointMatches: boolean;
  reasoningMatches: boolean;
  tokensIn?: number;
  tokensOut?: number;
  cost?: number;
  functionCalled?: string;
  toolCalls?: string[];
}

export default function DebugChat() {
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [mode, setMode] = useState<ChatMode>('classifier');
  const [reasoningEnabled, setReasoningEnabled] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastRequestInfo, setLastRequestInfo] = useState<LastRequestInfo | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { selectedModel, addRequest, updateRequest } = useDebugStore();

  // Fetch user's stores
  useEffect(() => {
    const fetchStores = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_stores')
        .select('store_id, stores(id, name)')
        .eq('user_id', user.id);

      if (error) {
        console.error('[DebugChat] Error fetching stores:', error);
        return;
      }

      const storeList = data?.map((s: any) => ({
        id: s.store_id,
        name: s.stores?.name || s.store_id
      })) || [];

      setStores(storeList);

      // Set first store as default
      if (storeList.length > 0 && !selectedStoreId) {
        setSelectedStoreId(storeList[0].id);
      }
    };

    fetchStores();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const endpoint = mode === 'native' ? 'chat-completion-native' : 'chat-completion';

  const sendMessage = async () => {
    if (!input.trim() || !selectedStoreId || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    const requestId = generateCorrelationId();
    const startTime = Date.now();

    // Log what we're sending
    console.log('[DebugChat] ==========================================');
    console.log('[DebugChat] Sending request:');
    console.log('[DebugChat]   Mode:', mode);
    console.log('[DebugChat]   Endpoint:', endpoint);
    console.log('[DebugChat]   Full URL:', `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`);
    console.log('[DebugChat]   Model:', selectedModel);
    console.log('[DebugChat]   Reasoning:', reasoningEnabled);
    console.log('[DebugChat]   Store:', selectedStoreId);
    console.log('[DebugChat] ==========================================');

    // Track in debug store
    addRequest({
      id: requestId,
      timestamp: startTime,
      userMessage: input,
      model: selectedModel,
      timings: { requestStart: startTime },
      status: 'pending',
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
          },
          body: JSON.stringify({
            messages: newMessages.map(m => ({ role: m.role, content: m.content })),
            storeId: selectedStoreId,
            model: selectedModel,
            reasoningEnabled,
          })
        }
      );

      const data = await response.json();
      const endTime = Date.now();

      // Log what backend returned
      console.log('[DebugChat] ==========================================');
      console.log('[DebugChat] Response received:');
      console.log('[DebugChat]   Duration:', endTime - startTime, 'ms');
      console.log('[DebugChat]   Backend endpoint:', data.debug?.endpoint);
      console.log('[DebugChat]   Backend reasoning:', data.debug?.reasoningEnabled);
      console.log('[DebugChat]   Function called:', data.functionCalled || data.debug?.functionCalled);
      console.log('[DebugChat]   Full debug:', data.debug);
      console.log('[DebugChat] ==========================================');

      // Store debug info including what backend confirms
      const backendEndpoint = data.debug?.endpoint || data.debug?.mode || data.debug?.steps?.[0]?.function;
      const endpointMatches = backendEndpoint?.includes(mode === 'native' ? 'native' : 'classifier') ||
                             backendEndpoint === endpoint;
      const reasoningMatches = data.debug?.reasoningEnabled === reasoningEnabled;

      setLastRequestInfo({
        mode,
        endpoint,
        model: selectedModel,
        reasoningEnabled,
        duration: endTime - startTime,
        backendEndpoint,
        backendReasoning: data.debug?.reasoningEnabled,
        endpointMatches: endpointMatches !== false,
        reasoningMatches: reasoningMatches !== false,
        tokensIn: data.debug?.tokens?.total?.input,
        tokensOut: data.debug?.tokens?.total?.output,
        cost: data.debug?.cost?.total,
        functionCalled: data.functionCalled || data.debug?.functionCalled,
        toolCalls: data.debug?.functionCalls?.map((fc: any) => fc.name) ||
                   data.debug?.steps?.[0]?.result?.functionsExecuted,
      });

      // Update debug store
      updateRequest(requestId, {
        status: 'complete',
        timings: {
          requestStart: startTime,
          totalDuration: endTime - startTime,
        },
        tokens: data.debug?.tokens,
        cost: data.debug?.cost,
        steps: data.debug?.steps,
        functionCalls: data.debug?.functionCalls,
      });

      const responseText = data.text || data.message || 'No response';
      setMessages([...newMessages, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText
      }]);

    } catch (error) {
      console.error('[DebugChat] Error sending message:', error);
      updateRequest(requestId, {
        status: 'error',
        error: {
          stage: 'network',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      setMessages([...newMessages, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header with Store Selector */}
        <div className="border-b p-4 flex items-center gap-4">
          <Bug className="h-6 w-6 text-orange-500" />
          <h1 className="text-xl font-semibold">Debug Chat</h1>

          <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select store..." />
            </SelectTrigger>
            <SelectContent>
              {stores.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <p>Select a store and send a message to test the chat.</p>
              <p className="text-sm mt-2">Use the sidebar to switch between modes and configure settings.</p>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-3 rounded-lg max-w-[80%] ${
                msg.role === 'user'
                  ? 'bg-blue-100 ml-auto'
                  : 'bg-gray-100'
              }`}
            >
              {msg.content}
            </div>
          ))}
          {isLoading && (
            <div className="bg-gray-100 p-3 rounded-lg animate-pulse flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Type a message..."
              disabled={!selectedStoreId || isLoading}
            />
            <Button
              onClick={sendMessage}
              disabled={!selectedStoreId || isLoading || !input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Debug Sidebar */}
      <div className="w-80 border-l p-4 overflow-y-auto bg-gray-50">
        {/* Mode Selector */}
        <div className="mb-6">
          <Label className="text-sm font-medium mb-2 block">Architecture Mode</Label>
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as ChatMode)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="classifier" id="classifier" />
              <Label htmlFor="classifier" className="text-sm">Classifier + Responder</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="native" id="native" />
              <Label htmlFor="native" className="text-sm">Native Tool Calling</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Reasoning Toggle */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Enable Reasoning</Label>
            <Switch
              checked={reasoningEnabled}
              onCheckedChange={setReasoningEnabled}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Adds reasoning tokens (slower, may improve quality)
          </p>
        </div>

        {/* Current Settings Display */}
        <div className="mb-6 p-3 bg-white rounded-lg border text-sm">
          <div className="font-medium mb-2">Current Settings</div>
          <div><strong>Mode:</strong> {mode}</div>
          <div><strong>Endpoint:</strong> {endpoint}</div>
          <div><strong>Model:</strong> {selectedModel}</div>
          <div><strong>Reasoning:</strong> {reasoningEnabled ? 'ON' : 'OFF'}</div>
        </div>

        {/* Last Request Info - VERIFICATION */}
        {lastRequestInfo && (
          <div className="mb-6 p-3 bg-white rounded-lg border text-sm space-y-2">
            <div className="font-medium mb-2">Last Request Verification</div>

            {/* Duration */}
            <div><strong>Duration:</strong> {lastRequestInfo.duration}ms</div>

            {/* Endpoint Verification */}
            <div className="border-t pt-2 mt-2">
              <div><strong>Endpoint Sent:</strong> {lastRequestInfo.endpoint}</div>
              <div className={lastRequestInfo.endpointMatches ? 'text-green-600' : 'text-red-600'}>
                <strong>Backend Confirms:</strong> {lastRequestInfo.backendEndpoint || 'N/A'}
                {lastRequestInfo.endpointMatches ? (
                  <CheckCircle className="inline h-4 w-4 ml-1" />
                ) : (
                  <XCircle className="inline h-4 w-4 ml-1" />
                )}
              </div>
            </div>

            {/* Reasoning Verification */}
            <div className="border-t pt-2 mt-2">
              <div><strong>Reasoning Sent:</strong> {lastRequestInfo.reasoningEnabled ? 'ON' : 'OFF'}</div>
              <div className={lastRequestInfo.reasoningMatches ? 'text-green-600' : 'text-red-600'}>
                <strong>Backend Confirms:</strong> {lastRequestInfo.backendReasoning !== undefined ? (lastRequestInfo.backendReasoning ? 'ON' : 'OFF') : 'N/A'}
                {lastRequestInfo.reasoningMatches ? (
                  <CheckCircle className="inline h-4 w-4 ml-1" />
                ) : (
                  <XCircle className="inline h-4 w-4 ml-1" />
                )}
              </div>
            </div>

            {/* Function/Tool Info */}
            {(lastRequestInfo.functionCalled || lastRequestInfo.toolCalls?.length) && (
              <div className="border-t pt-2 mt-2">
                {lastRequestInfo.functionCalled && (
                  <div><strong>Function:</strong> {lastRequestInfo.functionCalled}</div>
                )}
                {lastRequestInfo.toolCalls && lastRequestInfo.toolCalls.length > 0 && (
                  <div><strong>Tool Calls:</strong> {lastRequestInfo.toolCalls.join(', ')}</div>
                )}
              </div>
            )}

            {/* Token Info */}
            {(lastRequestInfo.tokensIn || lastRequestInfo.tokensOut) && (
              <div className="border-t pt-2 mt-2">
                <div><strong>Tokens:</strong> {lastRequestInfo.tokensIn || 0} in / {lastRequestInfo.tokensOut || 0} out</div>
                {lastRequestInfo.cost !== undefined && (
                  <div><strong>Cost:</strong> ${lastRequestInfo.cost.toFixed(4)}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Clear Chat Button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setMessages([]);
            setLastRequestInfo(null);
          }}
        >
          Clear Chat
        </Button>
      </div>
    </div>
  );
}
