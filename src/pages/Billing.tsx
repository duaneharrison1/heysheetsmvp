import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { H1, Lead } from '@/components/ui/heading';
import { toast } from '@/hooks/use-toast';
import { Loader2, CreditCard, Zap, Trash } from 'lucide-react';

const Billing = () => {
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadPaymentMethods(), loadSubscription()]);
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentMethods = async () => {
    setMethodsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payment-methods`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      setPaymentMethods(data?.methods || []);
    } catch (err: any) {
      console.error('Failed to load payment methods', err);
    } finally {
      setMethodsLoading(false);
    }
  };

  const loadSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (!res.ok) return setSubscription(null);
      const data = await res.json();
      setSubscription(data?.subscription || null);
    } catch (err) {
      console.error('Failed to load subscription', err);
    }
  };

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ return_url: window.location.href }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not open portal');
      window.location.href = data.url;
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message ?? 'Failed to open billing portal', variant: 'destructive' });
    } finally {
      setPortalLoading(false);
    }
  };

  const cancelSubscription = async () => {
    if (!window.confirm('Cancel subscription? This action may be irreversible.')) return;
    setPortalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Cancel failed');
      toast({ title: 'Canceled', description: 'Subscription canceled.' });
      setSubscription(null);
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message ?? 'Could not cancel subscription', variant: 'destructive' });
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <H1>Billing</H1>
        <Lead>Manage payment methods and your subscription</Lead>
      </div>

      <div className="max-w-3xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Subscription</CardTitle>
                <CardDescription>View or modify your current plan</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : subscription ? (
              <div className="grid gap-2">
                <div className="text-sm">Plan: <span className="font-medium">{subscription.product_name || subscription.price_id}</span></div>
                <div className="text-sm text-muted-foreground">Status: {subscription.status}</div>
                <div className="text-sm text-muted-foreground">Renews: {subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toLocaleDateString() : '—'}</div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No active subscription</div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            {subscription ? (
              <>
                <Button onClick={openPortal} disabled={portalLoading}>{portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Change plan'}</Button>
                <Button variant="destructive" onClick={cancelSubscription} disabled={portalLoading}>{portalLoading ? 'Working...' : 'Cancel subscription'}</Button>
              </>
            ) : (
              <Button onClick={openPortal} disabled={portalLoading}>{portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Subscribe'}</Button>
            )}
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Payment methods</CardTitle>
                <CardDescription>Manage your saved payment methods</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {methodsLoading ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : paymentMethods.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">No payment methods on file.</div>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map((m) => (
                  <div key={m.id} className="flex items-center justify-between border rounded p-3">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{m.brand?.toUpperCase()} •••• {m.last4}</div>
                        <div className="text-xs text-muted-foreground">Expires {m.exp_month}/{m.exp_year}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" onClick={() => { /* future: set default */ }}>Make default</Button>
                      <Button variant="outline" onClick={() => { /* future: remove method */ }}><Trash className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button onClick={openPortal} disabled={portalLoading}>{portalLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Manage billing</> : 'Manage billing'}</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Billing;
