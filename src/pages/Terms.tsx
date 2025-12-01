import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { H1 } from '@/components/ui/heading';

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-3 hover:opacity-80 transition"
              aria-label="HeySheets home"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-black">
                <img src="/shop.svg" alt="HeySheets" className="w-6 h-6" />
              </div>
              <span className="font-bold text-lg">HeySheets</span>
            </button>
          </div>
          <div className="flex items-center gap-4">
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition">
              FAQ
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition">
              Pricing
            </a>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/auth')}
            >
              Sign In
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-36">
        <div className="max-w-4xl mx-auto">
          <H1>Terms of Service</H1>
          <div className="prose mt-6">
            <p>These are the Terms of Service for HeySheets. Please replace this placeholder text with your full terms.</p>
            <p>By using HeySheets you agree to the terms described here.</p>
          </div>
        </div>
      </main>

      {/* Footer (fixed) */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/50 py-6 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <a href="/" className="w-8 h-8 rounded-full flex items-center justify-center bg-black inline-flex">
                  <img src="/shop.svg" alt="HeySheets" className="w-5 h-5" />
                </a>
                <a href="/" className="font-bold hover:opacity-90">HeySheets</a>
              </div>
              <p className="text-sm text-muted-foreground">
                Transform your Google Sheets into intelligent chatbots.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <button 
                    onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} 
                    className="hover:text-foreground transition"
                  >
                    Pricing
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })} 
                    className="hover:text-foreground transition"
                  >
                    FAQ
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Resources</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/help" className="hover:text-foreground transition">Help Center</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Account</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/auth" className="hover:text-foreground transition">Sign In</a></li>
                <li><a href="/auth" className="hover:text-foreground transition">Create Account</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-4 text-sm text-muted-foreground text-center">
            <p>&copy; 2025 HeySheets. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Terms;