import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { H1, Lead } from '@/components/ui/heading';
import { StoreCard } from '@/components/StoreCard';
import { toast } from 'sonner';
import { Plus, MessageSquare, Settings, Loader2 } from 'lucide-react';
import { UserContext, StoresContext } from '@/components/SidebarLayout';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const Dashboard = () => {
  const user = useContext(UserContext);
  // Use stores from context (already fetched by SidebarLayout, cached via TanStack Query)
  const { stores, isLoading: loading, refetch: reloadStores } = useContext(StoresContext);
  const [creating, setCreating] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [storeName, setStoreName] = useState('');
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!storeName.trim()) {
      toast.error('Please enter a store name');
      return;
    }

    try {
      setCreating(true);

      // cast insert payload/response to any to avoid generated DB types issues
      const res = await supabase
        .from('stores')
        .insert({ name: storeName.trim(), user_id: user.id } as any)
        .select()
        .single() as unknown as { data: any; error: any };

      const store = res.data;
      const error = res.error;

      if (error) {
        console.error('[Dashboard] Error creating store:', error);
        toast.error(`Failed to create store: ${error?.message || error}`);
        return;
      }

      if (store) {
        toast.success(`Store created`);
        setOpenDialog(false);
        setStoreName('');
        await reloadStores();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setOpenDialog(open);
    if (!open) {
      setStoreName('');
    }
  };

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <H1>My Stores</H1>
        <Lead>Manage and monitor your connected stores</Lead>
      </div>

      <Dialog open={openDialog} onOpenChange={handleDialogOpenChange}>
        {/* Grid with create card + existing stores. On empty, show a larger centered create card. */}
        {stores.length === 0 ? (
          <div className="flex">
            <div className="w-full max-w-2xl mx-auto">
              <StoreCard create onCreate={() => setOpenDialog(true)} />
              <div className="mt-4 text-center text-sm text-muted-foreground">No stores yet. Create your first store to get started!</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
            {/* Last cell: subtle create card */}
            <StoreCard create onCreate={() => setOpenDialog(true)} />
          </div>
        )}

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Store</DialogTitle>
            <DialogDescription>
              Enter a name for your store. You can set up more details and connect a Google Sheet later.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Store name..."
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !creating) {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              disabled={creating}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenDialog(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !storeName.trim()}>
              {creating ? 'Creating...' : 'Create Store'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
