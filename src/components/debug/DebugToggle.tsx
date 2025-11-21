import { useDebugStore } from '@/stores/useDebugStore';
import { useEffect } from 'react';
import { Bug } from 'lucide-react';

export function DebugToggle() {
  const { togglePanel } = useDebugStore();

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl+Shift+D to toggle debug panel
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        togglePanel();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [togglePanel]);

  // Now visible in production too
  return (
    <button
      onClick={togglePanel}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      title="Open debug panel (Ctrl+Shift+D)"
    >
      <Bug className="h-3.5 w-3.5" />
      <span>Debug</span>
    </button>
  );
}
