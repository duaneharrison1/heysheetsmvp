import { useDebugStore } from '@/stores/useDebugStore';
import { useEffect } from 'react';

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
      className="text-xs text-gray-400 hover:text-gray-200 transition-colors px-2 py-1 rounded hover:bg-gray-800/50"
      title="Open debug panel (Ctrl+Shift+D)"
    >
      debug
    </button>
  );
}
