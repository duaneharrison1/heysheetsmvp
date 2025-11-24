import { useDebugStore } from '@/stores/useDebugStore';
import type { DebugRequest } from '@/stores/useDebugStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { HoverTooltip } from './HoverTooltip';
import { ExternalLink, Copy, X, Loader2 } from 'lucide-react';
import { generateSupabaseLogLink } from '@/lib/debug/correlation-id';
import { formatRequestForAI, formatAllRequestsForAI } from '@/lib/debug/format-for-ai';
import { DEBUG_CONFIG } from '@/config/debug';
import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';

export function DebugPanel() {
  const timelineRef = useRef<HTMLDivElement>(null);

  const {
    isPanelOpen,
    togglePanel,
    requests,
    messages,
    selectedModel,
    setModel,
    toggleRequestExpanded,
    isRequestExpanded,
    getAverageIntentTime,
    getAverageResponseTime,
    getMinMaxResponseTime,
    getMinMaxIntentTime,
    getTotalCost,
    getCostBreakdown,
    clearHistory,
    clearAll,
    isTestMode,
    currentTest,
    evaluatorModel,
    setEvaluatorModel,
  } = useDebugStore();

  const handleCopyForAI = (requestId: string) => {
    const request = requests.find((r) => r.id === requestId);
    if (!request) return;

    const formatted = formatRequestForAI(request, messages);
    navigator.clipboard.writeText(formatted);
  };

  const handleCopyAll = () => {
    if (requests.length === 0) {
      return;
    }

    const formatted = formatAllRequestsForAI(requests, messages);
    navigator.clipboard.writeText(formatted);
  };

  const minMaxResponse = getMinMaxResponseTime();
  const minMaxIntent = getMinMaxIntentTime();
  const costBreakdown = getCostBreakdown();

  // Get model name for display
  const getModelName = (modelId: string) => {
    const model = DEBUG_CONFIG.models.find(m => m.id === modelId);
    return model?.name || modelId;
  };

  // 🆕 Reverse requests array for timeline (oldest first, newest last)
  const reversedRequests = [...requests].reverse();

  // 🆕 Auto-scroll to bottom when new requests arrive (smooth)
  useEffect(() => {
    if (timelineRef.current && requests.length > 0) {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        timelineRef.current?.scrollTo({
          top: timelineRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [requests.length]);

  if (!isPanelOpen) return null;

  return (
    <div className="fixed inset-y-0 left-0 z-40 w-96 bg-gray-950 text-gray-100 border-r border-gray-800 shadow-xl flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-100">Debug Panel</h2>
          <button
            onClick={togglePanel}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Model Selector */}
        <div className="mb-3">
          <label className="text-xs text-gray-400 block mb-1">Chat Model</label>
          <select
            value={selectedModel}
            onChange={(e) => setModel(e.target.value)}
            className="w-full bg-gray-900 text-gray-100 p-2 rounded border border-gray-700 focus:border-gray-600 focus:outline-none text-sm"
          >
            {DEBUG_CONFIG.models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} {model.isDefault && '⭐'}
              </option>
            ))}
          </select>
        </div>

        {/* Evaluator Model Selector - Only visible in test mode */}
        {isTestMode && (
          <div className="mb-3">
            <label className="text-xs text-gray-400 block mb-1">Evaluator Model (QA)</label>
            <select
              value={evaluatorModel}
              onChange={(e) => setEvaluatorModel(e.target.value)}
              className="w-full bg-gray-900 text-gray-100 p-2 rounded border border-gray-700 focus:border-gray-600 focus:outline-none text-sm"
            >
              {DEBUG_CONFIG.models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2">
          <HoverTooltip
            side="bottom"
            content={
              <div className="space-y-1">
                <div className="font-semibold text-gray-100">Intent Classification Time</div>
                <div className="text-gray-300">Min: {(minMaxIntent.min / 1000).toFixed(2)}s</div>
                <div className="text-gray-300">Max: {(minMaxIntent.max / 1000).toFixed(2)}s</div>
              </div>
            }
          >
            <Card className="p-3 bg-gray-900 border-gray-800 cursor-help">
              <div className="text-xs text-gray-400">Avg Intent</div>
              <div className="text-sm font-bold text-yellow-400">
                {(getAverageIntentTime() / 1000).toFixed(2)}s
              </div>
            </Card>
          </HoverTooltip>

          <HoverTooltip
            side="bottom"
            content={
              <div className="space-y-1">
                <div className="font-semibold text-gray-100">Total Response Time</div>
                <div className="text-gray-300">Fastest: {(minMaxResponse.min / 1000).toFixed(2)}s</div>
                <div className="text-gray-300">Slowest: {(minMaxResponse.max / 1000).toFixed(2)}s</div>
              </div>
            }
          >
            <Card className="p-3 bg-gray-900 border-gray-800 cursor-help">
              <div className="text-xs text-gray-400">Avg Total</div>
              <div className="text-sm font-bold text-blue-400">
                {(getAverageResponseTime() / 1000).toFixed(2)}s
              </div>
            </Card>
          </HoverTooltip>

          <HoverTooltip
            side="bottom"
            content={
              <div className="space-y-1">
                <div className="font-semibold text-gray-100">Total Cost Breakdown</div>
                <div className="text-gray-300">Requests: {costBreakdown.requests}</div>
                <div className="text-gray-300">Input tokens: {costBreakdown.inputTokens.toLocaleString()}</div>
                <div className="text-gray-300">Output tokens: {costBreakdown.outputTokens.toLocaleString()}</div>
              </div>
            }
          >
            <Card className="p-3 bg-gray-900 border-gray-800 cursor-help">
              <div className="text-xs text-gray-400">Cost</div>
              <div className="text-sm font-bold text-green-400">
                ${getTotalCost().toFixed(4)}
              </div>
            </Card>
          </HoverTooltip>
        </div>
      </div>

      {/* Request History */}
      <div ref={timelineRef} className="flex-1 overflow-y-auto p-4 bg-gray-950" style={{ scrollbarColor: '#374151 #111827', scrollbarWidth: 'thin' }}>
        <div className="space-y-3">
          {reversedRequests.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              No requests yet. Start chatting!
            </div>
          ) : (
            reversedRequests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                isExpanded={isRequestExpanded(request.id)}
                onToggle={() => toggleRequestExpanded(request.id)}
                onCopy={() => handleCopyForAI(request.id)}
                getModelName={getModelName}
              />
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyAll}
            className="flex-1 bg-gray-900 border-gray-700 text-gray-200 hover:bg-gray-800 hover:text-gray-100"
          >
            <Copy className="w-3 h-3 mr-1" />
            Copy All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            className="flex-1 bg-gray-900 border-gray-700 text-gray-200 hover:bg-gray-800 hover:text-gray-100"
          >
            Clear Chat
          </Button>
        </div>
      </div>
    </div>
  );
}

// Separate RequestCard component for cleaner code
function RequestCard({
  request,
  isExpanded,
  onToggle,
  onCopy,
  getModelName,
}: {
  request: DebugRequest;
  isExpanded: boolean;
  onToggle: () => void;
  onCopy: () => void;
  getModelName: (modelId: string) => string;
}) {
  return (
    <Card
      className="p-3 cursor-pointer hover:bg-gray-800 transition-colors bg-gray-900 border-gray-800"
      onClick={onToggle}
    >
      {/* Request Header */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <div className="text-xs text-gray-400">
            {new Date(request.timestamp).toLocaleTimeString()}
          </div>
          {/* USER MESSAGE WITH TOOLTIP - 2 LINES THEN TRUNCATE */}
          <HoverTooltip
            side="bottom"
            content={
              <div className="space-y-1">
                <div className="font-semibold text-gray-100">Full Message</div>
                <div className="text-gray-300">{request.userMessage}</div>
              </div>
            }
          >
            <div className="text-sm font-medium line-clamp-2 text-gray-200 cursor-help">
              "{request.userMessage}"
            </div>
          </HoverTooltip>
        </div>
        <Badge
          variant={
            request.status === 'complete'
              ? 'default'
              : request.status === 'error'
              ? 'destructive'
              : 'secondary'
          }
          className={cn(
            "ml-2 flex items-center gap-1",
            // Remove background for loading states
            (request.status === 'classifying' || request.status === 'pending' || request.status === 'executing' || request.status === 'responding') &&
            "bg-transparent border-transparent"
          )}
        >
          {request.status === 'complete' && '✅'}
          {request.status === 'error' && '❌'}
          {request.status === 'classifying' && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
          {(request.status === 'pending' || request.status === 'executing' || request.status === 'responding') && (
            <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
          )}
          {request.status === 'complete' ? (
            `${((request.timings.totalDuration || 0) / 1000).toFixed(2)}s`
          ) : request.status === 'classifying' ? (
            ''
          ) : (
            <span className="text-gray-400">{request.status.charAt(0).toUpperCase() + request.status.slice(1)}</span>
          )}
        </Badge>
      </div>

      {/* Intent - SIMPLE YELLOW TEXT */}
      {request.intent && (
        request.intent.reasoning ? (
          <HoverTooltip
            side="right"
            allowOverflow={true}
            content={
              <div className="space-y-1">
                <div className="font-semibold text-gray-100">AI Reasoning</div>
                <div className="text-gray-300">{request.intent.reasoning}</div>
              </div>
            }
          >
            <div className="text-xs text-yellow-400 mb-2 cursor-help">
              🎯 {request.intent.detected} ({request.intent.confidence.toFixed(0)})
            </div>
          </HoverTooltip>
        ) : (
          <div className="text-xs text-yellow-400 mb-2">
            🎯 {request.intent.detected} ({request.intent.confidence.toFixed(0)})
          </div>
        )
      )}

      {/* 🆕 TEST RESULT BADGE (collapsed view) */}
      {request.testResult && (
        <div className="mb-2">
          <Badge
            variant={request.testResult.passed ? 'default' : 'destructive'}
            className="text-xs"
          >
            {request.testResult.passed ? '✅ Test Passed' : '❌ Test Failed'}
            {request.testResult.quality?.score && ` • ${request.testResult.quality.score}/100`}
          </Badge>
        </div>
      )}

      {/* Error Preview */}
      {request.error && (
        <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded mb-2">
          ❌ {request.error.message}
        </div>
      )}

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-3 space-y-2">
          {/* Response Text (ONLY for test scenario cards) */}
          {request.response?.text && request.userMessage.startsWith('📋 Test Scenario:') && (
            <div className="text-xs text-gray-300">
              <div className="text-gray-400 font-semibold mb-1">
                Details:
              </div>
              <div className="text-gray-300 whitespace-pre-wrap bg-gray-800 p-2 rounded">
                {request.response.text}
              </div>
            </div>
          )}

          {/* Timeline */}
          {request.timings.intentDuration && (
            <div className="text-xs text-gray-300">
              <div className="text-gray-400 font-semibold mb-1">
                Timeline:
              </div>
              <div className="space-y-1">
                {/* Intent Classification */}
                {request.timings.intentDuration !== undefined && (
                  <div className="text-gray-400">
                    📊 Intent: {(request.timings.intentDuration / 1000).toFixed(2)}s
                  </div>
                )}

                {/* Function Execution */}
                {request.timings.functionDuration !== undefined && (
                  <>
                    <div className="text-gray-400">
                      {request.functionCalls?.some(fn => !fn.result.success) && (
                        <span className="text-red-400">❌ </span>
                      )}
                      🔧 Functions: {(request.timings.functionDuration / 1000).toFixed(2)}s
                    </div>

                    {/* Show error inline if function failed */}
                    {request.functionCalls?.map((fn, idx) => (
                      !fn.result.success && (
                        <div key={idx} className="text-xs text-red-400 ml-4">
                          └─ {fn.name}: {fn.result.error || 'Function failed'}
                        </div>
                      )
                    ))}
                  </>
                )}

                {/* Response Generation */}
                {request.timings.responseDuration !== undefined ? (
                  <div className="text-gray-400">
                    💬 Response: {(request.timings.responseDuration / 1000).toFixed(2)}s
                  </div>
                ) : request.status === 'error' ? (
                  <div className="text-gray-500">
                    ⏭️ Response: skipped
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* 🆕 TEST RESULTS DETAILS (expanded view) */}
          {request.testResult && (
            <div className="text-xs text-gray-300">
              <div className="text-gray-400 font-semibold mb-1">
                Test Results:
              </div>
              <div className="space-y-1">
                {/* Overall Pass/Fail */}
                <div className={request.testResult.passed ? 'text-green-400' : 'text-red-400'}>
                  {request.testResult.passed ? '✅ Passed' : '❌ Failed'}
                </div>

                {/* Technical Checks */}
                {request.testResult.technical && (
                  <div className="ml-2 space-y-0.5">
                    <div className={request.testResult.technical.intentCorrect ? 'text-gray-400' : 'text-red-400'}>
                      {request.testResult.technical.intentCorrect ? '✓' : '✗'} Intent correct
                      {!request.testResult.technical.intentCorrect && (
                        <div className="text-xs ml-4 text-red-300">
                          Expected: {Array.isArray((request.testResult.technical as any).intentExpected)
                            ? (request.testResult.technical as any).intentExpected.join(' or ')
                            : (request.testResult.technical as any).intentExpected}
                          <br />
                          Got: {(request.testResult.technical as any).intentActual || 'none'}
                        </div>
                      )}
                    </div>
                    <div className={request.testResult.technical.confidenceOK ? 'text-gray-400' : 'text-red-400'}>
                      {request.testResult.technical.confidenceOK ? '✓' : '✗'} Confidence OK
                      {!request.testResult.technical.confidenceOK && (
                        <div className="text-xs ml-4 text-red-300">
                          Min: {(request.testResult.technical as any).minConfidence}%,
                          Got: {Math.round((request.testResult.technical as any).confidence || 0)}%
                        </div>
                      )}
                    </div>
                    <div className={request.testResult.technical.functionsCorrect ? 'text-gray-400' : 'text-red-400'}>
                      {request.testResult.technical.functionsCorrect ? '✓' : '✗'} Functions correct
                      {!request.testResult.technical.functionsCorrect && (
                        <div className="text-xs ml-4 text-red-300">
                          Expected: {((request.testResult.technical as any).functionsExpected || []).join(', ') || 'none'}
                          <br />
                          Got: {((request.testResult.technical as any).functionsActual || []).join(', ') || 'none'}
                        </div>
                      )}
                    </div>
                    {/* Performance Score (color-coded, not pass/fail) */}
                    {request.testResult.performanceScore !== undefined && (
                      <div className={
                        request.testResult.performanceScore >= 90 ? 'text-green-400' :
                        request.testResult.performanceScore >= 70 ? 'text-blue-400' :
                        request.testResult.performanceScore >= 50 ? 'text-yellow-400' : 'text-orange-400'
                      }>
                        ⚡ Performance: {request.testResult.performanceScore.toFixed(0)}/100
                        <span className="text-xs ml-2">
                          ({((request.testResult.technical as any).timeMs / 1000).toFixed(1)}s)
                        </span>
                        <span className="text-xs ml-2">
                          {request.testResult.performanceScore >= 90 ? 'Excellent' :
                           request.testResult.performanceScore >= 70 ? 'Good' :
                           request.testResult.performanceScore >= 50 ? 'Acceptable' : 'Slow'}
                        </span>
                      </div>
                    )}
                    <div className={request.testResult.technical.noErrors ? 'text-gray-400' : 'text-red-400'}>
                      {request.testResult.technical.noErrors ? '✓' : '✗'} No errors
                      {!request.testResult.technical.noErrors && (request.testResult.technical as any).error && (
                        <div className="text-xs ml-4 text-red-300">
                          {(request.testResult.technical as any).error}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Quality Evaluation */}
                {request.testResult.quality && (
                  <div className="mt-2 p-2 bg-gray-800 rounded">
                    <div className="text-gray-400 font-semibold mb-1">
                      Quality: {request.testResult.quality.score}/100
                      {request.testResult.quality.passed ? ' ✓' : ' ✗'}
                    </div>
                    <div className="text-gray-400 text-xs">
                      {request.testResult.quality.reasoning}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cost - WITH AI MODEL IN TOOLTIP */}
          {request.cost && request.cost.total > 0 && (
            <HoverTooltip
              side="right"
              allowOverflow={true}
              content={
                <div className="space-y-1">
                  <div className="font-semibold text-gray-100">Cost Breakdown</div>
                  <div className="text-gray-300">Model: {getModelName(request.model)}</div>
                  <div className="text-gray-300">Input: ${request.cost.classification?.toFixed(4) || '0.0000'}</div>
                  <div className="text-gray-300">Output: ${request.cost.response?.toFixed(4) || '0.0000'}</div>
                  <div className="text-gray-300 font-semibold">Total: ${request.cost.total.toFixed(4)}</div>
                  {request.tokens && (
                    <>
                      <div className="pt-1 border-t border-gray-600 mt-1"></div>
                      <div className="text-gray-300">Tokens: {request.tokens.total.input.toLocaleString()} in / {request.tokens.total.output.toLocaleString()} out</div>
                    </>
                  )}
                </div>
              }
            >
              <div className="text-xs text-gray-300 cursor-help">
                <div className="text-gray-400 font-semibold mb-1">
                  Cost:
                </div>
                <div className="text-green-400">
                  💰 ${request.cost.total.toFixed(4)}
                </div>
              </div>
            </HoverTooltip>
          )}

          {/* Function Calls - WITH ERROR IN TOOLTIP */}
          {request.functionCalls && request.functionCalls.length > 0 && (
            <div className="text-xs text-gray-300">
              <div className="text-gray-400 font-semibold mb-1">
                Functions:
              </div>
              {request.functionCalls.map((fn, idx) => (
                <HoverTooltip
                  key={idx}
                  side="right"
                  allowOverflow={true}
                  content={
                    <div className="space-y-1">
                      <div className="font-semibold text-gray-100">Parameters</div>
                      <pre className="text-gray-300 whitespace-pre-wrap text-xs">
                        {JSON.stringify(fn.arguments, null, 2)}
                      </pre>
                      {fn.duration && (
                        <div className="pt-1 border-t border-gray-600 mt-1 text-gray-300">
                          Duration: {(fn.duration / 1000).toFixed(2)}s
                        </div>
                      )}
                      {/* ERROR MESSAGE IN TOOLTIP */}
                      {!fn.result.success && fn.result.error && (
                        <div className="pt-1 border-t border-gray-600 mt-1 text-red-300">
                          <div className="font-semibold">Error:</div>
                          <div>{fn.result.error}</div>
                        </div>
                      )}
                    </div>
                  }
                >
                  <div className="mb-1 cursor-help">
                    {fn.result.success ? '✅' : '❌'} {fn.name}
                  </div>
                </HoverTooltip>
              ))}
            </div>
          )}

          {/* Actions - ONLY SHOW WHEN COMPLETE */}
          {request.status === 'complete' && (
            <div className="flex gap-1.5 pt-2">
              {/* Copy button */}
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-7 bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700 hover:text-gray-100 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy();
                }}
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>

              {/* Chat Completion Logs - Always show */}
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-7 bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700 hover:text-gray-100 text-xs"
                asChild
              >
                <a
                  href={generateSupabaseLogLink(request.id, request.timestamp, 'chat-completion')}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Chat
                </a>
              </Button>

              {/* Google Sheet Logs - Only if sheets functions used */}
              {request.functionCalls?.some(fn =>
                ['get_products', 'get_services', 'check_availability', 'create_booking', 'get_store_info', 'get_misc_data'].includes(fn.name)
              ) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-7 bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700 hover:text-gray-100 text-xs"
                  asChild
                >
                  <a
                    href={generateSupabaseLogLink(request.id, request.timestamp, 'google-sheet')}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Sheet
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
