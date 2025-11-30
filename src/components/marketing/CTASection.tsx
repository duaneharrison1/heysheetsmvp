import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Smartphone, ArrowRight } from 'lucide-react';

interface CTASectionProps {
  leftCard?: {
    badge?: string;
    title: string;
    subtitle?: string;
    buttons?: {
      primary: { label: string; icon?: 'smartphone'; onClick: () => void };
      secondary: { label: string; icon?: 'smartphone'; onClick: () => void };
    };
    image?: string;
  };
  rightCard?: {
    title: string;
    description: string;
    placeholder?: string;
    buttonText?: string;
  };
}

export function CTASection({
  leftCard = {
    badge: "Download Now",
    title: "Download the notes app of tomorrow today.",
    buttons: {
      primary: { label: "Download for iOS", icon: 'smartphone', onClick: () => {} },
      secondary: { label: "Download for Android", icon: 'smartphone', onClick: () => {} },
    },
    image: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400&auto=format&fit=crop&q=80",
  },
  rightCard = {
    title: "Subscribe to our weekly newsletter",
    description: "Lorem ipsum dolor sit amet consectetur adipiscing elidolor mattis sit phasellus.",
    placeholder: "Enter your email",
    buttonText: "Subscribe",
  },
}: CTASectionProps) {
  const [email, setEmail] = useState('');

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-border">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Card - App Download */}
        <Card className="bg-primary text-primary-foreground overflow-hidden relative p-8 lg:p-10 lg:col-span-2">
          <div className="relative z-10">
            <h3 className="text-3xl sm:text-4xl font-bold mb-6 max-w-md">
              {leftCard.title}
            </h3>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                size="lg"
                onClick={leftCard.buttons?.primary.onClick}
                className="gap-2"
              >
                <Smartphone className="w-4 h-4" />
                {leftCard.buttons?.primary.label}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={leftCard.buttons?.secondary.onClick}
                className="gap-2 bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10"
              >
                <Smartphone className="w-4 h-4" />
                {leftCard.buttons?.secondary.label}
              </Button>
            </div>
          </div>
          
          {/* Phone Mockup */}
          <div className="absolute -right-12 top-1/2 -translate-y-1/2 w-64 h-[400px] hidden md:block">
            <div className="relative w-full h-full">
              <div className="absolute inset-0 bg-transparent rounded-3xl shadow-2xl border-8 border-foreground/10">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-foreground/10 rounded-b-2xl" />
                {/* Screen Content */}
                <div className="absolute inset-4 top-8 bg-transparent rounded-2xl flex items-center justify-center">
                  <div className="w-16 h-16">
                    <div className="grid grid-cols-3 gap-1 p-2">
                      {[...Array(9)].map((_, i) => (
                        <div key={i} className="aspect-square bg-foreground/20 rounded-sm" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Right Card - Newsletter */}
        <Card className="p-8 lg:p-10 flex flex-col justify-center">
          <h3 className="text-3xl font-bold mb-3">
            {rightCard.title}
          </h3>
          <p className="text-muted-foreground mb-6">
            {rightCard.description}
          </p>
          <div className="space-y-3">
            <Input
              type="email"
              placeholder={rightCard.placeholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12"
            />
            <Button 
              size="lg" 
              className="w-full gap-2"
              onClick={() => {
                // Handle subscription
                console.log('Subscribe:', email);
              }}
            >
              {rightCard.buttonText}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}

export default CTASection;
