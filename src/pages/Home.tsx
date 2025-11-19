import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { H1, H2, Lead } from '@/components/ui/heading';
import { CheckCircle2, MessageSquare, Zap, BarChart3, Loader2 } from 'lucide-react';

const Home = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/dashboard', { replace: true });
      }
      setLoading(false);
    });
  }, [navigate]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-black">
              <img src="/shop.svg" alt="HeySheets" className="w-6 h-6" />
            </div>
            <span className="font-bold text-lg">HeySheets</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition">
              FAQ
            </a>
            <a href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition">
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

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6">
            Transform Your Google Sheets into Intelligent Chatbots
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Connect your Google Sheets data and create AI-powered chatbots that answer questions, provide insights, and engage customers.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button 
              size="lg"
              onClick={() => navigate('/auth')}
            >
              Get Started Free
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
            >
              View Plans
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-border">
        <div className="text-center mb-12">
          <H2>Why Choose HeySheets?</H2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <MessageSquare className="w-8 h-8 mb-4 text-primary" />
              <CardTitle className="text-lg">Easy Setup</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Connect your Google Sheets in seconds and start building chatbots immediately.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Zap className="w-8 h-8 mb-4 text-primary" />
              <CardTitle className="text-lg">AI-Powered</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Powered by advanced AI models that understand context and provide accurate responses.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <BarChart3 className="w-8 h-8 mb-4 text-primary" />
              <CardTitle className="text-lg">Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Track conversations, user engagement, and get actionable insights from your data.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CheckCircle2 className="w-8 h-8 mb-4 text-primary" />
              <CardTitle className="text-lg">No Code</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                No technical skills required. Perfect for teams of any size.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-border">
        <div className="text-center mb-12">
          <H2>Simple, Transparent Pricing</H2>
          <p className="text-muted-foreground mt-4">
            Choose the perfect plan for your needs. No hidden fees.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Free</CardTitle>
              <CardDescription>Perfect for getting started</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="mb-6">
                <div className="text-4xl font-bold">$0</div>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">Up to 1 chatbot</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">100 conversations/month</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">Basic analytics</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">Email support</span>
                </li>
              </ul>
            </CardContent>
            <CardContent>
              <Button 
                className="w-full"
                variant="outline"
                onClick={() => navigate('/auth')}
              >
                Get Started
              </Button>
            </CardContent>
          </Card>

          <Card className="border-primary">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Pro</CardTitle>
                  <CardDescription>For growing businesses</CardDescription>
                </div>
                <span className="bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded">Popular</span>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="mb-6">
                <div className="text-4xl font-bold">
                  $29<span className="text-lg text-muted-foreground">/month</span>
                </div>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">Up to 10 chatbots</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">Unlimited conversations</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">Advanced analytics</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">Priority support</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">Custom branding</span>
                </li>
              </ul>
            </CardContent>
            <CardContent>
              <Button 
                className="w-full"
                onClick={() => navigate('/auth')}
              >
                Start Free Trial
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enterprise</CardTitle>
              <CardDescription>For large-scale operations</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="mb-6">
                <div className="text-4xl font-bold">Custom</div>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">Unlimited chatbots</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">Unlimited conversations</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">24/7 phone support</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">Dedicated account manager</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">SLA guarantee</span>
                </li>
              </ul>
            </CardContent>
            <CardContent>
              <Button 
                className="w-full"
                variant="outline"
                onClick={() => window.location.href = 'mailto:sales@heysheets.com'}
              >
                Contact Sales
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-border">
        <div className="text-center mb-12">
          <H2>Frequently Asked Questions</H2>
        </div>
        <div className="max-w-3xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Do I need to know how to code?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                No, HeySheets is designed for everyone. Our intuitive interface lets you create powerful chatbots without any coding knowledge.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Is my data secure?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Yes, we use enterprise-grade security. Your data is encrypted in transit and at rest. We never share your data with third parties.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Can I try it for free?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Absolutely! Our free plan includes everything you need to get started. No credit card required.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">How do I get support?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                We offer email support for all plans, with priority support available on premium tiers. Check our <a href="/help" className="text-primary hover:underline">Help Center</a> for documentation.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Can I embed the chatbot on my website?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Yes! You can embed your chatbot on any website with a simple script. Plus, we provide standalone chat pages with unique URLs.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-border">
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <H2>Ready to get started?</H2>
          <p className="text-muted-foreground mb-6">
            Join thousands of companies transforming their data into intelligent conversations.
          </p>
          <Button 
            size="lg"
            onClick={() => navigate('/auth')}
          >
            Get Started Free
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background/50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-black">
                  <img src="/shop.svg" alt="HeySheets" className="w-5 h-5" />
                </div>
                <span className="font-bold">HeySheets</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Transform your Google Sheets into intelligent chatbots.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-foreground transition">Pricing</button></li>
                <li><button onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-foreground transition">FAQ</button></li>
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
          <div className="border-t border-border pt-8 text-sm text-muted-foreground text-center">
            <p>&copy; 2025 HeySheets. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
