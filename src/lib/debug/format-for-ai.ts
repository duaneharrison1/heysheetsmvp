import type { DebugRequest, Message } from '@/stores/useDebugStore'

/**
 * Format a single request with recent conversation context
 * Used by "Copy" button - shows last 5-6 messages
 */
export function formatRequestForAI(
  request: DebugRequest,
  allMessages: Message[]
): string {
  const lines: string[] = []

  // Special formatting for test scenario cards
  if (request.userMessage.startsWith('📋 Test Scenario:')) {
    lines.push(`TEST SCENARIO`)
    lines.push(`Time: ${new Date(request.timestamp).toLocaleString()}`)
    lines.push('')
    lines.push(request.userMessage.replace('📋 Test Scenario: ', 'Name: '))
    lines.push('')
    if (request.response?.text) {
      lines.push(request.response.text)
    }
    return lines.join('\n')
  }

  lines.push(`CHAT DEBUG`)
  lines.push(`Time: ${new Date(request.timestamp).toLocaleString()}`)
  lines.push('')

  // Find the position of current user message in conversation
  const currentMessageIndex = allMessages.findIndex(
    m => m.content === request.userMessage && m.type === 'user'
  )

  // Get last 5-6 messages before current (2-3 turns of context)
  if (currentMessageIndex > 0) {
    const contextStart = Math.max(0, currentMessageIndex - 5)
    const contextMessages = allMessages.slice(contextStart, currentMessageIndex)

    if (contextMessages.length > 0) {
      lines.push(`RECENT CONVERSATION:`)
      contextMessages.forEach(msg => {
        const label = msg.type === 'user' ? 'User' : 'Bot'
        lines.push(`${label}: "${msg.content}"`)
      })
      lines.push('')
    }
  }

  // Current request
  lines.push(`CURRENT REQUEST:`)
  lines.push(`User: "${request.userMessage}"`)
  lines.push('')

  // Tool Selection
  if (request.toolSelection?.function) {
    lines.push(`TOOL SELECTED: ${request.toolSelection.function}`)
    lines.push(`Duration: ${(request.timings.intentDuration! / 1000).toFixed(2)}s`)
    lines.push('')
  }

  // Functions
  if (request.functionCalls && request.functionCalls.length > 0) {
    request.functionCalls.forEach((fn, idx) => {
      if (idx > 0) lines.push('---')

      lines.push(`FUNCTION: ${fn.name}`)

      // Arguments
      if (!fn.arguments || Object.keys(fn.arguments).length === 0) {
        lines.push(`Arguments: (none - returning all results)`)
      } else {
        lines.push(`Arguments:`)
        lines.push(JSON.stringify(fn.arguments, null, 2))
      }

      // Result
      if (fn.result.success) {
        lines.push(`Result: SUCCESS`)
        if (fn.result.data) {
          lines.push(`Data:`)
          lines.push(JSON.stringify(fn.result.data, null, 2))
        }
      } else {
        lines.push(`Result: ERROR`)
        lines.push(`Error: ${fn.result.error || 'Unknown error'}`)
      }

      lines.push(`Duration: ${(fn.duration / 1000).toFixed(2)}s`)
      lines.push('')
    })
  }

  // Response
  if (request.response) {
    lines.push(`BOT RESPONSE:`)
    lines.push(request.response.text)
    lines.push('')
    lines.push(`Duration: ${(request.timings.responseDuration! / 1000).toFixed(2)}s`)
    lines.push('')
  } else if (request.status === 'error') {
    lines.push(`BOT RESPONSE: (error - no response)`)
    lines.push('')
  }

  // Timing summary
  lines.push(`TIMING:`)
  lines.push(`Total: ${(request.timings.totalDuration! / 1000).toFixed(2)}s`)
  if (request.timings.intentDuration) {
    lines.push(`  Tool Selection: ${(request.timings.intentDuration / 1000).toFixed(2)}s`)
  }
  if (request.timings.functionDuration) {
    lines.push(`  Functions: ${(request.timings.functionDuration / 1000).toFixed(2)}s`)
  }
  if (request.timings.responseDuration) {
    lines.push(`  Response: ${(request.timings.responseDuration / 1000).toFixed(2)}s`)
  }

  if (request.tokens) {
    lines.push(`Tokens: ${request.tokens.total.input} in / ${request.tokens.total.output} out`)
  }
  if (request.cost) {
    lines.push(`Cost: $${request.cost.total.toFixed(5)}`)
  }
  lines.push(`Model: ${request.model}`)

  // Test results (if this was a test)
  if (request.testResult) {
    lines.push('')
    lines.push(`TEST RESULTS:`)
    lines.push(`Status: ${request.testResult.passed ? '✅ PASSED' : '❌ FAILED'}`)

    if (request.testResult.technical) {
      lines.push(`Technical Checks:`)
      lines.push(`  Intent Correct: ${request.testResult.technical.intentCorrect ? '✓' : '✗'}`)
      lines.push(`  Confidence OK: ${request.testResult.technical.confidenceOK ? '✓' : '✗'}`)
      lines.push(`  Functions Correct: ${request.testResult.technical.functionsCorrect ? '✓' : '✗'}`)
      lines.push(`  Timing OK: ${request.testResult.technical.timingOK ? '✓' : '✗'}`)
      lines.push(`  No Errors: ${request.testResult.technical.noErrors ? '✓' : '✗'}`)
    }

    if (request.testResult.quality) {
      lines.push(`Quality Score: ${request.testResult.quality.score}/100 ${request.testResult.quality.passed ? '✓' : '✗'}`)
      lines.push(`Reasoning: ${request.testResult.quality.reasoning}`)
    }
  }

  // Problem detection
  if (request.status === 'error' || request.functionCalls?.some(fn => !fn.result.success)) {
    lines.push('')
    lines.push(`PROBLEM:`)
    const failedFn = request.functionCalls?.find(fn => !fn.result.success)
    if (failedFn) {
      lines.push(`Function "${failedFn.name}" failed: ${failedFn.result.error}`)
    }
    if (request.error) {
      lines.push(`Error in ${request.error.stage}: ${request.error.message}`)
    }
  }

  return lines.join('\n')
}

