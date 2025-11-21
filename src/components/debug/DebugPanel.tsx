import { useState } from 'react';
import { useDebugStore } from '@/stores/useDebugStore';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { ExternalLink, Copy, X } from 'lucide-react';
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
    getAverageTTFT,
    getTotalCost,
    clearHistory,
  } = useDebugStore();

  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);

  const handleCopyForAI = (requestId: string) => {
    const request = requests.find((r) => r.id === requestId);
    if (!request) return;

    const formatted = formatRequestForAI(request);
    navigator.clipboard.writeText(formatted);
    toast.success('Copied to clipboard!');
  };

  const filteredRequests = requests.filter((r) => r.status !== 'pending');

  return (
    <Sheet open={isPanelOpen} onOpenChange={togglePanel}>
      <SheetContent side="left" className="w-96 p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-semibold">🐛 Debug Panel</SheetTitle>
              <Button variant="ghost" size="icon" onClick={togglePanel}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Avg TTFT</div>
                <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                  {getAverageTTFT()}ms
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-xs text-muted-foreground">Total Cost</div>
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  ${getTotalCost().toFixed(4)}
                </div>
              </Card>
            </div>
          </SheetHeader>

          {/* Model Selector */}
          <div className="p-4 border-b">
            <label className="text-sm text-muted-foreground mb-2 block">AI Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-background text-foreground p-2 rounded border border-input"
            >
              {DEBUG_CONFIG.models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} {model.isDefault && '⭐'}
                </option>
              ))}
            </select>
            <div className="text-xs text-muted-foreground mt-1">
              Affects all future messages
            </div>
          </div>

          {/* Request History */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {filteredRequests.length === 0 ? (
                <div className="text-center text-muted-foreground mt-8">
                  No requests yet. Start chatting!
                </div>
              ) : (
                filteredRequests.map((request) => (
                  <Card
                    key={request.id}
                    className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() =>
                      setExpandedRequest(expandedRequest === request.id ? null : request.id)
                    }
                  >
                    {/* Request Header */}
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">
                          {new Date(request.timestamp).toLocaleTimeString()}
                        </div>
                        <div className="text-sm font-medium line-clamp-1">
                          "{request.userMessage}"
                        </div>
                      </div>
                      <Badge
                        variant={
                          request.status === 'complete'
                            ? 'default'
                            : request.status === 'error'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="ml-2"
                      >
                        {request.status === 'complete' && '✅'}
                        {request.status === 'error' && '❌'}
                        {request.timings.totalDuration?.toFixed(0)}ms
                      </Badge>
                    </div>

                    {/* Intent */}
                    {request.intent && (
                      <div className="text-xs text-yellow-600 dark:text-yellow-400 mb-2">
                        🎯 {request.intent.detected} ({request.intent.confidence.toFixed(2)})
                      </div>
                    )}

                    {/* Error Preview */}
                    {request.error && (
                      <div className="text-xs text-destructive bg-destructive/10 p-2 rounded mb-2">
                        ❌ {request.error.message}
                      </div>
                    )}

                    {/* Expanded Details */}
                    {expandedRequest === request.id && (
                      <div className="mt-3 pt-3 border-t space-y-2">
                        {/* Timeline */}
                        {request.timings.intentDuration && (
                          <div className="text-xs">
                            <div className="text-muted-foreground font-semibold mb-1">
                              Timeline:
                            </div>
                            <div className="space-y-0.5">
                              <div>
                                📊 Intent: {request.timings.intentDuration.toFixed(0)}ms
                              </div>
                              {request.timings.functionDuration && (
                                <div>
                                  🔧 Functions: {request.timings.functionDuration.toFixed(0)}ms
                                </div>
                              )}
                              {request.timings.responseDuration && (
                                <div>
                                  💬 Response: {request.timings.responseDuration.toFixed(0)}ms
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Function Calls */}
                        {request.functionCalls && request.functionCalls.length > 0 && (
                          <div className="text-xs">
                            <div className="text-muted-foreground font-semibold mb-1">
                              Functions:
                            </div>
                            {request.functionCalls.map((fn, idx) => (
                              <div key={idx} className="mb-1">
                                {fn.result.success ? '✅' : '❌'} {fn.name}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
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
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t">
            <Button variant="outline" size="sm" onClick={clearHistory} className="w-full">
              Clear History
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
