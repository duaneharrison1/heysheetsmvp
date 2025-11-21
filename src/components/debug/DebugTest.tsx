// Temporary test component to verify debug setup
export function DebugTest() {
  const isDev = import.meta.env.DEV;
  const mode = import.meta.env.MODE;

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'black',
      color: 'lime',
      padding: '10px',
      borderRadius: '5px',
      zIndex: 9999,
      fontSize: '12px',
      fontFamily: 'monospace'
    }}>
      <div>🔍 Debug Test</div>
      <div>Mode: {mode}</div>
      <div>DEV: {isDev ? '✅ TRUE' : '❌ FALSE'}</div>
    </div>
  );
}
