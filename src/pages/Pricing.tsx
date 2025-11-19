import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { H1, H2 } from '@/components/ui/heading';
import { Check } from 'lucide-react';

const Pricing = () => {
  const navigate = useNavigate();

  const plans = [
    {
      name: 'Free',
      description: 'Perfect for getting started',
      price: '$0',
      features: [
        'Up to 1 chatbot',
        '100 conversations/month',
        'Basic analytics',
        'Email support',
        'Google Sheets integration',
      ],
      cta: 'Get Started',
      highlighted: false,
    },
    {
      name: 'Pro',
      description: 'For growing businesses',
      price: '$29',
      period: '/month',
      features: [
        'Up to 10 chatbots',
        'Unlimited conversations',
        'Advanced analytics',
        'Priority email support',
        'Google Sheets integration',
        'Custom branding',
        'API access',
        'Webhook integrations',
      ],
      cta: 'Start Free Trial',
      highlighted: true,
    },
    {
      name: 'Enterprise',
      description: 'For large-scale operations',
      price: 'Custom',
      features: [
        'Unlimited chatbots',
        'Unlimited conversations',
        'Custom analytics',
        '24/7 phone & email support',
        'Google Sheets integration',
        'Custom branding',
        'API access',
        'Webhook integrations',
        'Dedicated account manager',
        'SLA guarantee',
      ],
      cta: 'Contact Sales',
      highlighted: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-3 hover:opacity-80 transition"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-black">
              <img src="/shop.svg" alt="HeySheets" className="w-6 h-6" />
            </div>
            <span className="font-bold text-lg">HeySheets</span>
          </button>
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition">
              Home
            </a>
            <a href="/#faq" className="text-sm text-muted-foreground hover:text-foreground transition">
              FAQ
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

      {/* Header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-2xl mx-auto">
          <H1>Simple, Transparent Pricing</H1>
          <p className="text-muted-foreground mt-4">
            Choose the perfect plan for your needs. No hidden fees. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <Card 
              key={plan.name}
              className={`relative flex flex-col ${plan.highlighted ? 'border-primary md:scale-105' : ''}`}
            >
              {plan.highlighted && (
                <div className="absolute top-0 right-0 -mt-3 mr-4">
                  <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="mb-6">
                  <div className="text-4xl font-bold">
                    {plan.price}
                    {plan.period && <span className="text-lg text-muted-foreground">{plan.period}</span>}
                  </div>
                </div>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full"
                  variant={plan.highlighted ? 'default' : 'outline'}
                  onClick={() => navigate('/auth')}
                >
                  {plan.cta}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-border">
        <div className="text-center mb-12">
          <H2>Billing Questions</H2>
        </div>
        <div className="max-w-3xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What's included in the free plan?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                The free plan includes 1 chatbot, 100 conversations per month, basic analytics, email support, and full Google Sheets integration. It's perfect for trying out HeySheets.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Can I upgrade or downgrade anytime?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Yes! You can change your plan at any time. If you upgrade, you'll be charged the difference immediately. If you downgrade, the credit will be applied to your next billing cycle.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Do you offer annual discounts?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Yes, we offer 20% discount on annual plans. Plus, enterprise customers can arrange custom pricing. Contact our sales team for more details.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">What happens if I exceed my conversation limit?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                We'll notify you when you're approaching your limit. You can upgrade to a higher plan to continue using your chatbots. We never disable service mid-month.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Is there a free trial for paid plans?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Yes, we offer a 14-day free trial for Pro and Enterprise plans. No credit card required. You'll have full access to all features during the trial period.
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
            Start with our free plan. No credit card required.
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
      <footer className="border-t border-border bg-background/50 py-12 mt-16">
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
                <li><a href="/pricing" className="hover:text-foreground transition">Pricing</a></li>
                <li><a href="/#faq" className="hover:text-foreground transition">FAQ</a></li>
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

export default Pricing;
