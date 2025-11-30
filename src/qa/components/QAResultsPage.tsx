import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { H1, Lead } from '@/components/ui/heading'
import { Loader2 } from 'lucide-react'
import { useUserRole } from '@/hooks/useUserRole'
import { loadTestResults } from '../lib/storage'
import type { TestRunSummary } from '../lib/types'

export function QAResultsPage() {
  const { isSuperAdmin, loading: roleLoading } = useUserRole()
  const [results, setResults] = useState<TestRunSummary[]>([])
  const [selectedResult, setSelectedResult] = useState<TestRunSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Wait for role check to complete
    if (roleLoading) return
    
    // Only load if user is super admin
    if (!isSuperAdmin) {
      setLoading(false)
      return
    }
    
    let cancelled = false

    async function load() {
      try {
        const { results: loaded } = await loadTestResults()
        if (!cancelled) {
          setResults(loaded.sort((a, b) => b.timestamp - a.timestamp))
        }
      } catch (error) {
        console.error('Failed to load results:', error)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    
    return () => {
      cancelled = true
    }
  }, [roleLoading, isSuperAdmin])

  // Show loading while checking role
  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  // Access denied for non-super admins
  if (!isSuperAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <H1>Access Denied</H1>
          <Lead>You don't have permission to access this page</Lead>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Only super administrators can access QA test results.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <H1>QA Test Results</H1>
        <Lead>View and analyze AI response quality test results</Lead>
      </div>

      <div className="max-w-5xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Test Results History</CardTitle>
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
      </div>

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
