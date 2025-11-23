import { put, list } from '@vercel/blob'
import type { TestRunSummary } from './types'

const BLOB_FILENAME = 'qa-test-results.json'

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

    // Save back to blob
    await put(BLOB_FILENAME, JSON.stringify(existing, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false
    })

    console.log('✅ Test result saved:', summary.testRunId)

  } catch (error) {
    console.error('❌ Failed to save test result:', error)
    throw error
  }
}

export async function loadTestResults(): Promise<ResultsBlob> {
  try {
    const { blobs } = await list()
    const resultsBlob = blobs.find(blob => blob.pathname === BLOB_FILENAME)

    if (!resultsBlob) {
      // No results yet
      return { results: [] }
    }

    const response = await fetch(resultsBlob.url)
    const data = await response.json()

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
