import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { loadTestResults } from '../lib/storage'
import type { TestRunSummary } from '../lib/types'

export function QAResultsPage() {
  const [results, setResults] = useState<TestRunSummary[]>([])
  const [selectedResult, setSelectedResult] = useState<TestRunSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { results: loaded } = await loadTestResults()
        setResults(loaded.sort((a, b) => b.timestamp - a.timestamp))
      } catch (error) {
        console.error('Failed to load results:', error)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-center">Loading test results...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8">
      <Card>
        <CardHeader>
          <CardTitle>QA Test Results History</CardTitle>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No test results yet. Run a test to see results here.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Scenario</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map(result => (
                  <TableRow key={result.testRunId}>
                    <TableCell>
                      {new Date(result.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>{result.scenarioName}</TableCell>
                    <TableCell>
                      <Badge variant={result.overallPassed ? 'default' : 'destructive'}>
                        {result.overallPassed ? '✅ PASS' : '❌ FAIL'}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        {result.passedSteps}/{result.totalSteps} steps
                      </div>
                    </TableCell>
                    <TableCell>
                      {result.avgQualityScore}/100
                    </TableCell>
                    <TableCell>
                      {(result.duration / 1000).toFixed(1)}s
                    </TableCell>
                    <TableCell>
                      ${result.totalCost.toFixed(4)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedResult(result)}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={!!selectedResult} onOpenChange={() => setSelectedResult(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedResult?.scenarioName}</DialogTitle>
          </DialogHeader>

          {selectedResult && (
            <div className="space-y-4">
              {/* Overall stats */}
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Result</div>
                      <Badge variant={selectedResult.overallPassed ? 'default' : 'destructive'}>
                        {selectedResult.overallPassed ? '✅ PASS' : '❌ FAIL'}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Quality</div>
                      <div className="font-semibold">{selectedResult.avgQualityScore}/100</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Duration</div>
                      <div className="font-semibold">{(selectedResult.duration / 1000).toFixed(1)}s</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Cost</div>
                      <div className="font-semibold">${selectedResult.totalCost.toFixed(4)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Step-by-step results */}
              <div className="space-y-2">
                <h3 className="font-semibold">Step-by-Step Results</h3>
                {selectedResult.steps.map((step, idx) => (
                  <Card key={step.stepId}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold">Step {idx + 1}</div>
                        <Badge variant={step.passed ? 'default' : 'destructive'}>
                          {step.passed ? '✅ PASS' : '❌ FAIL'}
                        </Badge>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div>
                          <div className="text-muted-foreground">User:</div>
                          <div>{step.userMessage}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Bot:</div>
                          <div>{step.botResponse}</div>
                        </div>

                        {step.quality && (
                          <div className="bg-muted p-2 rounded">
                            <div className="font-semibold">Quality: {step.quality.score}/100</div>
                            <div className="text-xs">{step.quality.reasoning}</div>
                          </div>
                        )}

                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>⏱️ {step.technical.timeMs}ms</span>
                          <span>Intent: {step.technical.intentActual}</span>
                          {step.technical.functionsActual.length > 0 && (
                            <span>Functions: {step.technical.functionsActual.join(', ')}</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Overall evaluation */}
              {selectedResult.overallEvaluation && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Overall Evaluation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <div className="text-sm text-muted-foreground">Score</div>
                        <div className="font-semibold">{selectedResult.overallEvaluation.score}/100</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Quality</div>
                        <div className="font-semibold capitalize">{selectedResult.overallEvaluation.conversationQuality}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Reasoning</div>
                        <div className="text-sm">{selectedResult.overallEvaluation.reasoning}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
