import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Plus, MessageSquare, Settings, Loader2 } from 'lucide-react';
import AuthButton from '@/components/AuthButton';

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/auth'); return; }
    setUser(user);
    await loadStores(user.id);
  };

  const loadStores = async (userId: string) => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from('user_stores')
        .select('store_id, stores(id, name, type, logo, sheet_id, created_at)')
        .eq('user_id', userId);
      setStores(data?.map((item: any) => item.stores).filter(Boolean) || []);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const name = prompt('Store name:');
    if (!name?.trim()) return;
    try {
      setCreating(true);
      const { data: store } = await supabase
        .from('stores')
        .insert({ name: name.trim() })
        .select()
        .single();
      if (store) {
        await supabase
          .from('user_stores')
          .insert({ user_id: user.id, store_id: store.id, role: 'owner' });
        toast({ title: 'Success', description: 'Store created!' });
        await loadStores(user.id);
      }
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">My Stores</h1>
              <p className="text-sm text-gray-600">{user?.email}</p>
            </div>
            <AuthButton />
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Button onClick={handleCreate} disabled={creating} className="mb-6">
          {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Create Store
        </Button>
        {stores.length === 0 ? (
          <Card className="p-12 text-center"><p className="text-gray-500">No stores yet. Create one!</p></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store) => (
              <Card key={store.id}>
                <CardHeader>
                  <CardTitle>{store.name}</CardTitle>
                  <CardDescription>{store.sheet_id ? '✓ Sheet connected' : '⚠ No sheet'}</CardDescription>
                </CardHeader>
                <CardFooter className="flex gap-2">
                  <Button onClick={() => navigate(`/store/${store.id}`)} size="sm" className="flex-1">
                    <MessageSquare className="mr-2 h-4 w-4" />Chat
                  </Button>
                  <Button onClick={() => navigate(`/settings/${store.id}`)} variant="outline" size="sm" className="flex-1">
                    <Settings className="mr-2 h-4 w-4" />Settings
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
