import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Send, MapPin, Clock, Mail, Globe, Instagram, Music, ShoppingBag, Calendar, MessageCircle, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Sample store data with enhanced details
const sampleStores = {
  'salon-1': { 
    name: 'Bella Beauty Salon', 
    type: 'salon',
    logo: 'BB',
    hours: 'Mon-Sat 9am-8pm',
    address: '123 Beauty Street, Downtown, City 12345',
    email: 'hello@bellasalon.com',
    website: 'bellasalon.com',
    description: 'Your personal beauty assistant is here 24/7 to help you book appointments, explore our services, and get beauty advice.',
    services: [
      { icon: '💇‍♀️', text: 'Hair styling and treatments' },
      { icon: '💅', text: 'Nail care and manicures' },
      { icon: '✨', text: 'Skincare and facials' },
      { icon: '💄', text: 'Makeup consultations' }
    ]
  },
  'coach-1': { 
    name: 'FitLife Personal Training', 
    type: 'coach',
    logo: 'FL',
    hours: 'Mon-Fri 6am-9pm, Sat-Sun 8am-6pm',
    address: '456 Fitness Ave, Health District, City 12345',
    email: 'coach@fitlifept.com',
    website: 'fitlifept.com',
    description: 'Your fitness coach assistant is here to help you book sessions, track progress, and get personalized workout advice.',
    services: [
      { icon: '💪', text: 'Personal training sessions' },
      { icon: '🏃‍♂️', text: 'Fitness assessments' },
      { icon: '🥗', text: 'Nutrition coaching' },
      { icon: '📊', text: 'Progress tracking' }
    ]
  },
  'craft-1': { 
    name: 'Artisan Craft Studio', 
    type: 'craft',
    logo: 'AC',
    hours: 'Tue-Sun 10am-7pm',
    address: '789 Creative Lane, Arts Quarter, City 12345',
    email: 'info@artisancraft.com',
    website: 'artisancraft.com',
    description: 'Your creative assistant is here to help you explore workshops, find supplies, and discover your artistic potential.',
    services: [
      { icon: '🎨', text: 'Art workshops and classes' },
      { icon: '🛠️', text: 'Craft supplies and materials' },
      { icon: '👥', text: 'Group sessions and events' },
      { icon: '🎁', text: 'Custom project consultations' }
    ]
  },
  'education-1': { 
    name: 'Little Scholars Academy', 
    type: 'education',
    logo: 'LS',
    hours: 'Mon-Fri 7am-6pm',
    address: '321 Learning Street, Education District, City 12345',
    email: 'admissions@littlescholars.edu',
    website: 'littlescholars.edu',
    description: 'Your education assistant is here to help with enrollment, answer questions about our programs, and support your child\'s learning journey.',
    services: [
      { icon: '📚', text: 'Academic programs and curriculum' },
      { icon: '🎭', text: 'Extracurricular activities' },
      { icon: '👨‍🏫', text: 'Teacher consultations' },
      { icon: '📅', text: 'School events and schedules' }
    ]
  },
  'salon-2': { 
    name: 'Glow Skincare Clinic', 
    type: 'salon',
    logo: 'GS',
    hours: 'Mon-Sat 10am-7pm',
    address: '654 Glow Avenue, Beauty District, City 12345',
    email: 'book@glowskincare.com',
    website: 'glowskincare.com',
    description: 'Your skincare specialist assistant is here to help you achieve your best skin with personalized treatments and expert advice.',
    services: [
      { icon: '✨', text: 'Advanced skincare treatments' },
      { icon: '💉', text: 'Medical aesthetics' },
      { icon: '🧴', text: 'Product recommendations' },
      { icon: '📋', text: 'Skin consultations' }
    ]
  },
  'coach-2': { 
    name: 'Mindful Life Coaching', 
    type: 'coach',
    logo: 'ML',
    hours: 'Mon-Thu 9am-8pm, Fri 9am-5pm',
    address: '987 Wellness Way, Mindful District, City 12345',
    email: 'connect@mindfullife.com',
    website: 'mindfullife.com',
    description: 'Your life coach assistant is here to support your personal growth journey with guidance, resources, and session scheduling.',
    services: [
      { icon: '🧠', text: 'Life coaching sessions' },
      { icon: '🎯', text: 'Goal setting and tracking' },
      { icon: '🧘‍♀️', text: 'Mindfulness training' },
      { icon: '📈', text: 'Personal development plans' }
    ]
  },
};

interface Message {
  id: string;
  type: 'bot' | 'user';
  content: string;
  timestamp: Date;
}

