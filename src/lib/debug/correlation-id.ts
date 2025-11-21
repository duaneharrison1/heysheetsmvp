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

  // Use REQUEST_ID: prefix format as it appears in logs: [REQUEST_ID:xxx]
  const searchQuery = encodeURIComponent(`REQUEST_ID:${requestId}`)
  const date = new Date(timestamp)
  // Expand time window to ±10 minutes for better coverage
  const startTime = new Date(date.getTime() - 10 * 60 * 1000).toISOString()
  const endTime = new Date(date.getTime() + 10 * 60 * 1000).toISOString()

  return `https://supabase.com/dashboard/project/${projectId}/logs/edge-functions?f=${functionName}&q=${searchQuery}&s=${startTime}&e=${endTime}`
}
