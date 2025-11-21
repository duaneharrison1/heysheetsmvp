export function generateCorrelationId(): string {
  return crypto.randomUUID()
}

export function generateSupabaseLogLink(
  requestId: string,
  timestamp: number,
  functionName: 'chat-completion' | 'classifier' | 'tools' | 'responder' | 'google-sheet' = 'chat-completion'
): string {
  const projectId = import.meta.env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

  if (!projectId) {
    console.warn('Cannot extract project ID from VITE_SUPABASE_URL')
    return '#'
  }

  // Use ?s= parameter to pre-fill search with requestId
  // Format: /functions/{function-name}/logs?s=[{request-id}]
  const searchTerm = `[${requestId}]`

  return `https://supabase.com/dashboard/project/${projectId}/functions/${functionName}/logs?s=${encodeURIComponent(searchTerm)}`
}

// Helper to generate links for all steps
export function generateStepLogLinks(
  requestId: string,
  timestamp: number,
  steps: Array<{ stepName: string; functionName: 'classifier' | 'tools' | 'responder' | 'chat-completion' | 'google-sheet' }>
): Array<{ stepName: string; functionName: string; url: string }> {
  return steps.map(step => ({
    stepName: step.stepName,
    functionName: step.functionName,
    url: generateSupabaseLogLink(requestId, timestamp, step.functionName)
  }))
}
