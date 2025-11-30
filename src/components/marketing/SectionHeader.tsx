import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  badge?: string;
  title: string;
  subtitle?: string;
  description?: string;
  align?: 'left' | 'center';
  className?: string;
}

export function SectionHeader({
  badge,
  title,
  subtitle,
  description,
  align = 'left',
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn(
      "mb-12",
      align === 'center' && "text-center",
      className
    )}>
      {badge && (
        <Badge variant="outline" className="mb-6">
          {badge}
        </Badge>
      )}
      <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
        {title}
        {subtitle && (
          <>
            <br className="hidden sm:block" />
            <span className="text-muted-foreground"> {subtitle}</span>
          </>
        )}
      </h2>
      {description && (
        <p className={cn(
          "text-lg text-muted-foreground",
          align === 'center' ? "max-w-2xl mx-auto" : "max-w-2xl"
        )}>
          {description}
        </p>
      )}
    </div>
  );
}

export default SectionHeader;
