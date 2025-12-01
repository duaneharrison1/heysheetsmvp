import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { User, Trash, CreditCard, Zap, Download, AlertCircle } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/styles/theme";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from 'react-router-dom';
import { H1, Lead } from '@/components/ui/heading';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

// Navigation items for secondary nav
const navItems = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'subscription', label: 'Subscription', icon: Zap },
    { id: 'payment-methods', label: 'Payment Methods', icon: CreditCard },
    { id: 'danger', label: 'Danger Zone', icon: Trash },
];

const Account = () => {
    const [user, setUser] = useState<any>(null);
    const [fullName, setFullName] = useState("");
    const [saving, setSaving] = useState(false);
    const { theme, setTheme } = useTheme();
    const [activeSection, setActiveSection] = useState('profile');

    // Billing state
    const [loading, setLoading] = useState(true);
    const [portalLoading, setPortalLoading] = useState(false);
    const [methodsLoading, setMethodsLoading] = useState(false);
    const [invoicesLoading, setInvoicesLoading] = useState(false);
    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
    const [subscription, setSubscription] = useState<any | null>(null);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

    // Handle scroll to update active section
    useEffect(() => {
        const handleScroll = () => {
            const sections = navItems.map(item => ({
                id: item.id,
                element: document.getElementById(item.id),
            }));

            for (const section of sections) {
                if (section.element) {
                    const rect = section.element.getBoundingClientRect();
                    if (rect.top <= 150 && rect.bottom >= 150) {
                        setActiveSection(section.id);
                        break;
                    }
                }
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Handle nav item click
    const scrollToSection = (sectionId: string) => {
        const element = document.getElementById(sectionId);
        if (element) {
            const offset = 100;
            const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
            window.scrollTo({
                top: elementPosition - offset,
                behavior: 'smooth',
            });
        }
    };

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
            setFullName((user?.user_metadata as any)?.full_name ?? "");
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setFullName((session?.user?.user_metadata as any)?.full_name ?? "");
        });
        return () => subscription.unsubscribe();
    }, []);

    // Load billing data
    useEffect(() => {
        loadBillingData();
    }, []);

    const loadBillingData = async () => {
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

            const { data, error } = await supabase
                .from('billing_payment_methods')
                .select('*')
                .eq('user_id', user.id)
                .order('is_default', { ascending: false });

            if (error) throw error;
            setPaymentMethods(data || []);
        } catch (err: any) {
            console.error('Failed to load payment methods', err);
        } finally {
            setMethodsLoading(false);
        }
    };

    const loadSubscription = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('billing_subscriptions')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
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
            toast({ title: 'Error', description: err?.message ?? 'Failed to open billing portal', variant: 'destructive' });
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
            toast({ title: 'Success', description: 'Subscription canceled.' });
            setCancelDialogOpen(false);
            setSubscription(null);
        } catch (err: any) {
            toast({ title: 'Error', description: err?.message ?? 'Could not cancel subscription', variant: 'destructive' });
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

    const onSave = async () => {
        try {
            setSaving(true);
            const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
            if (error) throw error;
            toast({ title: "Saved", description: "Profile updated." });
        } catch (err: any) {
            toast({ title: "Error", description: err.message ?? "Could not update profile", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const hasChanges = fullName !== ((user?.user_metadata as any)?.full_name ?? "");

    const navigate = useNavigate();
    const [deleting, setDeleting] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const handleDeleteAccount = async () => {
        try {
            setDeleting(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not signed in');

            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({}),
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result?.error || 'Deletion failed');

            toast({ title: 'Account deleted', description: 'Your account has been deleted.' });
            // Use centralized sign-out helper to keep behavior consistent
            // helper performs signOut and redirects to `/auth`.
            const { signOutAndRedirect } = await import('@/lib/auth');
            await signOutAndRedirect('/auth');
        } catch (err: any) {
            toast({ title: 'Error', description: err?.message ?? 'Could not delete account', variant: 'destructive' });
        } finally {
            setDeleting(false);
            setDeleteDialogOpen(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <H1>Settings</H1>
                <Lead>Manage your account settings and billing preferences.</Lead>
            </div>

            <div className="flex gap-8">
                {/* Secondary Navigation Panel - Fixed */}
                <aside className="hidden lg:block w-56 shrink-0">
                    <nav className="sticky top-24 space-y-1 border rounded-lg p-2">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => scrollToSection(item.id)}
                                    className={cn(
                                        'flex items-center gap-3 w-full px-3 py-2 text-sm font-medium rounded-md transition-colors',
                                        activeSection === item.id
                                            ? 'bg-secondary text-secondary-foreground'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    {item.label}
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                {/* Main Content */}
                <div className="flex-1 max-w-3xl space-y-4">
                    {/* Profile Section */}
                    <Card id="profile">
                        <CardHeader>
                            <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
                                    <User className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle>Profile</CardTitle>
                                    <CardDescription>Personal information and preferences</CardDescription>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="grid gap-4">
                            <div className="grid w-full items-center gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" value={user?.email ?? ""} disabled />
                                <p className="text-sm text-muted-foreground">Email managed by Google</p>
                            </div>

                            <div className="grid w-full items-center gap-2">
                                <Label htmlFor="fullName">Full name</Label>
                                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <Label>Theme</Label>
                                    <div className="text-sm text-muted-foreground">Switch between light and dark theme</div>
                                </div>
                                <Switch checked={theme === "dark"} onCheckedChange={(v) => setTheme(v ? "dark" : "light")} />
                            </div>
                        </CardContent>

                        <CardFooter className="flex gap-2 justify-end">
                            <Button
                                variant={hasChanges ? 'default' : 'secondary'}
                                onClick={onSave}
                                disabled={saving || !hasChanges}
                            >
                                {saving ? "Saving..." : "Save changes"}
                            </Button>
                        </CardFooter>
                    </Card>

                    {/* Subscription Section */}
                    <Card id="subscription">
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

                    {/* Payment Methods Section */}
                    <Card id="payment-methods">
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

                    {/* Payment History */}
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

                    {/* Danger Zone */}
                    <Card id="danger">
                        <CardHeader>
                            <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                                    <Trash className="h-5 w-5" />
                                </div>
                                <div>
                                    <CardTitle>Danger zone</CardTitle>
                                    <CardDescription>Permanently delete your account and all associated data.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Deleting your account is irreversible. All your stores, settings, and data will be removed. Please make sure you have exports/backups before proceeding.
                            </p>
                        </CardContent>
                        <CardFooter className="flex justify-end">
                            <Button
                                variant="destructive"
                                onClick={() => setDeleteDialogOpen(true)}
                                disabled={deleting}
                            >
                                {deleting ? 'Deleting...' : 'Delete account'}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
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

            {/* Delete Account Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Account</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to permanently delete your account? This action cannot be undone. All your stores, settings, and data will be removed permanently. Please make sure you have exports/backups before proceeding.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteDialogOpen(false)}
                            disabled={deleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteAccount}
                            disabled={deleting}
                        >
                            {deleting ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Account;
