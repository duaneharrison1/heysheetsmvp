/**
 * Modal for selecting and running QA test scenarios
 * Opens when user clicks "🧪 Scenarios" pill in debug mode
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, FileText } from 'lucide-react';

// Import all scenario JSON files from the qa/scenarios folder
const scenarioModules = import.meta.glob('@/qa/scenarios/*.json', { eager: true });

interface ScenarioStep {
  id: string;
  userMessage: string;
  expected?: {
    intent?: string | string[];
    minConfidence?: number;
    functions?: string[];
  };
}

interface Scenario {
  id: string;
  name: string;
  description?: string;
  category?: string;
  steps?: ScenarioStep[];
  // Goal can be a string OR an object with description/successSignals
  goal?: string | { description?: string; successSignals?: string[] };
  turns?: unknown[];
}

interface ScenariosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectScenario: (scenario: Scenario) => void;
}

export function ScenariosModal({ open, onOpenChange, onSelectScenario }: ScenariosModalProps) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);

  useEffect(() => {
    // Load all scenarios from the glob import
    const loadedScenarios: Scenario[] = [];
    for (const path in scenarioModules) {
      const module = scenarioModules[path] as { default?: Scenario } | Scenario;
      const scenario = 'default' in module ? module.default : module;
      if (scenario && typeof scenario === 'object' && 'id' in scenario) {
        loadedScenarios.push(scenario as Scenario);
      }
    }
    // Sort by name for consistent ordering
    loadedScenarios.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
    setScenarios(loadedScenarios);
  }, []);

  const handleSelect = (scenario: Scenario) => {
    onSelectScenario(scenario);
    onOpenChange(false);
  };

  // Determine scenario type for display
  const getScenarioType = (scenario: Scenario): string => {
    if (scenario.goal) return 'goal-based';
    if (scenario.steps) return 'scripted';
    return 'unknown';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Test Scenarios
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-2">
            {scenarios.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No scenarios found in src/qa/scenarios/
              </p>
            ) : (
              scenarios.map((scenario) => (
                <div
                  key={scenario.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => handleSelect(scenario)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {scenario.name || scenario.id}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {getScenarioType(scenario)}
                      </Badge>
                      {scenario.steps && (
                        <Badge variant="outline" className="text-xs">
                          {scenario.steps.length} steps
                        </Badge>
                      )}
                    </div>
                    {scenario.description && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {scenario.description}
                      </p>
                    )}
                    {scenario.goal && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {/* Handle goal as string or object with description */}
                        Goal: {typeof scenario.goal === 'string'
                          ? scenario.goal
                          : scenario.goal.description || 'No description'}
                      </p>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" className="ml-2 shrink-0">
                    <Play className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
