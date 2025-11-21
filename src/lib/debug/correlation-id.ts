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

  // Just use the UUID - simpler and user confirmed it works in manual search
  const searchQuery = requestId
  const date = new Date(timestamp)
  // Expand time window to ±15 minutes for better coverage
  const startTime = new Date(date.getTime() - 15 * 60 * 1000).toISOString()
  const endTime = new Date(date.getTime() + 15 * 60 * 1000).toISOString()

  // Build URL with unencoded query to match Supabase's expected format
  return `https://supabase.com/dashboard/project/${projectId}/logs/edge-functions?f=${functionName}&q=${searchQuery}&s=${startTime}&e=${endTime}`
}
