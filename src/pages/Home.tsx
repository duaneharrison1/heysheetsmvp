import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  MessageSquare, 
  Zap, 
  BarChart3, 
  Loader2, 
  Table2, 
  Bot, 
  Share2, 
  Lock 
} from 'lucide-react';
import { 
  HeroSection, 
  FeaturesShowcase, 
  WorkflowSection, 
  SocialProofSection,
  FAQSection,
  CTASection,
  SectionHeader,
  ImpactSection 
} from '@/components/marketing';

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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
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

      {/* Hero Section */}
      <HeroSection
        badge="AI-Powered Chatbots for Everyone"
        title="Transform Your Sheets"
        subtitle="Into Intelligent Chatbots."
        description="Connect your Google Sheets data and create AI-powered chatbots that answer questions, provide insights, and engage customers — no coding required."
        primaryButton={{
          label: "Get Started Free",
          onClick: () => navigate('/auth'),
        }}
        secondaryButton={{
          label: "View Pricing",
          onClick: () => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }),
        }}
        trustedLogos={["TechFlow", "Startup Labs", "GrowthCo", "DataPro", "ScaleUp"]}
        imageSrc="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80"
        imageAlt="Data analytics and chatbot visualization"
      />

      {/* Features Grid Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-border">
        <SectionHeader
          badge="Why HeySheets"
          title="Everything you need"
          subtitle="to automate conversations."
          description="Our platform combines powerful features with elegant design to help you create intelligent chatbots effortlessly."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: MessageSquare, title: "Easy Setup", description: "Connect your Google Sheets in seconds and start building chatbots immediately." },
            { icon: Zap, title: "AI-Powered", description: "Powered by advanced AI models that understand context and provide accurate responses." },
            { icon: BarChart3, title: "Analytics", description: "Track conversations, user engagement, and get actionable insights from your data." },
            { icon: CheckCircle2, title: "No Code", description: "No technical skills required. Perfect for teams of any size." },
          ].map((feature, idx) => (
            <Card key={idx}>
              <CardContent className="p-6">
                <feature.icon className="w-8 h-8 mb-4 text-primary" />
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Impact Section */}
      <ImpactSection
        badge="Our Impact"
        title="Transforming data into conversations,"
        highlightedTitle="through intelligent automation and AI."
        subtitle="Built for scale, not just demos."
        description="We help businesses transform their spreadsheet data into powerful conversational interfaces. From small startups to enterprise teams, our platform delivers reliable, accurate AI-powered responses."
        stats={[
          { value: "500+", label: "Businesses automated", index: "01" },
          { value: "99%", label: "Response accuracy", index: "02" },
        ]}
        imageSrc="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80"
        imageAlt="Data analytics dashboard"
        trustedBy={["Mercury", "Descript", "Arc"]}
      />

      {/* Features Showcase */}
      <FeaturesShowcase
        badge="Features"
        title="Discover What Makes Us Different"
        subtitle="Our platform combines powerful features with elegant design to help you accomplish more and achieve your goals."
        features={[
          {
            icon: Table2,
            title: "Google Sheets Integration",
            description: "Connect your existing spreadsheets in seconds. We automatically detect your data structure and create intelligent responses.",
          },
          {
            icon: Bot,
            title: "AI-Powered Responses",
            description: "Advanced language models understand context and provide accurate, natural responses based on your data.",
          },
          {
            icon: Share2,
            title: "Easy Embedding",
            description: "Embed your chatbot on any website with a simple script, or share standalone chat pages with unique URLs.",
          },
          {
            icon: Lock,
            title: "Enterprise Security",
            description: "Your data is encrypted in transit and at rest. We never share your information with third parties.",
          },
        ]}
      />

      {/* Workflow Section */}
      <WorkflowSection
        badge="How It Works"
        title="Get started in minutes, not days"
        subtitle="Deploy a fully optimized chatbot system and upgrade your customer experience."
        steps={[
          {
            number: 1,
            title: "Connect your spreadsheet",
            description: "Link your Google Sheets data source in just a few clicks with our secure integration.",
          },
          {
            number: 2,
            title: "Configure your chatbot",
            description: "Customize responses, set up conversation flows, and train your AI on your data.",
          },
          {
            number: 3,
            title: "Deploy anywhere",
            description: "Embed on your website or share a direct link to your intelligent chatbot.",
          },
          {
            number: 4,
            title: "Analyze & improve",
            description: "Monitor conversations, gather insights, and continuously optimize performance.",
          },
        ]}
      />

      {/* Social Proof Section */}
      <SocialProofSection
        badge="Trusted by Teams"
        title="Join thousands of growing businesses"
        subtitle="See why companies of all sizes trust HeySheets to power their customer conversations."
        testimonials={[
          {
            quote: "HeySheets transformed how we handle customer inquiries. What used to take hours now happens automatically with incredible accuracy.",
            author: "Sarah Chen",
            role: "Operations Director",
            company: "TechFlow Inc.",
          },
          {
            quote: "The setup was incredibly simple. We had our first chatbot running within 30 minutes, and it's been handling 80% of our support requests.",
            author: "Marcus Johnson",
            role: "Founder",
            company: "Startup Labs",
          },
          {
            quote: "Finally, a solution that lets non-technical team members create powerful AI tools. Our sales team loves it.",
            author: "Emily Rodriguez",
            role: "Head of Sales",
            company: "GrowthCo",
          },
        ]}
        trustIndicators={[
          { icon: MessageSquare, value: "10,000+", label: "Active Users" },
          { icon: Zap, value: "1M+", label: "Conversations" },
          { icon: CheckCircle2, value: "99.9%", label: "Uptime" },
          { icon: BarChart3, value: "< 2s", label: "Response Time" },
        ]}
      />

      {/* Pricing Section */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-border">
        <SectionHeader
          badge="Pricing"
          title="Simple, transparent pricing"
          description="Choose the perfect plan for your needs. No hidden fees."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Free Plan */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold mb-1">Free</h3>
              <p className="text-sm text-muted-foreground mb-4">Perfect for getting started</p>
              <div className="text-4xl font-bold mb-6">$0</div>
              <ul className="space-y-3 mb-6">
                {["Up to 1 chatbot", "100 conversations/month", "Basic analytics", "Email support"].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full" variant="outline" onClick={() => navigate('/auth')}>
                Get Started
              </Button>
            </CardContent>
          </Card>

          {/* Pro Plan */}
          <Card className="border-primary relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge>Popular</Badge>
            </div>
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold mb-1">Pro</h3>
              <p className="text-sm text-muted-foreground mb-4">For growing businesses</p>
              <div className="text-4xl font-bold mb-6">
                $29<span className="text-lg text-muted-foreground font-normal">/month</span>
              </div>
              <ul className="space-y-3 mb-6">
                {["Up to 10 chatbots", "Unlimited conversations", "Advanced analytics", "Priority support", "Custom branding"].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full" onClick={() => navigate('/auth')}>
                Start Free Trial
              </Button>
            </CardContent>
          </Card>

          {/* Enterprise Plan */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold mb-1">Enterprise</h3>
              <p className="text-sm text-muted-foreground mb-4">For large-scale operations</p>
              <div className="text-4xl font-bold mb-6">Custom</div>
              <ul className="space-y-3 mb-6">
                {["Unlimited chatbots", "Unlimited conversations", "24/7 phone support", "Dedicated account manager", "SLA guarantee"].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full" variant="outline" onClick={() => window.location.href = 'mailto:sales@heysheets.com'}>
                Contact Sales
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ Section */}
      <div id="faq">
        <FAQSection
          title="Frequently asked questions."
          categories={[
            {
              category: "General",
              items: [
                {
                  question: "Do I need to know how to code?",
                  answer: "No, HeySheets is designed for everyone. Our intuitive interface lets you create powerful chatbots without any coding knowledge.",
                },
                {
                  question: "Is my data secure?",
                  answer: "Yes, we use enterprise-grade security. Your data is encrypted in transit and at rest. We never share your data with third parties.",
                },
                {
                  question: "Can I try it for free?",
                  answer: "Absolutely! Our free plan includes everything you need to get started. No credit card required.",
                },
                {
                  question: "Can I embed the chatbot on my website?",
                  answer: "Yes! You can embed your chatbot on any website with a simple script. Plus, we provide standalone chat pages with unique URLs.",
                },
              ],
            },
            {
              category: "Billing",
              items: [
                {
                  question: "How do I change my billing information?",
                  answer: "You can update your billing information in your account settings under the Billing section. Changes take effect immediately for future charges.",
                },
                {
                  question: "How do I cancel my subscription?",
                  answer: "To cancel your subscription, go to your account settings, select the Billing tab, and click on 'Cancel Subscription'. You'll retain access until the end of your billing period.",
                },
              ],
            },
          ]}
        />
      </div>

      {/* CTA Section */}
      <CTASection
        leftCard={{
          title: "Ready to transform your customer experience?",
          buttons: {
            primary: { 
              label: "Get Started Free", 
              onClick: () => navigate('/auth') 
            },
            secondary: { 
              label: "View Demo", 
              onClick: () => navigate('/auth') 
            },
          },
        }}
        rightCard={{
          title: "Subscribe to our newsletter",
          description: "Get the latest updates on AI chatbots, product news, and tips to grow your business.",
          placeholder: "Enter your email",
          buttonText: "Subscribe",
        }}
      />

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
          <div className="border-t border-border pt-8 text-sm text-muted-foreground text-center">
            <p>&copy; 2025 HeySheets. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
