import { Badge } from '@/components/ui/badge';

interface WorkflowStep {
  number: number;
  title: string;
  description: string;
}

interface WorkflowSectionProps {
  badge?: string;
  title?: string;
  subtitle?: string;
  steps?: WorkflowStep[];
}

const defaultSteps: WorkflowStep[] = [
  {
    number: 1,
    title: "Set up your data collection",
    description: "Configure your input sources and streamline data management.",
  },
  {
    number: 2,
    title: "Generate custom reports",
    description: "Easily create and share detailed analytics reports across teams.",
  },
  {
    number: 3,
    title: "Automate your processes",
    description: "Set up automated workflows for handling and processing data effortlessly.",
  },
  {
    number: 4,
    title: "Share insights with stakeholders",
    description: "Provide transparent reporting with your custom-built dashboard.",
  },
];

export function WorkflowSection({
  badge = "Start your journey",
  title = "Build your custom workflow in no time",
  subtitle = "Deploy a fully optimized system and upgrade your current setup.",
  steps = defaultSteps,
}: WorkflowSectionProps) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-border">
      {/* Header */}
      <div className="mb-12">
        <Badge variant="outline" className="mb-6">
          {badge}
        </Badge>
        <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 max-w-2xl">
          {title}
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl">
          {subtitle}
        </p>
      </div>

      {/* Steps */}
      <div className="relative">
        {/* Connection Line */}
        <div className="absolute top-5 left-5 right-5 h-px bg-border hidden md:block" />
        
        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-6">
          {steps.map((step, idx) => (
            <div key={idx} className="relative">
              {/* Step Number */}
              <div className="flex items-center gap-4 mb-4">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold z-10
                  bg-background border border-border text-foreground
                `}>
                  {step.number}
                </div>
                {/* Mobile connection line */}
                {idx < steps.length - 1 && (
                  <div className="flex-1 h-px bg-border md:hidden" />
                )}
              </div>
              
              {/* Step Content */}
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default WorkflowSection;
