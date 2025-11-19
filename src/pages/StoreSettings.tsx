import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import StoreSetup from '@/components/store/StoreSetup';
import { H1, Lead } from '@/components/ui/heading';
import { supabase } from '@/lib/supabase';
import { Loader2, Trash, ToggleRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const StoreSettings = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [deleting, setDeleting] = useState(false);
  const [updatingActive, setUpdatingActive] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('stores')
          .select('*')
          .eq('id', storeId)
          .single();
        if (error) {
          console.error('Error loading store:', error);
          setStore(null);
        } else {
          setStore(data);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [storeId]);

  if (!storeId) return <div>Invalid store ID</div>;

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  if (!store) return <div className="py-8 text-center text-muted-foreground">Store not found</div>;

  return (
    <div className="space-y-6">
      <div>
        <H1>{store.name}</H1>
        <Lead>Settings &amp; integration for <span className="font-medium">{store.name}</span></Lead>
      </div>

      <div className="max-w-3xl mx-auto space-y-4">
        <StoreSetup storeId={storeId} />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
                  <ToggleRight className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Store Status</CardTitle>
                  <CardDescription>Control whether this store is active or inactive</CardDescription>
                </div>
              </div>
              <Switch
                checked={store.is_active ?? true}
                disabled={updatingActive}
                onCheckedChange={async (checked) => {
                  try {
                    setUpdatingActive(true);
                    const { error } = await supabase
                      .from('stores')
                      .update({ is_active: checked })
                      .eq('id', storeId);
                    if (error) throw error;
                    setStore({ ...store, is_active: checked });
                    toast.success(`Store is now ${checked ? 'active' : 'inactive'}.`);
                  } catch (err: any) {
                    toast.error(err?.message ?? 'Could not update store status');
                  } finally {
                    setUpdatingActive(false);
                  }
                }}
              />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {store.is_active
                ? 'This store is currently active and appears on your dashboard.'
                : 'This store is currently inactive and hidden from your dashboard.'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                <Trash className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Danger zone</CardTitle>
                <CardDescription>Permanently delete this store and all its data.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Deleting this store is irreversible. All settings, data, and associated information will be removed permanently.
            </p>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                const ok = window.confirm(`Are you sure you want to permanently delete "${store.name}"? This action cannot be undone.`);
                if (!ok) return;
                try {
                  setDeleting(true);
                  const { error } = await supabase
                    .from('stores')
                    .delete()
                    .eq('id', storeId);
                  if (error) throw error;
                  toast.success(`${store.name} has been deleted.`);
                  navigate('/dashboard');
                } catch (err: any) {
                  toast.error(err?.message ?? 'Could not delete store');
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? 'Deleting...' : 'Delete store'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default StoreSettings;
