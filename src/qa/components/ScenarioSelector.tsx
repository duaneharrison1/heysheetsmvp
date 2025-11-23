import { useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useDebugStore } from '@/stores/useDebugStore'
import type { TestScenario } from '../lib/types'

// Import scenarios eagerly to avoid build issues
const scenarioModules = import.meta.glob('../scenarios/*.json', { eager: true })

export function ScenarioSelector() {
  const selectedScenario = useDebugStore((state) => state.selectedScenario)
  const setSelectedScenario = useDebugStore((state) => state.setSelectedScenario)
  const [scenarios, setScenarios] = useState<TestScenario[]>([])

  useEffect(() => {
    // Load scenarios from imported modules
    const loadedScenarios: TestScenario[] = []

    console.log('📦 Loading scenarios, scenarioModules:', scenarioModules)

    for (const path in scenarioModules) {
      const module = scenarioModules[path] as any
      const scenario = module.default || module
      console.log('📄 Loaded scenario:', { path, scenario })
      loadedScenarios.push(scenario)
    }

    console.log('✅ All scenarios loaded:', loadedScenarios)
    setScenarios(loadedScenarios)
  }, [])

  const handleTestButtonClick = () => {
    console.log('🧪 Backup Test Button Clicked - selectedScenario:', selectedScenario)
    if (selectedScenario) {
      alert(`Scenario selected: ${selectedScenario}\nButton is working! Check main Send button.`)
    } else {
      alert('No scenario selected yet')
    }
  }

  const handleScenarioChange = (value: string) => {
    console.log('🔄 Scenario changed to:', value)
    setSelectedScenario(value)
    console.log('✅ Called setSelectedScenario with:', value)
  }

  // Log current state
  console.log('🎯 ScenarioSelector render - selectedScenario:', selectedScenario, 'scenarios count:', scenarios.length)

  return (
    <div className="mb-3">
      <div className="flex gap-2 mb-2">
        <Select value={selectedScenario || ''} onValueChange={handleScenarioChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select test scenario..." />
          </SelectTrigger>
          <SelectContent>
            {scenarios.map(scenario => (
              <SelectItem key={scenario.id} value={scenario.id}>
                {scenario.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={handleTestButtonClick}
          variant="outline"
          size="sm"
          disabled={!selectedScenario}
        >
          Test
        </Button>
      </div>

      {selectedScenario && (
        <p className="text-xs text-muted-foreground mt-1">
          {scenarios.find(s => s.id === selectedScenario)?.description}
        </p>
      )}
    </div>
  )
}
