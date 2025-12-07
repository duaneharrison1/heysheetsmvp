import { Fragment, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { H1, Lead } from '@/components/ui/heading'
import { Loader2, ChevronDown, ChevronRight, Clock, DollarSign, Zap, MessageSquare, Store, Bot } from 'lucide-react'
import { useUserRole } from '@/hooks/useUserRole'
import { loadTestResults } from '../lib/storage'
import type { TestRunSummary } from '../lib/types'
import { supabase } from '@/lib/supabase'

// Helper to format duration from ms -> always show seconds
const formatDuration = (ms: number | null | undefined) => {
  if (ms == null || Number.isNaN(Number(ms))) return '-'
  const num = Number(ms)
  return `${(num / 1000).toFixed(2)}s`
}

const formatStepDurationFromStep = (step: any) => {
  if (!step) return '-'
  const msValue = step?.technical?.timeMs ?? step?.timeMs ?? step?.durationMs
  if (msValue != null && !Number.isNaN(Number(msValue))) {
    return formatDuration(msValue)
  }
  const raw = step?.duration ?? step?.time ?? null
  if (raw == null || Number.isNaN(Number(raw))) return '-'
  const num = Number(raw)
  if (num > 1000) return `${(num / 1000).toFixed(2)}s`
  return `${num.toFixed(2)}s`
}

export function QAResultsPage() {
  const { isSuperAdmin, loading: roleLoading } = useUserRole()
  const [results, setResults] = useState<TestRunSummary[]>([])
  const [selectedResult, setSelectedResult] = useState<TestRunSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [storedDebugRequests, setStoredDebugRequests] = useState<any[]>([])
  const [storeMap, setStoreMap] = useState<Record<string, string>>({})
  const [selectedDebug, setSelectedDebug] = useState<any | null>(null)
  const [debugLoading, setDebugLoading] = useState(false)
  const [debugError, setDebugError] = useState<string | null>(null)
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
 

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
        // Note: stored debug requests are loaded on demand to avoid blocking
        // or heavy work during initial page mount. Use the "Load Debug Requests"
        // button below to fetch them.
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

      <div className="max-w-6xl mx-auto">
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
              <div className="space-y-2">
                {results.map(result => (
                  <div 
                    key={result.testRunId}
                    className="border rounded-lg p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedResult(result)}
                  >
                    <div className="grid grid-cols-12 gap-3 items-center">
                      {/* Scenario + Date (4 cols) */}
                      <div className="col-span-4">
                        <div className="font-semibold text-sm">{result.scenarioName}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(result.timestamp).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </div>
                      </div>

                      {/* Result + Steps (3 cols) */}
                      <div className="col-span-3 flex items-center gap-2">
                        <Badge variant={result.overallPassed ? 'default' : 'destructive'} className="text-xs">
                          {result.overallPassed ? '✅ PASS' : '❌ FAIL'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {result.passedSteps}/{result.totalSteps} steps
                        </span>
                      </div>

                      {/* Quality (2 cols) */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-sm">{result.avgQualityScore}</span>
                          <span className="text-[10px] text-muted-foreground">/100</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">Quality</div>
                      </div>

                      {/* Duration + Cost (3 cols) */}
                      <div className="col-span-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-blue-500" />
                            <span className="font-bold text-sm">{(result.duration / 1000).toFixed(1)}s</span>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5 text-green-500" />
                            <span className="font-bold text-sm">${result.totalCost.toFixed(4)}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stored debug requests (recent) - Condensed Card Layout */}
      <div className="max-w-6xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <CardTitle>Stored Debug Requests (recent)</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  setDebugError(null)
                  setDebugLoading(true)
                  try {
                    const { data, error } = await supabase
                      .from('debug_requests')
                      .select('*')
                      .order('created_at', { ascending: false })
                      .limit(50)

                    if (error) throw error

                    const slice = Array.isArray(data) ? data : []
                    setStoredDebugRequests(slice)

                    const ids = Array.from(new Set(slice.map((r: any) => r.store_id).filter(Boolean))).slice(0, 200)
                    if (ids.length > 0) {
                      const { data: storesData } = await supabase
                        .from('stores')
                        .select('id, name')
                        .in('id', ids as any)

                      const map: Record<string, string> = {}
                      ;(storesData || []).forEach((s: any) => {
                        map[s.id] = s.name
                      })
                      setStoreMap(map)
                    }
                  } catch (e: any) {
                    console.error('Failed to load stored debug requests:', e)
                    setDebugError(e?.message || String(e))
                    setStoredDebugRequests([])
                  } finally {
                    setDebugLoading(false)
                  }
                }}
              >
                {debugLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load Debug Requests'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {debugError && (
              <div className="text-sm text-destructive mb-4">Failed to load debug requests: {debugError}</div>
            )}

            {storedDebugRequests.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No stored debug requests found. Click "Load Debug Requests" to fetch recent entries.
              </div>
            ) : (
              <div className="space-y-2">
                {storedDebugRequests.map((r) => {
                  const functionsList = (r.function_calls || []).map((f: any) => f.name)
                  const stepsArray: any[] = Array.isArray(r.steps) ? r.steps : []
                  const stepsCount = stepsArray.length
                  const durationMs = r.timings?.totalDuration || r.timings?.duration || null
                  const cost = r.cost?.total ?? null
                  const intent = r.intent?.detected || r.metadata?.intent || (stepsArray[0]?.result?.intent) || ''
                  const mode = r?.metadata?.architecture ?? (
                    r?.metadata?.nativeMode === true ? 'native' : r?.metadata?.nativeMode === false ? 'classifier' : '-'
                  )
                  const isExpanded = expandedRows[r.id]
                  // Pick common timing fields with fallbacks
                  const pickTiming = (...keys: string[]) => {
                    for (const k of keys) {
                      const v = (r.timings && (r.timings as any)[k])
                      if (v !== undefined && v !== null) return v
                    }
                    return null
                  }

                  const intentDurRaw = pickTiming('intentDuration', 'intent_duration', 'intentMs', 'intent_ms', 'intent')
                  const functionDurRaw = pickTiming('functionDuration', 'function_duration', 'functionMs', 'function_ms', 'function')
                  const responseDurRaw = pickTiming('responseDuration', 'response_duration', 'responseMs', 'response_ms', 'response')
                  const intentDur = intentDurRaw != null ? Number(intentDurRaw) : null
                  const functionDur = functionDurRaw != null ? Number(functionDurRaw) : null
                  const responseDur = responseDurRaw != null ? Number(responseDurRaw) : null

                  return (
                    <div 
                      key={r.id} 
                      className="border rounded-lg overflow-hidden bg-card hover:bg-muted/30 transition-colors"
                    >
                      {/* Main Row - Condensed View */}
                      <div
                        className="p-3 cursor-pointer"
                        onClick={() => setExpandedRows(prev => ({ ...prev, [r.id]: !prev[r.id] }))}
                      >
                        <div className="grid grid-cols-12 gap-3 items-start">
                          {/* Column 1: Expand indicator + Model/Mode/Time (3 cols) */}
                          <div className="col-span-3 flex items-start gap-2">
                            <div className="mt-1 text-muted-foreground">
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Bot className="h-4 w-4 text-primary shrink-0" />
                                <span className="font-semibold text-sm truncate">{r.model || '-'}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {mode}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(r.created_at).toLocaleString(undefined, {
                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Column 2: Store + Message + Intent (4 cols) */}
                          <div className="col-span-4">
                            <div className="flex items-center gap-1.5">
                              <Store className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-sm font-medium truncate">
                                {storeMap[r.store_id] || r.store_id?.slice(0, 8) || '-'}
                              </span>
                            </div>
                            {r.user_message && (
                              <div className="mt-1 text-xs text-muted-foreground line-clamp-2 flex items-start gap-2">
                                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                <span className="break-words">{r.user_message}</span>
                              </div>
                            )}
                            {intent && (
                              <div className="flex items-center gap-1 mt-1">
                                <Zap className="h-3 w-3 text-amber-500 shrink-0" />
                                <span className="text-[10px] text-muted-foreground truncate">{intent}</span>
                              </div>
                            )}
                            {/* Functions moved below intent for condensed view */}
                            {functionsList.length > 0 && (
                              <div className="mt-1 flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] text-muted-foreground">Functions:</span>
                                {functionsList.slice(0, 5).map((fn: string, idx: number) => (
                                  <Badge key={idx} variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-mono">
                                    {fn}
                                  </Badge>
                                ))}
                                {functionsList.length > 5 && (
                                  <span className="text-[9px] text-muted-foreground">+{functionsList.length - 5}</span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Column 3: Timing + Cost (5 cols) */}
                          <div className="col-span-5">
                            <div className="flex items-center justify-between gap-2">
                              {/* Total Duration - Prominent */}
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4 text-blue-500 shrink-0" />
                                <span className="font-bold text-sm">
                                  {formatDuration(durationMs)}
                                </span>
                              </div>
                              {/* Cost - Prominent */}
                              <div className="flex items-center gap-1">
                                <DollarSign className="h-4 w-4 text-green-500 shrink-0" />
                                <span className="font-bold text-sm">
                                  {cost !== null ? `${Number(cost).toFixed(4)}` : '-'}
                                </span>
                              </div>
                            </div>
                            {/* Step timing breakdown - Smaller */}
                            {stepsCount > 0 && (
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                <span className="text-[10px] text-muted-foreground">{stepsCount} steps:</span>
                                {stepsArray.slice(0, 4).map((step, idx) => {
                                  // Abbreviate step names for compact display
                                  const stepName = step?.name || step?.function || '';
                                  const abbrev = stepName.startsWith('Tool Selection') ? 'Tool'
                                    : stepName === 'Function Execution' ? `Fn:${step?.functionCalled || 'exec'}`
                                    : stepName === 'LLM Response' ? 'LLM'
                                    : stepName === 'Intent Classification' ? 'Tool'  // Legacy fallback
                                    : stepName === 'Response Generation' ? 'LLM'     // Legacy fallback
                                    : stepName === 'Native Tool Calling' ? 'Native'  // Old native single-step fallback
                                    : stepName.slice(0, 6);
                                  return (
                                    <Badge key={idx} variant="secondary" className="text-[9px] px-1 py-0 h-4">
                                      {abbrev} {formatStepDurationFromStep(step)}
                                    </Badge>
                                  );
                                })}
                                {stepsCount > 4 && (
                                  <span className="text-[9px] text-muted-foreground">+{stepsCount - 4}</span>
                                )}
                              </div>
                            )}
                            {/* Inline specific timing fields shown under total time */}
                            {/* <div className="mt-2 text-[11px] text-muted-foreground space-y-1">
                              <div className="flex justify-between">
                                <span>intentDuration:</span>
                                <span className="font-mono">{formatDuration(intentDur)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>functionDuration:</span>
                                <span className="font-mono">{formatDuration(functionDur)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>responseDuration:</span>
                                <span className="font-mono">{formatDuration(responseDur)}</span>
                              </div>
                            </div> */}
                          </div>
                        </div>

                        
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="border-t bg-muted/50 p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            {/* Response */}
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground mb-1">Response</div>
                              <div className="text-sm bg-background rounded p-2 max-h-32 overflow-y-auto">
                                {r.response_text || '-'}
                              </div>
                            </div>
                            {/* Timings breakdown */}
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground mb-1">Timing Breakdown</div>
                              <div className="text-xs bg-background rounded p-2 space-y-1">
                                {r.timings ? Object.entries(r.timings).map(([key, val]) => (
                                  <div key={key} className="flex justify-between">
                                    <span className="text-muted-foreground">{key}:</span>
                                    <span className="font-mono">{typeof val === 'number' ? formatDuration(val) : String(val)}</span>
                                  </div>
                                )) : <span className="text-muted-foreground">No timing data</span>}
                              </div>
                            </div>
                          </div>

                          {/* Steps Detail */}
                          {stepsArray.length > 0 && (
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground mb-2">Steps Detail ({stepsArray.length} steps)</div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {stepsArray.map((step, sidx) => {
                                  const ms = formatStepDurationFromStep(step)
                                  const stepName = step?.name || step?.function || `Step ${sidx + 1}`
                                  const stepStatus = step?.status || 'unknown'
                                  const functionCalled = step?.functionCalled || step?.result?.function || null
                                  const stepIntent = step?.result?.intent || null
                                  const stepConfidence = step?.result?.confidence || null
                                  const stepError = step?.error?.message || step?.error || null
                                  const stepTokens = step?.result?.tokens || null
                                  return (
                                    <div key={sidx} className="bg-background rounded p-2 text-xs">
                                      <div className="flex justify-between items-center mb-1">
                                        <div className="flex items-center gap-1.5">
                                          <Badge 
                                            variant={stepStatus === 'success' ? 'default' : stepStatus === 'error' ? 'destructive' : 'secondary'} 
                                            className="text-[10px]"
                                          >
                                            {stepName}
                                          </Badge>
                                        </div>
                                        <span className="text-[10px] font-mono text-muted-foreground">{ms}</span>
                                      </div>
                                      <div className="space-y-0.5 text-[10px]">
                                        {functionCalled && (
                                          <div>
                                            <span className="text-muted-foreground">Function: </span>
                                            <span className="font-mono">{functionCalled}</span>
                                          </div>
                                        )}
                                        {stepIntent && (
                                          <div>
                                            <span className="text-muted-foreground">Intent: </span>
                                            <span>{stepIntent}{stepConfidence ? ` (${stepConfidence}%)` : ''}</span>
                                          </div>
                                        )}
                                        {stepTokens && (
                                          <div>
                                            <span className="text-muted-foreground">Tokens: </span>
                                            <span className="font-mono">{stepTokens.input || 0}↓ {stepTokens.output || 0}↑</span>
                                          </div>
                                        )}
                                        {stepError && (
                                          <div className="text-destructive">
                                            <span>Error: </span>
                                            <span className="line-clamp-2">{stepError}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* View Full Details button */}
                          <div className="mt-3 flex justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedDebug(r)
                              }}
                            >
                              View Full Details
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
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
                          <span>⏱️ {formatDuration(step.technical.timeMs)}</span>
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

      {/* Debug Details Dialog */}
      <Dialog open={!!selectedDebug} onOpenChange={() => setSelectedDebug(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Debug Request Details</DialogTitle>
          </DialogHeader>

          {selectedDebug && (
            <div className="space-y-4">
              <Card>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Store</div>
                      <div className="font-semibold">{storeMap[selectedDebug.store_id] || selectedDebug.store_id}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Model</div>
                      <div className="font-semibold">{selectedDebug.model}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">User message</div>
                      <div className="break-words">{selectedDebug.user_message}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Response</div>
                      <div className="break-words">{selectedDebug.response_text}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Timings</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(selectedDebug.timings, null, 2)}</pre>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Function calls</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(selectedDebug.function_calls, null, 2)}</pre>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Steps</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(selectedDebug.steps, null, 2)}</pre>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Reasoning</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm whitespace-pre-wrap">{selectedDebug.reasoning || '—'}</div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
