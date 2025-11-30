import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  Cloud, 
  Star, 
  Settings, 
  MessageSquare,
  type LucideIcon 
} from 'lucide-react';

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface FeaturesShowcaseProps {
  badge?: string;
  title?: string;
  subtitle?: string;
  features?: Feature[];
}

const defaultFeatures: Feature[] = [
  {
    icon: Cloud,
    title: "Cloud Storage",
    description: "Nam vitae molestie arcu. Quisque eu libero orci. Aliquam imperdiet magna nec massa consectetur, id interdum ante congue.",
  },
  {
    icon: Star,
    title: "Premium Support",
    description: "Nam vitae molestie arcu. Quisque eu libero orci. Aliquam imperdiet magna nec massa consectetur, id interdum ante congue.",
  },
  {
    icon: Settings,
    title: "Fast Performance",
    description: "Nam vitae molestie arcu. Quisque eu libero orci. Aliquam imperdiet magna nec massa consectetur, id interdum ante congue.",
  },
  {
    icon: MessageSquare,
    title: "Messaging Platform",
    description: "Nam vitae molestie arcu. Quisque eu libero orci. Aliquam imperdiet magna nec massa consectetur, id interdum ante congue.",
  },
];

export function FeaturesShowcase({
  badge = "Features",
  title = "Discover What Makes Us Different",
  subtitle = "Our platform combines powerful features with elegant design to help you accomplish more and achieve your goals.",
  features = defaultFeatures,
}: FeaturesShowcaseProps) {
  const [activeIndex, setActiveIndex] = useState(2);

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

      {/* Features Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Feature List */}
        <div className="space-y-3">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            const isActive = idx === activeIndex;
            
            return (
              <Card 
                key={idx}
                className={cn(
                  "cursor-pointer transition-all duration-200",
                  isActive 
                    ? "border-border shadow-md" 
                    : "border-transparent hover:border-border/50"
                )}
                onClick={() => setActiveIndex(idx)}
              >
                <CardContent className="p-4 flex items-start gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                    isActive ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold mb-1">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {feature.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Right Column - Feature Display Card */}
        <Card className="h-full min-h-[400px] flex flex-col">
          <CardContent className="flex-1 p-8 flex flex-col items-center justify-center">
            {/* Feature Icon Display */}
            <div className="w-48 h-48 mb-8 flex items-center justify-center">
              <div className="relative w-full h-full">
                {/* Striped decorative shape */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-32 h-32 relative">
                    {/* Simplified geometric pattern */}
                    <div className="absolute inset-0 grid grid-cols-4 gap-1">
                      {[...Array(16)].map((_, i) => (
                        <div 
                          key={i} 
                          className={cn(
                            "rounded-sm",
                            i % 2 === 0 ? "bg-primary" : "bg-transparent"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Feature Info */}
            {features[activeIndex] && (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
                  {(() => {
                    const ActiveIcon = features[activeIndex].icon;
                    return <ActiveIcon className="w-6 h-6" />;
                  })()}
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  {features[activeIndex].title}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {features[activeIndex].description}
                </p>
              </div>
            )}
          </CardContent>

          {/* Pagination Dots */}
          <div className="flex items-center justify-center gap-2 pb-6">
            {features.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-200",
                  idx === activeIndex 
                    ? "w-6 bg-primary" 
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
                aria-label={`Go to feature ${idx + 1}`}
              />
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

export default FeaturesShowcase;
