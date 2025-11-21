import { useDebugStore } from '@/stores/useDebugStore';
import type { DebugRequest, DebugStep } from '@/stores/useDebugStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { HoverTooltip } from './HoverTooltip';
import { ExternalLink, Copy, X, Loader2, ArrowDown } from 'lucide-react';
import { generateSupabaseLogLink } from '@/lib/debug/correlation-id';
import { formatRequestForAI } from '@/lib/debug/format-for-ai';
import { DEBUG_CONFIG } from '@/config/debug';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

        {/* Model Selector */}
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
      <div className="flex-1 overflow-y-auto p-4 bg-gray-950" style={{ scrollbarColor: '#374151 #111827', scrollbarWidth: 'thin' }}>
        <div className="space-y-3">
          {requests.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              No requests yet. Start chatting!
            </div>
          ) : (
            requests.map((request) => (
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
  // Find which step failed
  const errorStep = request.steps?.find((s) => s.status === 'error');

  return (
    <Card className="p-3 bg-gray-900 border-gray-800">
      {/* Collapsed view */}
      <div className="cursor-pointer" onClick={onToggle}>
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <div className="text-xs text-gray-400">
              {new Date(request.timestamp).toLocaleTimeString()}
            </div>
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

        {errorStep && (
          <div className="text-xs text-red-400 mb-1">
            Error in: {errorStep.name}
          </div>
        )}
      </div>

      {/* Expanded view with steps */}
      {isExpanded && request.steps && request.steps.length > 0 && (
        <div className="mt-3 space-y-2">
          {request.steps.map((step, idx) => (
            <div key={idx}>
              {/* Step card */}
              <div
                className={cn(
                  'border rounded p-3',
                  step.status === 'success' && 'border-green-800 bg-green-900/10',
                  step.status === 'error' && 'border-red-800 bg-red-900/10',
                  step.status === 'skipped' && 'border-gray-700 bg-gray-800/10'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {step.status === 'success' && <span className="text-green-400">✅</span>}
                    {step.status === 'error' && <span className="text-red-400">❌</span>}
                    {step.status === 'skipped' && <span className="text-gray-400">⏸️</span>}
                    <span className="font-medium text-sm">
                      Step {idx + 1}: {step.name}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {step.duration ? `${step.duration.toFixed(0)}ms` : '-'}
                  </span>
                </div>

                <div className="text-xs text-gray-400 mb-2">
                  Function: <code className="text-blue-400">{step.function}</code>
                </div>

                {/* Success result */}
                {step.status === 'success' && step.result && (
                  <div className="text-xs">
                    {step.name === 'Intent Classification' && step.result.intent && (
                      <div>
                        Intent: <span className="text-yellow-400">{step.result.intent}</span>
                        {step.result.confidence && ` (${(step.result.confidence * 100).toFixed(0)}%)`}
                      </div>
                    )}
                    {step.functionCalled && (
                      <div>
                        Called: <code className="text-blue-400">{step.functionCalled}</code>
                      </div>
                    )}
                    {step.result.length !== undefined && (
                      <div>Generated {step.result.length} characters</div>
                    )}
                  </div>
                )}

                {/* Error details */}
                {step.status === 'error' && step.error && (
                  <div className="mt-2 p-2 bg-red-900/20 rounded">
                    <div className="text-xs text-red-400 font-medium">Error: {step.error.message}</div>
                    {step.error.args && (
                      <div className="text-xs text-gray-400 mt-1">
                        Args: <pre className="inline">{JSON.stringify(step.error.args, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Skipped reason */}
                {step.status === 'skipped' && (
                  <div className="text-xs text-gray-400">Skipped due to error in previous step</div>
                )}

                {/* Log link */}
                <div className="mt-2">
                  <a
                    href={generateSupabaseLogLink(request.id, request.timestamp, step.function)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3" />
                    View {step.function} logs
                  </a>
                </div>
              </div>

              {/* Arrow between steps */}
              {idx < request.steps.length - 1 && (
                <div className="flex justify-center py-1">
                  <ArrowDown className="w-4 h-4 text-gray-600" />
                </div>
              )}
            </div>
          ))}

          {/* Actions at bottom */}
          {request.status === 'complete' && (
            <div className="flex flex-col gap-1.5 mt-4 pt-4 border-t border-gray-700">
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700 hover:text-gray-100 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy();
                }}
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy for AI
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700 hover:text-gray-100 text-xs"
                asChild
                onClick={(e) => e.stopPropagation()}
              >
                <a
                  href={generateSupabaseLogLink(request.id, request.timestamp, 'chat-completion')}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  All Functions
                </a>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Fallback to old view if no steps */}
      {isExpanded && (!request.steps || request.steps.length === 0) && (
        <div className="mt-3 space-y-2">
          {/* Show old format */}
          {request.intent && (
            <div className="text-xs text-yellow-400 mb-2 cursor-help">
              🎯 {request.intent.detected} ({request.intent.confidence.toFixed(0)})
            </div>
          )}

          {request.status === 'complete' && (
            <div className="flex flex-col gap-1.5 pt-2">
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700 hover:text-gray-100 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy();
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
  );
}
