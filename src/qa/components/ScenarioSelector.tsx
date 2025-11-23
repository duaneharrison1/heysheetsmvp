import { useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDebugStore } from '@/stores/useDebugStore'
import type { TestScenario } from '../lib/types'

// Import scenarios eagerly to avoid build issues
const scenarioModules = import.meta.glob('../scenarios/*.json', { eager: true })

export function ScenarioSelector() {
  const { selectedScenario, setSelectedScenario } = useDebugStore()
  const [scenarios, setScenarios] = useState<TestScenario[]>([])

  useEffect(() => {
    // Load scenarios from imported modules
    const loadedScenarios: TestScenario[] = []

    for (const path in scenarioModules) {
      const module = scenarioModules[path] as any
      loadedScenarios.push(module.default || module)
    }

    setScenarios(loadedScenarios)
  }, [])

  return (
    <div className="mb-3">
      <Select value={selectedScenario || ''} onValueChange={setSelectedScenario}>
        <SelectTrigger>
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

      {selectedScenario && (
        <p className="text-xs text-muted-foreground mt-1">
          {scenarios.find(s => s.id === selectedScenario)?.description}
        </p>
      )}
    </div>
  )
}
