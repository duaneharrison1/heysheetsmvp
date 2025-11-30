import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface StatItem {
  value: string;
  label: string;
  index: string;
}

interface ImpactSectionProps {
  badge?: string;
  title: string;
  highlightedTitle?: string;
  subtitle: string;
  description: string;
  stats: StatItem[];
  imageSrc?: string;
  imageAlt?: string;
  trustedBy?: string[];
}

export function ImpactSection({
  badge = "Our Impact",
  title = "Transforming ideas into lasting experiences,",
  highlightedTitle = "through thoughtful design and reliable technology.",
  subtitle = "Built for growth, not just launch.",
  description = "We craft digital products that scale with your business. From concept to production, our team focuses on performance, precision, and design systems that stand the test of time.",
  stats = [
    { value: "120+", label: "Projects launched worldwide", index: "01" },
    { value: "98%", label: "Client retention rate", index: "02" },
  ],
  imageSrc = "https://images.unsplash.com/photo-1531973576160-7125cd663d86?w=600&auto=format&fit=crop&q=80",
  imageAlt = "Team collaboration",
  trustedBy = [],
}: ImpactSectionProps) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-border">
      {/* Header */}
      <div className="mb-12">
        <Badge variant="outline" className="mb-6">
          {badge}
        </Badge>
        <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2 max-w-4xl">
          {title}
        </h2>
        {highlightedTitle && (
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-muted-foreground max-w-4xl">
            {highlightedTitle}
          </h2>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
        {/* Image with floating button */}
        <div className="relative">
          <div className="aspect-[4/5] rounded-lg overflow-hidden bg-muted">
            <img
              src={imageSrc}
              alt={imageAlt}
              className="w-full h-full object-cover grayscale"
            />
          </div>
        </div>

        {/* Right Side Content */}
        <div className="space-y-8">
          {/* Subtitle and Description */}
          <div>
            <h3 className="text-lg font-semibold mb-2">{subtitle}</h3>
            <p className="text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>

          {/* Stats Grid: two numeric cards above, two descriptive cards below */}
          <div className="grid grid-cols-2 gap-4">
            {/* Top numeric cards (use first two stats) */}
            {stats.slice(0, 2).map((stat, idx) => (
              <Card key={`num-${idx}`} className="relative bg-card">
                <CardContent className="p-6">
                  <span className="absolute top-4 right-4 text-xs text-muted-foreground">
                    {stat.index}
                  </span>
                  <div className="text-4xl sm:text-5xl font-bold mb-2">
                    {stat.value}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Bottom-left descriptive box (expanded explanation) */}
            <Card className="relative bg-card">
              <CardContent className="p-6">
                <div className="text-sm font-semibold mb-4">{stats[0]?.label}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  From startups to global brands, we've helped over 120 clients build meaningful digital experiences that deliver measurable impact.
                </p>
              </CardContent>
            </Card>

            {/* Bottom-right descriptive box (label only — logos removed) */}
            <Card className="relative bg-card">
              <CardContent className="p-6">
                <div className="text-sm font-semibold mb-4">{stats[1]?.label}</div>
                <div className="text-sm text-muted-foreground">
                  {/* Logos removed per request */}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ImpactSection;
