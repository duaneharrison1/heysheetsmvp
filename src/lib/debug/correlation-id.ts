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

  // Use just the UUID - user confirmed this works in Supabase search
  const searchQuery = encodeURIComponent(requestId)
  const date = new Date(timestamp)
  // Expand time window to ±5 minutes for better coverage
  const startTime = new Date(date.getTime() - 5 * 60 * 1000).toISOString()
  const endTime = new Date(date.getTime() + 5 * 60 * 1000).toISOString()

  return `https://supabase.com/dashboard/project/${projectId}/logs/edge-functions?f=${functionName}&q=${searchQuery}&s=${startTime}&e=${endTime}`
}
