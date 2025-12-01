import { useEffect, useState } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import mailjetApi from '@/lib/mailjet';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { H1, Lead } from '@/components/ui/heading';
import { Loader2 } from 'lucide-react';

const AdminEmails = () => {
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [listName, setListName] = useState<string>('');
  const [totalContacts, setTotalContacts] = useState<number>(0);
  const [subscribers, setSubscribers] = useState<number>(0);
  const [nonsubscribers, setNonsubscribers] = useState<number>(0);

  // Load contact counts from Mailjet default list
  useEffect(() => {
    if (roleLoading) return;
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadTotals = async () => {
      setLoading(true);
      setError(null);
      try {
        // Get default list info first
        const defaultListRes = await mailjetApi.getDefaultList();
        if (defaultListRes.error) {
          throw new Error(defaultListRes.error);
        }
        
        if (!cancelled && defaultListRes.name) {
          setListName(defaultListRes.name);
        }

        // Fetch all contacts with pagination
        let offset = 0;
        const limit = 1000;
        let total = 0;
        let subs = 0;
        let nonSubs = 0;

        while (true) {
          const res = await mailjetApi.listContacts(limit, offset);
          if (res.error) {
            throw new Error(res.error);
          }

          const contacts = res.contacts || [];
          for (const c of contacts) {
            total++;
            if (c.isExcludedFromCampaigns) {
              nonSubs++;
            } else {
              subs++;
            }
          }

          // Stop if we got less than limit (last page)
          if (contacts.length < limit) break;
          
          offset += limit;
          // Safety cap
          if (offset > 100000) break;
        }

        if (!cancelled) {
          setTotalContacts(total);
          setSubscribers(subs);
          setNonsubscribers(nonSubs);
        }
      } catch (err: any) {
        console.error('Failed to load Mailjet data:', err);
        if (!cancelled) setError(err?.message || 'Failed to load Mailjet data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadTotals();

    return () => {
      cancelled = true;
    };
  }, [roleLoading, isSuperAdmin]);

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <H1>Access Denied</H1>
          <Lead>You don't have permission to access this page</Lead>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <H1>Email Summary</H1>
        <Lead>
          {listName ? `Mailjet list: ${listName}` : 'Read-only overview of Mailjet contacts'}
        </Lead>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading…</span>
              </div>
            ) : (
              <div className="text-3xl font-bold">{totalContacts}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Subscribers</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading…</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="text-3xl font-bold">{subscribers}</div>
                <Badge variant="default">Active</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Unsubscribed</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading…</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="text-3xl font-bold">{nonsubscribers}</div>
                <Badge variant="secondary">Excluded</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminEmails;
