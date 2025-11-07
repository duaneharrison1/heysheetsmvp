import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

const StoreSetup = ({ storeId, onComplete }: { storeId: string; onComplete?: (config: any) => void }) => {
  const [sheetUrl, setSheetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [existingSheet, setExistingSheet] = useState<any>(null);

  // Load existing sheet connection on mount
  useEffect(() => {
    const loadStore = async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('sheet_id, detected_tabs, system_prompt')
        .eq('id', storeId)
        .single();

      if (!error && data?.sheet_id) {
        setExistingSheet({
          sheetId: data.sheet_id,
          tabs: data.detected_tabs || [],
          systemPrompt: data.system_prompt,
        });
      }
    };
    loadStore();
  }, [storeId]);

  const handleDetect = async () => {
    setError(null);
    setResult(null);
    if (!sheetUrl.trim()) { setError('Please enter sheet URL'); return; }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError('Please sign in'); return; }

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
            sheetId: sheetUrl,
            storeId,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || 'Detection failed');
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
        return;
      }

      setResult(data);
      toast({ title: 'Success', description: 'Sheet connected!' });
      onComplete?.(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setError(msg);
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Google Sheet</CardTitle>
        <CardDescription>Link your Google Sheet to this store</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Show existing connection */}
        {existingSheet && !result && (
          <div className="flex items-start gap-2 p-3 bg-green-50 text-green-700 rounded border border-green-200">
            <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm flex-1">
              <p className="font-semibold">Sheet Connected</p>
              <p className="text-green-600">ID: <code className="bg-green-100 px-1 text-xs">{existingSheet.sheetId}</code></p>
              {existingSheet.tabs && existingSheet.tabs.length > 0 && (
                <p className="text-green-600 mt-1">Tabs: {existingSheet.tabs.join(', ')}</p>
              )}
            </div>
          </div>
        )}

        <div className="bg-blue-50 p-4 rounded text-sm">
          <p className="font-semibold mb-2">Before connecting:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Open your Google Sheet</li>
            <li>Click "Share"</li>
            <li>Add: <code className="bg-blue-100 px-1">heysheets-backend@heysheets-mvp.iam.gserviceaccount.com</code></li>
            <li>Grant "Editor" permission</li>
          </ol>
        </div>
        <Input
          placeholder="Paste Sheet URL or ID"
          value={sheetUrl}
          onChange={(e) => setSheetUrl(e.target.value)}
          disabled={loading}
        />
        <Button onClick={handleDetect} disabled={loading || !sheetUrl.trim()} className="w-full">
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Detecting...</> : existingSheet ? 'Update Sheet Connection' : 'Detect Sheet Structure'}
        </Button>
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded">
            <XCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}
        {result && (
          <div className="flex items-start gap-2 p-3 bg-green-50 text-green-700 rounded">
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold">Successfully Updated!</p>
              <p>Tabs: {result.tabs.join(', ')}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StoreSetup;
