import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';

interface HeroSectionProps {
  badge?: string;
  title: string;
  subtitle?: string;
  description: string;
  primaryButton: {
    label: string;
    onClick: () => void;
  };
  secondaryButton?: {
    label: string;
    onClick: () => void;
  };
  trustedLogos?: string[];
  imageSrc?: string;
  imageAlt?: string;
}

export function HeroSection({
  badge,
  title,
  subtitle,
  description,
  primaryButton,
  secondaryButton,
  trustedLogos = [],
  imageSrc,
  imageAlt = "Hero image",
}: HeroSectionProps) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
      <div className={`${imageSrc ? 'grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-stretch' : ''}`}>
        <div className={`${imageSrc ? 'flex flex-col justify-center' : 'max-w-4xl'}`}>
          {/* Badge */}
          {badge && (
            <Badge variant="outline" className="mb-6 w-fit">
              {badge}
            </Badge>
          )}

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            {title}
            {subtitle && (
              <>
                <br />
                <span className="text-muted-foreground">{subtitle}</span>
              </>
            )}
          </h1>

          {/* Description */}
          <p className={`text-lg sm:text-xl text-muted-foreground mb-8 ${imageSrc ? '' : 'max-w-2xl'}`}>
            {description}
          </p>

          {/* Buttons */}
          <div className="flex flex-wrap gap-3 mb-12">
            <Button
              size="lg"
              onClick={primaryButton.onClick}
              className="gap-2"
            >
              {primaryButton.label}
              <ArrowRight className="w-4 h-4" />
            </Button>
            {secondaryButton && (
              <Button
                size="lg"
                variant="outline"
                onClick={secondaryButton.onClick}
              >
                {secondaryButton.label}
              </Button>
            )}
          </div>

          {/* Trusted By Logos */}
          {trustedLogos.length > 0 && (
            <div className="flex items-center justify-between w-full flex-wrap gap-4 opacity-60">
              {trustedLogos.map((logo, idx) => (
                <div key={idx} className="text-sm font-medium text-muted-foreground">
                  {logo}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hero Image */}
        {imageSrc && (
          <div className="relative hidden lg:block h-full">
            <img
              src={imageSrc}
              alt={imageAlt}
              className="w-full h-full object-cover rounded-2xl"
            />
          </div>
        )}
      </div>
    </section>
  );
}

export default HeroSection;
