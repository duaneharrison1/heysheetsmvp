import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Sparkles, 
  Shield, 
  Clock,
  type LucideIcon 
} from 'lucide-react';

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  company: string;
}

interface TrustIndicator {
  icon: LucideIcon;
  value: string;
  label: string;
}

interface SocialProofSectionProps {
  badge?: string;
  title?: string;
  subtitle?: string;
  testimonials?: Testimonial[];
  trustIndicators?: TrustIndicator[];
}

const defaultTestimonials: Testimonial[] = [
  {
    quote: "HeySheets transformed how we handle customer inquiries. What used to take hours now happens automatically with incredible accuracy.",
    author: "Sarah Chen",
    role: "Operations Director",
    company: "TechFlow Inc.",
  },
  {
    quote: "The setup was incredibly simple. We had our first chatbot running within 30 minutes, and it's been handling 80% of our support requests ever since.",
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
];

const defaultTrustIndicators: TrustIndicator[] = [
  { icon: Users, value: "10,000+", label: "Active Users" },
  { icon: Sparkles, value: "1M+", label: "Conversations Handled" },
  { icon: Shield, value: "99.9%", label: "Uptime SLA" },
  { icon: Clock, value: "< 2s", label: "Avg Response Time" },
];

export function SocialProofSection({
  badge = "Trusted by Teams",
  title = "Join Thousands of Growing Businesses",
  subtitle = "See why companies of all sizes trust HeySheets to power their customer conversations.",
  testimonials = defaultTestimonials,
  trustIndicators = defaultTrustIndicators,
}: SocialProofSectionProps) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-border">
      {/* Header */}
      <div className="mb-12">
        <Badge variant="outline" className="mb-6">
          {badge}
        </Badge>
        <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          {title}
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl">
          {subtitle}
        </p>
      </div>

      {/* Trust Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {trustIndicators.map((indicator, idx) => {
          const Icon = indicator.icon;
          return (
            <Card key={idx}>
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold mb-1">
                  {indicator.value}
                </div>
                <div className="text-sm text-muted-foreground">
                  {indicator.label}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Testimonials Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {testimonials.map((testimonial, idx) => (
          <Card key={idx} className="h-full">
            <CardContent className="p-6 flex flex-col h-full">
              {/* Quote Mark */}
              <div className="text-4xl text-muted-foreground/30 font-serif mb-2">
                "
              </div>
              
              {/* Quote */}
              <blockquote className="text-foreground flex-1 mb-6">
                {testimonial.quote}
              </blockquote>
              
              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-border">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-sm font-medium">
                    {testimonial.author.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <div className="font-medium text-sm">{testimonial.author}</div>
                  <div className="text-xs text-muted-foreground">
                    {testimonial.role}, {testimonial.company}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export default SocialProofSection;
