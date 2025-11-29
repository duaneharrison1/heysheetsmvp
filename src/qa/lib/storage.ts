import type { TestRunSummary } from './types'

const STORAGE_KEY = 'heysheets-qa-test-results'

interface ResultsBlob {
  results: TestRunSummary[]
}

export async function saveTestResult(summary: TestRunSummary): Promise<void> {
  try {
    // Load existing results
    const existing = await loadTestResults()

    // Add new result
    existing.results.push(summary)

    // Keep only last 100 results
    if (existing.results.length > 100) {
      existing.results = existing.results.slice(-100)
    }

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))

    console.log('✅ Test result saved:', summary.testRunId)

  } catch (error) {
    console.error('❌ Failed to save test result:', error)
    throw error
  }
}

export async function loadTestResults(): Promise<ResultsBlob> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)

    if (!stored) {
      return { results: [] }
    }

    const data = JSON.parse(stored)
    return data

  } catch (error) {
    console.error('❌ Failed to load test results:', error)
    return { results: [] }
  }
}

export async function getTestResultsByScenario(scenarioId: string): Promise<TestRunSummary[]> {
  const { results } = await loadTestResults()
  return results.filter(r => r.scenarioId === scenarioId)
}

export async function getRecentTestResults(limit: number = 20): Promise<TestRunSummary[]> {
  const { results } = await loadTestResults()
  return results
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
}
