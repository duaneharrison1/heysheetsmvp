import { useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDebugStore } from '@/stores/useDebugStore'
import type { TestScenario } from '../lib/types'

export function ScenarioSelector() {
  const { selectedScenario, setSelectedScenario } = useDebugStore()
  const [scenarios, setScenarios] = useState<TestScenario[]>([])

  useEffect(() => {
    // Load scenarios from /src/qa/scenarios/
    async function loadScenarios() {
      try {
        // Import all scenario files
        const scenarioModules = import.meta.glob('../scenarios/*.json')
        const loadedScenarios: TestScenario[] = []

        for (const path in scenarioModules) {
          const module = await scenarioModules[path]() as any
          loadedScenarios.push(module.default || module)
        }

        setScenarios(loadedScenarios)
      } catch (error) {
        console.error('Failed to load scenarios:', error)
      }
    }

    loadScenarios()
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
