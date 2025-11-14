import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { FileText, ExternalLink, Copy, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { GOOGLE_SHEETS, extractSheetId, buildSheetsEditUrl } from '@/config/constants';

const StoreSetup = ({ storeId, onComplete }: { storeId: string; onComplete?: (config: any) => void }) => {
  const [sheetUrl, setSheetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [existingSheet, setExistingSheet] = useState<any>(null);
  const [isChangingSheet, setIsChangingSheet] = useState(false);

  // Store URL for chatbot
  const storeUrl = `${window.location.origin}/store/${storeId}`;

  // Load existing sheet connection on mount
  useEffect(() => {
    const loadStore = async () => {
      setInitialLoading(true);
      try {
        const res = await supabase
          .from('stores')
          .select('sheet_id, detected_tabs, system_prompt')
          .eq('id', storeId)
          .single() as unknown as { data: any; error: any };

        const { data, error } = res;

        if (!error && data?.sheet_id) {
          // Parse detected_tabs if it's a JSON string
          let tabs = [];
          if (data.detected_tabs) {
            try {
              tabs = typeof data.detected_tabs === 'string'
                ? JSON.parse(data.detected_tabs)
                : data.detected_tabs;
            } catch (e) {
              console.error('Failed to parse detected_tabs:', e);
              tabs = [];
            }
          }

          setExistingSheet({
            sheetId: data.sheet_id,
            tabs: tabs,
            systemPrompt: data.system_prompt,
          });
        }
      } catch (error) {
        console.error('Error loading store:', error);
      } finally {
        setInitialLoading(false);
      }
    };
    loadStore();
  }, [storeId, result]);

  const handleConnect = async () => {
    if (!sheetUrl.trim()) {
      toast.error('Please enter a sheet URL or ID');
      return;
    }

    // Extract sheet ID
    const extractedId = extractSheetId(sheetUrl);
    if (!extractedId) {
      toast.error('Invalid Google Sheets URL or ID format');
      return;
    }

    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError('Please sign in to connect a sheet');
        toast.error('Please sign in');
        return;
      }

      // Call edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-sheet`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            operation: 'detect',
            sheetId: extractedId,
            storeId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to connect sheet');
        toast.error(data.error || 'Failed to connect sheet');
        return;
      }

      // Success!
      setResult(data);
      toast.success('Sheet connected successfully!');

      // Reset state
      setSheetUrl('');
      setIsChangingSheet(false);

      // Call onComplete callback if provided
      onComplete?.(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      setError(message);
      toast.error('Error: ' + message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyServiceAccount = () => {
    navigator.clipboard.writeText(GOOGLE_SHEETS.SERVICE_ACCOUNT_EMAIL);
    toast.success('Email copied to clipboard!');
  };

  const handleCopySheetUrl = () => {
    if (existingSheet?.sheetId) {
      const url = buildSheetsEditUrl(existingSheet.sheetId);
      navigator.clipboard.writeText(url);
      toast.success('Sheet URL copied to clipboard!');
    }
  };

  const handleOpenSheet = () => {
    if (existingSheet?.sheetId) {
      window.open(buildSheetsEditUrl(existingSheet.sheetId), '_blank');
    }
  };

  const handleCopyStoreUrl = () => {
    navigator.clipboard.writeText(storeUrl);
    toast.success('Store URL copied to clipboard!');
  };

  const handleOpenStore = () => {
    window.open(storeUrl, '_blank');
  };

  const handleCancelChange = () => {
    setIsChangingSheet(false);
    setSheetUrl('');
    setError(null);
  };

  // Render 3-step instructions (used for both pre-connection and change sheet)
  const renderInstructions = () => (
    <>
      {/* Step 1: Duplicate Template */}
      <div className="flex items-start gap-3">
        <Badge variant="default" className="h-7 w-7 flex items-center justify-center rounded-full shrink-0">
          1
        </Badge>
        <div className="flex-1 space-y-2">
          <h3 className="font-semibold text-sm">Duplicate the Template</h3>
          <p className="text-sm text-muted-foreground">
            Start with our pre-built template that includes all the necessary tabs and structure.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(GOOGLE_SHEETS.TEMPLATE_URL, '_blank')}
            className="w-full sm:w-auto"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Template
          </Button>
        </div>
      </div>

      <Separator />

      {/* Step 2: Share with Service Account */}
      <div className="flex items-start gap-3">
        <Badge variant="default" className="h-7 w-7 flex items-center justify-center rounded-full shrink-0">
          2
        </Badge>
        <div className="flex-1 space-y-2">
          <h3 className="font-semibold text-sm">Share with Service Account</h3>
          <p className="text-sm text-muted-foreground">
            In your Google Sheet, click Share and add this email with Editor permission:
          </p>
          <div className="flex gap-2">
            <Input
              value={GOOGLE_SHEETS.SERVICE_ACCOUNT_EMAIL}
              readOnly
              className="font-mono text-xs flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyServiceAccount}
              title="Copy email"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Step 3: Enter Sheet URL */}
      <div className="flex items-start gap-3">
        <Badge variant="default" className="h-7 w-7 flex items-center justify-center rounded-full shrink-0">
          3
        </Badge>
        <div className="flex-1 space-y-2">
          <h3 className="font-semibold text-sm">Enter Sheet URL</h3>
          <p className="text-sm text-muted-foreground">
            Paste the URL or ID of your Google Sheet below:
          </p>
          <Input
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded border border-red-200">
          <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Action buttons */}
      {isChangingSheet ? (
        <div className="flex gap-2">
          <Button
            onClick={handleConnect}
            disabled={loading || !sheetUrl.trim()}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleCancelChange}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          onClick={handleConnect}
          disabled={loading || !sheetUrl.trim()}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            'Connect Sheet'
          )}
        </Button>
      )}

      {/* Success result (shown after fresh connection) */}
      {result && (
        <div className="flex items-start gap-2 p-3 bg-green-50 text-green-700 rounded border border-green-200">
          <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm flex-1">
            <p className="font-semibold">Successfully Connected!</p>
            <p className="text-green-600">Tabs: {result.tabs.join(', ')}</p>
          </div>
        </div>
      )}
    </>
  );

  // Render post-connection display
  const renderConnectedState = () => (
    <>
      {/* Connection status */}
      <div className="flex items-start gap-2 p-3 bg-green-50 text-green-700 rounded border border-green-200">
        <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div className="text-sm flex-1">
          <p className="font-semibold">Sheet Connected</p>
          <p className="text-green-600">
            ID: <code className="bg-green-100 px-1 text-xs">{existingSheet.sheetId}</code>
          </p>
          {existingSheet.tabs && existingSheet.tabs.length > 0 && (
            <p className="text-green-600 mt-1">Tabs: {existingSheet.tabs.join(', ')}</p>
          )}
        </div>
      </div>

      <Separator />

      {/* Sheet URL with actions */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm">Google Sheet URL</h3>
        <div className="flex gap-2">
          <Input
            value={buildSheetsEditUrl(existingSheet.sheetId)}
            readOnly
            className="font-mono text-xs flex-1"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleOpenSheet}
            title="Open sheet in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopySheetUrl}
            title="Copy URL"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Change sheet button */}
      <Button
        variant="outline"
        onClick={() => setIsChangingSheet(true)}
        className="w-full"
      >
        Change Sheet
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      {/* Store URL Card - Always visible */}
      <Card>
        <CardHeader>
          <CardTitle>Your Store Chatbot</CardTitle>
          <CardDescription>Share this URL with customers to start conversations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <h3 className="font-semibold text-sm">Chatbot URL</h3>
          <div className="flex gap-2">
            <Input
              value={storeUrl}
              readOnly
              className="font-mono text-sm flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleOpenStore}
              title="Open chatbot in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyStoreUrl}
              title="Copy URL"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sheet Connection Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>
                {existingSheet && !isChangingSheet ? 'Connected Sheet' : isChangingSheet ? 'Change Google Sheet' : 'Connect Google Sheet'}
              </CardTitle>
              <CardDescription>
                {existingSheet && !isChangingSheet
                  ? 'Manage your connected Google Sheet'
                  : isChangingSheet
                  ? 'Connect a different sheet to this store'
                  : 'Link your Google Sheet to this store'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {initialLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : existingSheet && !isChangingSheet ? (
            renderConnectedState()
          ) : (
            renderInstructions()
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StoreSetup;