/**
 * Format entire conversation history with all requests
 * Used by "Copy All" button
 */
export function formatAllRequestsForAI(
  requests: DebugRequest[],
  allMessages: Message[]
): string {
  const lines: string[] = []

  lines.push(`FULL CONVERSATION DEBUG`)
  lines.push(`Total exchanges: ${Math.floor(allMessages.length / 2)}`)
  lines.push(`Total requests: ${requests.length}`)
  lines.push('')
  lines.push('='.repeat(60))
  lines.push('')

  // Reverse to show oldest first (Request 1 = earliest)
  const orderedRequests = [...requests].reverse()

  // Group messages by request
  orderedRequests.forEach((request, idx) => {
    // Special handling for test scenario cards
    if (request.userMessage.startsWith('📋 Test Scenario:')) {
      lines.push(`TEST SCENARIO ${idx + 1}`)
      lines.push(`Time: ${new Date(request.timestamp).toLocaleString()}`)
      lines.push('')
      lines.push(request.userMessage.replace('📋 Test Scenario: ', 'Name: '))
      lines.push('')
      if (request.response?.text) {
        lines.push(request.response.text)
      }
      lines.push('')
      lines.push('-'.repeat(60))
      lines.push('')
      return
    }

    lines.push(`REQUEST ${idx + 1}`)
    lines.push(`Time: ${new Date(request.timestamp).toLocaleString()}`)
    lines.push('')

    lines.push(`User: "${request.userMessage}"`)
    lines.push('')

    // Tool Selection
    if (request.toolSelection?.function) {
      lines.push(`TOOL SELECTED: ${request.toolSelection.function}`)
      if (request.timings.intentDuration) {
        lines.push(`Duration: ${(request.timings.intentDuration / 1000).toFixed(2)}s`)
      }
      lines.push('')
    }

    // Functions with full data
    if (request.functionCalls && request.functionCalls.length > 0) {
      request.functionCalls.forEach((fn, fnIdx) => {
        if (fnIdx > 0) lines.push('---')

        lines.push(`FUNCTION: ${fn.name}`)

        // Arguments
        if (!fn.arguments || Object.keys(fn.arguments).length === 0) {
          lines.push(`Arguments: (none - returning all results)`)
        } else {
          lines.push(`Arguments:`)
          lines.push(JSON.stringify(fn.arguments, null, 2))
        }

        // Result with data
        if (fn.result.success) {
          lines.push(`Result: SUCCESS`)
          if (fn.result.data) {
            lines.push(`Data:`)
            lines.push(JSON.stringify(fn.result.data, null, 2))
          }
        } else {
          lines.push(`Result: ERROR`)
          lines.push(`Error: ${fn.result.error || 'Unknown error'}`)
        }

        lines.push(`Duration: ${(fn.duration / 1000).toFixed(2)}s`)
        lines.push('')
      })
    }

    // Bot response
    if (request.response) {
      lines.push(`BOT RESPONSE:`)
      lines.push(request.response.text)
      lines.push('')
      if (request.timings.responseDuration) {
        lines.push(`Duration: ${(request.timings.responseDuration / 1000).toFixed(2)}s`)
        lines.push('')
      }
    } else if (request.status === 'error') {
      lines.push(`BOT RESPONSE: (error - no response)`)
      lines.push('')
    }

    // Timing breakdown
    lines.push(`TIMING:`)
    lines.push(`Total: ${(request.timings.totalDuration! / 1000).toFixed(2)}s`)
    if (request.timings.intentDuration) {
      lines.push(`  Tool Selection: ${(request.timings.intentDuration / 1000).toFixed(2)}s`)
    }
    if (request.timings.functionDuration) {
      lines.push(`  Functions: ${(request.timings.functionDuration / 1000).toFixed(2)}s`)
    }
    if (request.timings.responseDuration) {
      lines.push(`  Response: ${(request.timings.responseDuration / 1000).toFixed(2)}s`)
    }

    if (request.tokens) {
      lines.push(`Tokens: ${request.tokens.total.input} in / ${request.tokens.total.output} out`)
    }
    if (request.cost) {
      lines.push(`Cost: $${request.cost.total.toFixed(5)}`)
    }
    lines.push(`Model: ${request.model}`)

    // Test results
    if (request.testResult) {
      lines.push('')
      lines.push(`TEST RESULTS:`)
      lines.push(`Status: ${request.testResult.passed ? '✅ PASSED' : '❌ FAILED'}`)

      if (request.testResult.technical) {
        lines.push(`Technical Checks:`)
        lines.push(`  Intent Correct: ${request.testResult.technical.intentCorrect ? '✓' : '✗'}`)
        lines.push(`  Confidence OK: ${request.testResult.technical.confidenceOK ? '✓' : '✗'}`)
        lines.push(`  Functions Correct: ${request.testResult.technical.functionsCorrect ? '✓' : '✗'}`)
        lines.push(`  Timing OK: ${request.testResult.technical.timingOK ? '✓' : '✗'}`)
        lines.push(`  No Errors: ${request.testResult.technical.noErrors ? '✓' : '✗'}`)
      }

      if (request.testResult.quality) {
        lines.push(`Quality Score: ${request.testResult.quality.score}/100 ${request.testResult.quality.passed ? '✓' : '✗'}`)
        lines.push(`Reasoning: ${request.testResult.quality.reasoning}`)
      }
    }

    // Problem detection
    if (request.status === 'error' || request.functionCalls?.some(fn => !fn.result.success)) {
      lines.push('')
      lines.push(`PROBLEM:`)
      const failedFn = request.functionCalls?.find(fn => !fn.result.success)
      if (failedFn) {
        lines.push(`Function "${failedFn.name}" failed: ${failedFn.result.error}`)
      }
      if (request.error) {
        lines.push(`Error in ${request.error.stage}: ${request.error.message}`)
      }
    }

    lines.push('')
    lines.push('-'.repeat(60))
    lines.push('')
  })

  // Summary
  const totalCost = requests.reduce((sum, r) => sum + (r.cost?.total || 0), 0)
  const totalTime = requests.reduce((sum, r) => sum + (r.timings.totalDuration || 0), 0)

  lines.push(`CONVERSATION SUMMARY:`)
  lines.push(`Total time: ${(totalTime / 1000).toFixed(2)}s`)
  lines.push(`Total cost: $${totalCost.toFixed(5)}`)
  if (requests.length > 0) {
    lines.push(`Average per request: ${(totalTime / requests.length / 1000).toFixed(2)}s`)
  }

  return lines.join('\n')
}
