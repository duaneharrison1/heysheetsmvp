import type { DebugRequest } from '@/stores/useDebugStore'

export function formatRequestForAI(request: DebugRequest): string {
  const lines: string[] = []

  lines.push(`DEBUG REQUEST #${request.id.slice(0, 8)}`)
  lines.push('')
  lines.push(`USER MESSAGE: "${request.userMessage}"`)
  lines.push('')

  // Intent
  if (request.intent) {
    lines.push('INTENT CLASSIFICATION:')
    lines.push(`- Detected: ${request.intent.detected}`)
    lines.push(`- Confidence: ${request.intent.confidence}`)
    lines.push(`- Duration: ${request.intent.duration}ms`)
    lines.push('')
  }

  // Functions
  if (request.functionCalls?.length > 0) {
    lines.push('FUNCTION CALLS:')
    request.functionCalls.forEach((fn, idx) => {
      lines.push(`${idx + 1}. ${fn.name} ${fn.result.success ? '✅' : '❌'}`)
      lines.push(`   Args: ${JSON.stringify(fn.arguments, null, 2)}`)
      if (!fn.result.success) {
        lines.push(`   Error: ${fn.result.error}`)
      }
      lines.push(`   Duration: ${fn.duration}ms`)
      lines.push('')
    })
  }

  // Timing
  lines.push('TIMELINE:')
  lines.push(`[0ms] Request start`)
  if (request.timings.intentDuration) {
    lines.push(`[${request.timings.intentDuration}ms] Intent classified`)
  }
  if (request.timings.functionDuration) {
    lines.push(`[${request.timings.intentDuration! + request.timings.functionDuration}ms] Functions executed`)
  }
  if (request.timings.totalDuration) {
    lines.push(`[${request.timings.totalDuration}ms] Complete`)
  }
  lines.push('')

  // Tokens
  if (request.tokens) {
    lines.push(`TOKENS: ${request.tokens.total.input} in / ${request.tokens.total.output} out`)
    lines.push(`COST: $${request.cost?.total.toFixed(5) || '0.00000'}`)
  }

  // Error
  if (request.error) {
    lines.push('')
    lines.push(`❌ ERROR: ${request.error.message}`)
    lines.push(`Stage: ${request.error.stage}`)
  }

  return lines.join('\n')
}
