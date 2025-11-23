import { Button } from '@/components/ui/button'
import { Play, Pause, Square } from 'lucide-react'
import { useDebugStore } from '@/stores/useDebugStore'
import { useState } from 'react'
import { TestRunner } from '../lib/test-runner'
import { toast } from 'sonner'
import type { TestScenario } from '../lib/types'

// Import scenarios eagerly to avoid build issues
const scenarioModules = import.meta.glob('../scenarios/*.json', { eager: true })

interface TestControlsProps {
  storeId: string
  onTestStart?: () => void
  onTestComplete?: () => void
}

export function TestControls({ storeId, onTestStart, onTestComplete }: TestControlsProps) {
  const {
    selectedScenario,
    currentTest,
    selectedModel,
    evaluatorModel
  } = useDebugStore()

  const [runner] = useState(() => new TestRunner())

  const handleRun = async () => {
    if (!selectedScenario) {
      toast.error('Please select a test scenario')
      return
    }

    try {
      // Load scenario
      let scenario: TestScenario | null = null

      for (const path in scenarioModules) {
        const module = scenarioModules[path] as any
        const s = module.default || module
        if (s.id === selectedScenario) {
          scenario = s
          break
        }
      }

      if (!scenario) {
        toast.error('Scenario not found')
        return
      }

      onTestStart?.()

      // Run test
      const execution = await runner.runScenario(
        scenario,
        storeId,
        selectedModel,
        evaluatorModel || selectedModel,  // Default to chat model
        (result) => {
          // Progress callback
          console.log('Step completed:', result)
        }
      )

      toast.success(`Test complete: ${execution.scenarioName}`)
      onTestComplete?.()

    } catch (error) {
      console.error('Test failed:', error)
      toast.error('Test execution failed')
    }
  }

  const handlePause = () => {
    runner.pause()
    toast.info('Test paused')
  }

  const handleResume = () => {
    runner.resume()
    toast.info('Test resumed')
  }

  const handleStop = () => {
    runner.stop()
    toast.warning('Test stopped')
  }

  const isRunning = currentTest?.status === 'running'
  const isPaused = currentTest?.status === 'paused'

  if (!currentTest) {
    // Show Run button
    return (
      <Button
        onClick={handleRun}
        disabled={!selectedScenario}
        className="w-full"
      >
        <Play className="w-4 h-4 mr-2" />
        Run Test
      </Button>
    )
  }

  // Show Pause/Resume and Stop buttons
  return (
    <div className="flex gap-2">
      {isPaused ? (
        <Button onClick={handleResume} variant="default" className="flex-1">
          <Play className="w-4 h-4 mr-2" />
          Resume
        </Button>
      ) : (
        <Button onClick={handlePause} variant="secondary" className="flex-1">
          <Pause className="w-4 h-4 mr-2" />
          Pause
        </Button>
      )}

      <Button onClick={handleStop} variant="destructive">
        <Square className="w-4 h-4" />
      </Button>
    </div>
  )
}
