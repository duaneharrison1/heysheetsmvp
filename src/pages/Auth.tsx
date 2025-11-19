import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import AuthButton from '@/components/AuthButton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Shield, Zap, Lock } from 'lucide-react';

const Auth = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/dashboard');
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-3 hover:opacity-80 transition"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-black">
              <img src="/shop.svg" alt="HeySheets" className="w-6 h-6" />
            </div>
            <span className="font-bold text-lg">HeySheets</span>
          </button>
        </div>
      </nav>

      <div className="w-full max-w-5xl mx-4 pt-20 pb-8 flex flex-col lg:flex-row gap-12 items-center">
        {/* Left Column - Benefits */}
        <div className="flex-1 space-y-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-4">
              Get started with HeySheets
            </h1>
            <p className="text-lg text-muted-foreground">
              Transform your Google Sheets into AI-powered chatbots in minutes.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 flex items-start">
                <Zap className="h-6 w-6 text-primary mt-1" />
              </div>
              <div>
                <h3 className="font-semibold">Quick Setup</h3>
                <p className="text-sm text-muted-foreground">Connect your Google Sheets and create a chatbot in minutes.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 flex items-start">
                <Lock className="h-6 w-6 text-primary mt-1" />
              </div>
              <div>
                <h3 className="font-semibold">Enterprise Security</h3>
                <p className="text-sm text-muted-foreground">Your data is encrypted and never shared with third parties.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 flex items-start">
                <Shield className="h-6 w-6 text-primary mt-1" />
              </div>
              <div>
                <h3 className="font-semibold">Free to Start</h3>
                <p className="text-sm text-muted-foreground">No credit card required. Try all features with our free plan.</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Join thousands of teams</span> already using HeySheets to engage customers and gain insights.
            </p>
          </div>
        </div>

        {/* Right Column - Auth Card */}
        <div className="w-full lg:w-96">
          <Card>
            <CardHeader className="items-center text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center bg-primary text-primary-foreground">
                <img src="/shop.svg" alt="HeySheets" className="w-8 h-8" />
              </div>
              <CardTitle className="text-2xl">Welcome</CardTitle>
              <CardDescription>Sign in to your account to continue</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <AuthButton />
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  Don't have an account? One will be created automatically when you sign in with Google.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground text-center w-full">
                ✓ No credit card required
              </p>
              <p className="text-xs text-muted-foreground text-center w-full">
                ✓ Free plan available
              </p>
              <p className="text-xs text-muted-foreground text-center w-full">
                ✓ Enterprise-grade security
              </p>
            </CardFooter>
          </Card>

          <div className="mt-6 text-center text-xs text-muted-foreground">
            By signing in, you agree to our{' '}
            <a href="#" className="text-primary hover:underline">
              Terms of Service
            </a>
            {' '}and{' '}
            <a href="#" className="text-primary hover:underline">
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
