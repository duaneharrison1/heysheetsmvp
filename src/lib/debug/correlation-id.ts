export function generateCorrelationId(): string {
  return crypto.randomUUID()
}

export function generateSupabaseLogLink(
  requestId: string,
  timestamp: number,
  functionName: string = 'chat-completion'
): string {
  const projectId = import.meta.env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

  if (!projectId) {
    console.warn('Cannot extract project ID from VITE_SUPABASE_URL')
    return '#'
  }

  // Use Supabase's actual log link format for specific log entries
  // Format: /functions/{function-name}/logs?log={request-id}
  return `https://supabase.com/dashboard/project/${projectId}/functions/${functionName}/logs?log=${requestId}`
}
