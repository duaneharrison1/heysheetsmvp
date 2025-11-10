import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ArrowLeft, Send, Clock, Loader2, Bot, AlertCircle } from "lucide-react";

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

export default function StorePage() {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<any>(null);
  const [hasSheet, setHasSheet] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('id', storeId)
        .single();

      if (error || !data) {
        navigate('/');
        return;
      }

      setStore(data);
      setHasSheet(!!data.sheet_id);

      // Initial bot message
      const initialMessage: Message = {
        id: '1',
        type: 'bot',
        content: `Hey there! 👋 I'm your assistant at ${data.name}. How can I help you today?`,
        timestamp: new Date()
      };
      setMessages([initialMessage]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || !storeId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
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

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-completion`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            messages: conversationHistory,
            storeId,
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

      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: aiResponse,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botResponse]);
    } catch (error) {
      console.error('Error getting bot response:', error);
      const fallbackResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, fallbackResponse]);
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
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            {isAuthenticated && (
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            <Avatar className="w-12 h-12">
              <AvatarFallback className="bg-blue-600 text-white font-bold">
                {store.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-lg font-semibold">{store.name}</h1>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Clock className="w-3 h-3" />
                <span>AI Assistant</span>
              </div>
            </div>
            {isAuthenticated && (
              <Link to={`/settings/${storeId}`}>
                <Button variant="outline" size="sm">Settings</Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Warning if no sheet */}
      {!hasSheet && isAuthenticated && (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="max-w-4xl mx-auto px-4 py-3">
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

      {/* Chat Section */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
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
              <Avatar className="w-9 h-9">
                <AvatarFallback className="bg-blue-600 text-white">
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

        <div className="p-6 border-t border-border bg-card">
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
              className="flex-1 rounded-full"
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
  );
}