export default function StorePage() {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showMobileModal, setShowMobileModal] = useState(false);

  const store = storeId ? sampleStores[storeId as keyof typeof sampleStores] : null;

  useEffect(() => {
    if (store) {
      // Initial bot message
      const initialMessage: Message = {
        id: '1',
        type: 'bot',
        content: `Hey there! 👋 I'm your ${store.type} assistant at ${store.name}. ${store.description} What can I help you with today?`,
        timestamp: new Date()
      };
      setMessages([initialMessage]);
    }
  }, [store]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Get AI response
    setTimeout(async () => {
      try {
        const aiResponse = await getBotResponse(content, store!);
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
    }, 1000);
  };

  const getBotResponse = async (userInput: string, storeData: any): Promise<string> => {
    try {
      // Prepare messages for the AI API
      const apiMessages = messages
        .filter(msg => msg.type === 'user' || msg.type === 'bot')
        .map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        }));

      // Add the current user message
      apiMessages.push({
        role: 'user',
        content: userInput
      });

      const { data, error } = await supabase.functions.invoke('chat-completion', {
        body: {
          messages: apiMessages,
          storeContext: storeData,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to get AI response');
      }

      return data?.response;
    } catch (error) {
      console.error('Error getting AI response:', error);
      // Fallback to simple responses
      const input = userInput.toLowerCase();
      
      if (input.includes('book') || input.includes('appointment') || input.includes('schedule')) {
        return `I'd be happy to help you book an appointment! Our ${storeData.type === 'education' ? 'enrollment' : 'booking'} system is available ${storeData.hours}. What service interests you most?`;
      }
      
      if (input.includes('hours') || input.includes('time') || input.includes('open')) {
        return `We're open ${storeData.hours}. Feel free to visit us or book online anytime!`;
      }
      
      if (input.includes('location') || input.includes('address') || input.includes('where')) {
        return `You can find us at ${storeData.address}. We're easily accessible and look forward to seeing you!`;
      }
      
      return `I'm here to help with all your ${storeData.type} needs. Feel free to ask about our services, booking, pricing, or anything else you'd like to know about ${storeData.name}!`;
    }
  };

  const quickActions = store ? [
    'Show me services',
    'Book appointment', 
    'Pricing info',
    'Store location'
  ] : [];

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Store not found</h1>
          <Button onClick={() => navigate('/')}>Return to Stores</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Business Profile Section - Desktop */}
      <div className="hidden md:flex w-[30%] flex-col bg-card border-r border-border p-6">
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
          <div className="w-15 h-15 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-white font-bold text-xl">
            {store.logo}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-foreground mb-2">{store.name}</h1>
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
              <Clock className="w-4 h-4" />
              <span>{store.hours}</span>
            </div>
            <div className="flex items-start gap-2 text-muted-foreground text-sm">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span className="leading-relaxed">{store.address}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-4 mb-8">
          <Button variant="ghost" size="sm" className="p-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="sm" className="p-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="sm" className="p-2">
            <Instagram className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">Your Chat Assistant</h3>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            {store.description}
          </p>
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">How I can help you</h3>
          <div className="space-y-3">
            {store.services.map((service, index) => (
              <div key={index} className="flex items-center gap-3 text-sm">
                <span className="text-lg">{service.icon}</span>
                <span className="text-muted-foreground">{service.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-6 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Powered by</span>
            <a href="#" className="text-primary font-medium hover:underline">HeySheets</a>
          </div>
        </div>

        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="mt-4 gap-2 justify-start"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Stores
        </Button>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden w-full bg-card border-b border-border p-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="p-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-white font-bold">
            {store.logo}
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{store.name}</h1>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="w-3 h-3" />
              <span>{store.hours}</span>
            </div>
          </div>
          <Dialog open={showMobileModal} onOpenChange={setShowMobileModal}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-primary">
                See details
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Chat Assistant Details</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">About {store.name}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{store.hours}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{store.address}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Your Chat Assistant</h3>
                  <p className="text-sm text-muted-foreground">{store.description}</p>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">How I can help you</h3>
                  <div className="space-y-2">
                    {store.services.map((service, index) => (
                      <div key={index} className="flex items-center gap-3 text-sm">
                        <span>{service.icon}</span>
                        <span className="text-muted-foreground">{service.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Contact us</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      <span>{store.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      <span>{store.website}</span>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Chat Section */}
      <div className="w-full md:w-[70%] flex flex-col bg-background md:border-l border-border">
        <div className="p-6 border-b border-border bg-card">
          <h2 className="text-xl font-semibold text-foreground mb-1">Your Chat Assistant</h2>
          <p className="text-muted-foreground text-sm">I'm here to help you with services, bookings, and questions</p>
        </div>

        <div className="flex-1 p-6 overflow-y-auto bg-muted/30 space-y-4 max-h-[calc(100vh-200px)]">
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.type === 'bot' && (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {store.logo}
                </div>
              )}
              <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                message.type === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-card text-card-foreground shadow-sm border border-border'
              }`}>
                <div className="text-sm leading-relaxed">{message.content}</div>
                <div className="text-xs opacity-70 mt-2">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {quickActions.length > 0 && messages.length === 1 && (
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => sendMessage(action)}
                  className="text-xs h-8"
                >
                  {action}
                </Button>
              ))}
            </div>
          )}

          {isTyping && (
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-white font-bold text-sm">
                {store.logo}
              </div>
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
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}