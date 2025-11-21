import { useDebugStore } from '@/stores/useDebugStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { HoverTooltip } from './HoverTooltip';
import { ExternalLink, Copy, X, Loader2 } from 'lucide-react';
import { generateSupabaseLogLink } from '@/lib/debug/correlation-id';
import { formatRequestForAI } from '@/lib/debug/format-for-ai';
import { DEBUG_CONFIG } from '@/config/debug';
import { toast } from 'sonner';

export function DebugPanel() {
  const {
    isPanelOpen,
    togglePanel,
    requests,
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
  } = useDebugStore();

  const handleCopyForAI = (requestId: string) => {
    const request = requests.find((r) => r.id === requestId);
    if (!request) return;

    const formatted = formatRequestForAI(request);
    navigator.clipboard.writeText(formatted);
    toast.success('Copied to clipboard!');
  };

  const handleCopyAll = () => {
    if (requests.length === 0) {
      toast.error('No requests to copy');
      return;
    }

    const allFormatted = requests
      .map((req, idx) => `=== REQUEST ${idx + 1}/${requests.length} ===\n\n${formatRequestForAI(req)}`)
      .join('\n\n' + '='.repeat(80) + '\n\n');

    const header = `DEBUG SESSION EXPORT\nTotal Requests: ${requests.length}\nTotal Cost: $${getTotalCost().toFixed(4)}\nExported: ${new Date().toISOString()}\n\n${'='.repeat(80)}\n\n`;

    navigator.clipboard.writeText(header + allFormatted);
    toast.success(`Copied ${requests.length} requests to clipboard!`);
  };

  const minMaxResponse = getMinMaxResponseTime();
  const minMaxIntent = getMinMaxIntentTime();
  const costBreakdown = getCostBreakdown();

  // Get model name for display
  const getModelName = (modelId: string) => {
    const model = DEBUG_CONFIG.models.find(m => m.id === modelId);
    return model?.name || modelId;
  };

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

        {/* Model Selector - MOVED TO TOP */}
        <div className="mb-3">
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

        {/* Quick Stats - NO DIVIDER ABOVE */}
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
      <div className="flex-1 overflow-y-auto p-4 bg-gray-950" style={{ scrollbarColor: '#374151 #111827', scrollbarWidth: 'thin' }}>
        <div className="space-y-3">
          {requests.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              No requests yet. Start chatting!
            </div>
          ) : (
                requests.map((request) => (
                  <Card
                    key={request.id}
                    className="p-3 cursor-pointer hover:bg-gray-800 transition-colors bg-gray-900 border-gray-800"
                    onClick={() => toggleRequestExpanded(request.id)}
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
                        className="ml-2 flex items-center gap-1"
                      >
                        {request.status === 'complete' && '✅'}
                        {request.status === 'error' && '❌'}
                        {/* CLASSIFYING STATE - ONLY SPINNER */}
                        {request.status === 'classifying' && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        {(request.status === 'pending' || request.status === 'executing' || request.status === 'responding') && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        {request.status === 'complete' ? (
                          `${((request.timings.totalDuration || 0) / 1000).toFixed(2)}s`
                        ) : request.status === 'classifying' ? (
                          '' // NO TEXT FOR CLASSIFYING
                        ) : (
                          request.status.charAt(0).toUpperCase() + request.status.slice(1)
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

                    {/* Error Preview */}
                    {request.error && (
                      <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded mb-2">
                        ❌ {request.error.message}
                      </div>
                    )}

                    {/* Expanded Details */}
                    {isRequestExpanded(request.id) && (
                      <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
                        {/* Timeline */}
                        {request.timings.intentDuration && (
                          <div className="text-xs text-gray-300">
                            <div className="text-gray-400 font-semibold mb-1">
                              Timeline:
                            </div>
                            <div className="space-y-0.5">
                              <div>
                                📊 Intent: {(request.timings.intentDuration / 1000).toFixed(2)}s
                              </div>
                              {request.timings.functionDuration && (
                                <div>
                                  🔧 Functions: {(request.timings.functionDuration / 1000).toFixed(2)}s
                                </div>
                              )}
                              {request.timings.responseDuration && (
                                <div>
                                  💬 Response: {(request.timings.responseDuration / 1000).toFixed(2)}s
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
                          <div className="flex flex-col gap-1.5 pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full h-7 bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700 hover:text-gray-100 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyForAI(request.id);
                              }}
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              Copy
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full h-7 bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700 hover:text-gray-100 text-xs"
                              asChild
                              onClick={(e) => e.stopPropagation()}
                            >
                              <a
                                href={generateSupabaseLogLink(request.id, request.timestamp)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                Logs
                              </a>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
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
            onClick={clearHistory}
            className="flex-1 bg-gray-900 border-gray-700 text-gray-200 hover:bg-gray-800 hover:text-gray-100"
          >
            Clear History
          </Button>
        </div>
      </div>
    </div>
  );
}
