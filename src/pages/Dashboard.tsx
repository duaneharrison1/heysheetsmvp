import { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { H1, Lead } from '@/components/ui/heading';
import { StoreCard } from '@/components/StoreCard';
import { toast } from '@/hooks/use-toast';
import { Plus, MessageSquare, Settings, Loader2 } from 'lucide-react';
import { UserContext } from '@/components/SidebarLayout';

const Dashboard = () => {
  const user = useContext(UserContext);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.id) {
      loadStores(user.id);
    }
  }, [user]);

  const loadStores = async (userId: string) => {
    try {
      setLoading(true);
      // cast to any to avoid strict generated DB types causing 'never' errors in editor
      const res = await supabase
        .from('stores')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }) as unknown as { data: any[] | null; error: any };

      const { data, error } = res;

      if (error) {
        console.error('Error loading stores:', error);
        toast({ title: 'Error', description: 'Failed to load stores', variant: 'destructive' });
      }

      setStores(data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const name = prompt('Store name:');
    if (!name?.trim()) return;
    try {
      setCreating(true);

      // cast insert payload/response to any to avoid generated DB types issues
      const res = await supabase
        .from('stores')
        .insert({ name: name.trim(), user_id: user.id } as any)
        .select()
        .single() as unknown as { data: any; error: any };

      const store = res.data;
      const error = res.error;

      if (error) {
        console.error('[Dashboard] Error creating store:', error);
        toast({ title: 'Error', description: `Failed to create store: ${error?.message || error}`, variant: 'destructive' });
        return;
      }

      if (store) {
        toast({ title: 'Success', description: `Store created with ID: ${store.id}` });
        await loadStores(user.id);
      }
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <H1>My Stores</H1>
        <Lead>Manage and monitor your connected stores</Lead>
      </div>

      {/* Grid with create card + existing stores. On empty, show a larger centered create card. */}
      {stores.length === 0 ? (
        <div className="flex">
          <div className="w-full max-w-2xl mx-auto">
            <StoreCard create onCreate={handleCreate} />
            <div className="mt-4 text-center text-sm text-muted-foreground">No stores yet. Create your first store to get started!</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map((store) => (
            <StoreCard key={store.id} store={store} />
          ))}
          {/* Last cell: subtle create card */}
          <StoreCard create onCreate={handleCreate} />
        </div>
      )}
    </div>
  );
};

export default Dashboard;
