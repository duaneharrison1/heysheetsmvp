import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { H1, Lead } from '@/components/ui/heading';
import { toast } from 'sonner';
import { Loader2, CreditCard, Zap, Trash, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const Billing = () => {
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadPaymentMethods(), loadSubscription(), loadInvoices()]);
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentMethods = async () => {
    setMethodsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // First try edge function (when Stripe is integrated)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payment-methods`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setPaymentMethods(data?.methods || []);
            return;
          }
        }
      } catch (err) {
        console.log('Edge function not available, falling back to Supabase table');
      }

      // Fallback: Read from Supabase table directly
      const { data, error } = await supabase
        .from('billing_payment_methods')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });

      if (error) throw error;
      setPaymentMethods(data || []);
    } catch (err: any) {
      console.error('Failed to load payment methods', err);
      toast.error('Failed to load payment methods');
    } finally {
      setMethodsLoading(false);
    }
  };

  const loadSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // First try edge function (when Stripe is integrated)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setSubscription(data?.subscription || null);
            return;
          }
        }
      } catch (err) {
        console.log('Edge function not available, falling back to Supabase table');
      }

      // Fallback: Read from Supabase table directly
      const { data, error } = await supabase
        .from('billing_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      setSubscription(data || null);
    } catch (err) {
      console.error('Failed to load subscription', err);
    }
  };

  const loadInvoices = async () => {
    setInvoicesLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // First try edge function (when Stripe is integrated)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invoices`, {
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setInvoices(data?.invoices || []);
            return;
          }
        }
      } catch (err) {
        console.log('Edge function not available, falling back to Supabase table');
      }

      // Fallback: Read from Supabase table directly
      const { data, error } = await supabase
        .from('billing_invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('invoice_date', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      console.error('Failed to load invoices', err);
    } finally {
      setInvoicesLoading(false);
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
      toast.error(err?.message ?? 'Failed to open billing portal');
      } finally {
      setPortalLoading(false);
    }
  };

  const cancelSubscription = async () => {
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
      toast.success('Subscription canceled.');
      setCancelDialogOpen(false);
      setSubscription(null);
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not cancel subscription');
    } finally {
      setPortalLoading(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'past_due': return 'destructive';
      case 'paused': return 'secondary';
      case 'canceled': return 'outline';
      case 'paid': return 'default';
      case 'open': return 'secondary';
      default: return 'outline';
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Subscription Plan</CardTitle>
                  <CardDescription>View or modify your current plan</CardDescription>
                </div>
              </div>
              {subscription && (
                <Badge variant={getStatusBadgeColor(subscription.status)}>
                  {subscription.status?.charAt(0).toUpperCase() + subscription.status?.slice(1)}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : subscription ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">Plan</div>
                    <div className="font-semibold text-lg">{subscription.product_name || subscription.price_id || 'Plan'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">Billing Cycle</div>
                    <div className="font-semibold text-lg">{subscription.billing_cycle === 'monthly' ? 'Monthly' : 'Yearly'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">Amount</div>
                    <div className="font-semibold text-lg">${subscription.amount_usd?.toFixed(2) || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">Renews on</div>
                    <div className="font-semibold">{subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toLocaleDateString() : '—'}</div>
                  </div>
                </div>
                {subscription.cancel_at && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      This subscription will be canceled on {new Date(subscription.cancel_at * 1000).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="text-sm text-muted-foreground mb-2">You don't have an active subscription</div>
                <p className="text-xs text-muted-foreground">Subscribe to unlock premium features and access more stores.</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            {subscription ? (
              <>
                <Button onClick={openPortal} disabled={portalLoading} variant="outline">
                  {portalLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Change plan'}
                </Button>
                <Button variant="destructive" onClick={() => setCancelDialogOpen(true)} disabled={portalLoading}>
                  Cancel subscription
                </Button>
              </>
            ) : (
              <Button onClick={openPortal} disabled={portalLoading}>
                {portalLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Subscribe Now'}
              </Button>
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
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>Manage your saved payment methods</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {methodsLoading ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : paymentMethods.length === 0 ? (
              <div className="text-center py-6">
                <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                <div className="text-sm text-muted-foreground">No payment methods on file.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map((m) => (
                  <div key={m.id} className="flex items-center justify-between border rounded-lg p-4 hover:bg-muted/50 transition">
                    <div className="flex items-center gap-4 flex-1">
                      <CreditCard className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1">
                        <div className="font-semibold">{m.brand?.toUpperCase()} •••• {m.last4}</div>
                        <div className="text-xs text-muted-foreground">Expires {m.exp_month}/{m.exp_year}</div>
                      </div>
                      {m.is_default && (
                        <Badge variant="default" className="ml-auto">Default</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button onClick={openPortal} disabled={portalLoading} variant="outline">
              {portalLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Manage billing'}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>View your recent invoices and receipts</CardDescription>
          </CardHeader>
          <CardContent>
            {invoicesLoading ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-sm text-muted-foreground">No invoices found.</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 px-0 font-semibold text-xs text-muted-foreground">Date</th>
                      <th className="text-left py-2 px-4 font-semibold text-xs text-muted-foreground">Description</th>
                      <th className="text-left py-2 px-4 font-semibold text-xs text-muted-foreground">Amount</th>
                      <th className="text-left py-2 px-4 font-semibold text-xs text-muted-foreground">Status</th>
                      <th className="text-right py-2 px-0 font-semibold text-xs text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-muted/30 transition">
                        <td className="py-3 px-0 whitespace-nowrap">
                          {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate">{inv.description || 'Invoice'}</td>
                        <td className="py-3 px-4 font-medium">${inv.amount_usd?.toFixed(2) || '0.00'}</td>
                        <td className="py-3 px-4">
                          <Badge variant={getStatusBadgeColor(inv.status)}>
                            {inv.status?.charAt(0).toUpperCase() + inv.status?.slice(1)}
                          </Badge>
                        </td>
                        <td className="py-3 px-0 text-right">
                          {inv.pdf_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(inv.pdf_url, '_blank')}
                              className="h-8 w-8 p-0"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cancel Subscription Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your subscription? This action may be irreversible. You'll lose access to premium features at the end of your billing period.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={portalLoading}
            >
              Keep Subscription
            </Button>
            <Button
              variant="destructive"
              onClick={cancelSubscription}
              disabled={portalLoading}
            >
              {portalLoading ? 'Canceling...' : 'Cancel Subscription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Billing;
