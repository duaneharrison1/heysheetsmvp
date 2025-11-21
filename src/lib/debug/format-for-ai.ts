import type { DebugRequest, DebugStep } from '@/stores/useDebugStore'
import { generateSupabaseLogLink } from './correlation-id'

export function formatRequestForAI(request: DebugRequest): string {
  const lines: string[] = []

  lines.push(`DEBUG REQUEST #${request.id.slice(0, 8)}`)
  lines.push(`Timestamp: ${new Date(request.timestamp).toLocaleString()}`)
  lines.push('')
  lines.push(`USER MESSAGE: "${request.userMessage}"`)
  lines.push(`STATUS: ${request.status.toUpperCase()}`)
  lines.push('')

  // Step-by-step breakdown
  if (request.steps && request.steps.length > 0) {
    lines.push('EXECUTION STEPS:')
    lines.push('')

    request.steps.forEach((step, idx) => {
      const statusIcon =
        step.status === 'success' ? '✅' :
        step.status === 'error' ? '❌' : '⏸️'

      lines.push(`${statusIcon} Step ${idx + 1}: ${step.name} (${step.duration.toFixed(0)}ms)`)
      lines.push(`   Function: ${step.function}`)

      if (step.status === 'success' && step.result) {
        if (step.result.intent) {
          lines.push(`   Result: ${step.result.intent} (${step.result.confidence ? `${(step.result.confidence * 100).toFixed(0)}% confidence` : ''})`)
        }
        if (step.functionCalled) {
          lines.push(`   Called: ${step.functionCalled}`)
        }
        if (step.result.length !== undefined) {
          lines.push(`   Result: Generated ${step.result.length} characters`)
        }
      }

      if (step.status === 'error' && step.error) {
        lines.push(`   ❌ ERROR: ${step.error.message}`)
        if (step.error.args) {
          lines.push(`   Arguments: ${JSON.stringify(step.error.args, null, 2)}`)
        }
      }

      if (step.status === 'skipped') {
        lines.push(`   Skipped due to previous error`)
      }

      // Add log link
      lines.push(`   Logs: ${generateSupabaseLogLink(request.id, request.timestamp, step.function)}`)
      lines.push('')
    })
  } else {
    // Fallback to old format if steps not available
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
  }

  // Total timing
  if (request.timings.totalDuration) {
    lines.push(`TOTAL DURATION: ${request.timings.totalDuration.toFixed(0)}ms`)
  }

  // Tokens & Cost
  if (request.tokens) {
    lines.push(`TOKENS: ${request.tokens.total.input} in / ${request.tokens.total.output} out`)
    lines.push(`COST: $${request.cost?.total.toFixed(5) || '0.00000'}`)
  }

  // Overall error
  if (request.error) {
    lines.push('')
    lines.push(`OVERALL ERROR:`)
    lines.push(`Stage: ${request.error.stage}`)
    lines.push(`Message: ${request.error.message}`)
    if (request.error.stack) {
      lines.push(`Stack: ${request.error.stack}`)
    }
  }

  lines.push('')
  lines.push('ALL FUNCTION LOGS:')
  lines.push(generateSupabaseLogLink(request.id, request.timestamp, 'chat-completion'))

  return lines.join('\n')
}
