import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useDebugStore } from '@/stores/useDebugStore'

export function TestModeSwitch() {
  const { isTestMode, setTestMode } = useDebugStore()

  return (
    <div className="flex items-center gap-2 mb-3">
      <Switch
        id="test-mode"
        checked={isTestMode}
        onCheckedChange={setTestMode}
      />
      <Label htmlFor="test-mode" className="cursor-pointer">
        {isTestMode ? '🧪 Test Mode: ON' : 'Test Mode'}
      </Label>
    </div>
  )
}
