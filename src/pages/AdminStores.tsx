import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { H1, Lead } from '@/components/ui/heading';
import { Loader2, Store } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const AdminStores = () => {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const [stores, setStores] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (roleLoading) return;
    if (!isSuperAdmin) {
      setError('Unauthorized: Super admin access required');
      setLoading(false);
      return;
    }
    
    let cancelled = false;
    
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch stores
        const { data: storesData, error: storesError } = await supabase
          .from('stores')
          .select('id, name, type, is_active, user_id, created_at')
          .order('created_at', { ascending: false })
          .limit(100);

        if (storesError && storesError.code !== 'PGRST116') {
          console.error('Stores query error:', storesError);
          throw storesError;
        }
        
        if (!cancelled) {
          setStores(storesData || []);
        }

        // Fetch users separately
        const { data: usersData, error: usersError } = await supabase
          .from('user_profiles')
          .select('id, email')
          .limit(1000);

        if (usersError) {
          console.error('Users query error:', usersError);
          throw usersError;
        }
        
        if (!cancelled) {
          setUsers(usersData || []);
        }
      } catch (err: any) {
        console.error('Failed to load data:', err);
        if (!cancelled) {
          setError(err?.message || 'Failed to load data. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    
    loadData();
    
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, roleLoading]);

  const getOwnerEmail = (userId: string) => {
    return users.find(u => u.id === userId)?.email || userId;
  };

  if (roleLoading || loading) {
    return (
      <div className="flex items-center justify-center h-96">
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
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Only super administrators can access store management.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <H1>Store Management</H1>
        <Lead>View all stores on the platform</Lead>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">All Stores</h2>
              <p className="text-sm text-muted-foreground">Total stores: {stores.length}</p>
            </div>
          </div>
        </div>

        {stores.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No stores found</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stores.map((store) => (
              <Card 
                key={store.id} 
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/stores/${store.id}`)}
              >
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg line-clamp-2">{store.name}</h3>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="outline" className="text-xs capitalize">
                          {store.type}
                        </Badge>
                        {store.is_active ? (
                          <Badge variant="default" className="text-xs">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground border-t pt-4">
                      <p><span className="font-medium">Owner:</span> {getOwnerEmail(store.user_id)}</p>
                      <p><span className="font-medium">Created:</span> {new Date(store.created_at).toLocaleDateString()}</p>
                      <p className="break-all"><span className="font-medium">ID:</span> <code className="text-xs bg-muted px-1 py-0.5 rounded">{store.id}</code></p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminStores;
