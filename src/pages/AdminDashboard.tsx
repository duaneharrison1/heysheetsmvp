import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { H1, Lead } from '@/components/ui/heading';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Shield, Store, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const AdminDashboard = () => {
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
    loadData();
  }, [isSuperAdmin, roleLoading]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get session for admin queries
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Fetch all users with roles (works with RLS - users can see their own)
      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Fetch all stores (uses RLS - regular users see their own, admin can use edge function)
      // For now, fetch with normal RLS and filter
      const { data: storesData, error: storesError } = await supabase
        .from('stores')
        .select('id, name, type, is_active, user_id, created_at')
        .order('created_at', { ascending: false });

      if (storesError && storesError.code !== 'PGRST116') throw storesError;
      setStores(storesData || []);
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
      setError(err?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
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
            <p className="text-sm text-muted-foreground">Only super administrators can access the admin dashboard.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Shield className="h-8 w-8 text-blue-600" />
          <div>
            <H1>Admin Dashboard</H1>
            <Lead>Manage all stores and user accounts</Lead>
          </div>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-blue-600" />
              <div>
                <CardTitle>Total Stores</CardTitle>
                <CardDescription>All stores across the platform</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stores.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              <div>
                <CardTitle>Total Users</CardTitle>
                <CardDescription>Registered user accounts</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* All Stores */}
      <Card>
        <CardHeader>
          <CardTitle>All Stores</CardTitle>
          <CardDescription>Browse all stores on the platform</CardDescription>
        </CardHeader>
        <CardContent>
          {stores.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No stores found</p>
          ) : (
            <div className="space-y-3">
              {stores.map((store) => (
                <div key={store.id} className="border rounded-lg p-4 hover:bg-muted/50 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{store.name}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">{store.type}</Badge>
                        {store.is_active && <Badge variant="default">Active</Badge>}
                        {!store.is_active && <Badge variant="secondary">Inactive</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Owner: {users.find(u => u.id === store.user_id)?.email || store.user_id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Created: {new Date(store.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Users */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>User accounts and their roles</CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No users found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2 px-0 font-semibold text-xs text-muted-foreground">User</th>
                    <th className="text-left py-2 px-4 font-semibold text-xs text-muted-foreground">Role</th>
                    <th className="text-left py-2 px-4 font-semibold text-xs text-muted-foreground">Status</th>
                    <th className="text-left py-2 px-4 font-semibold text-xs text-muted-foreground">Stores</th>
                    <th className="text-left py-2 px-4 font-semibold text-xs text-muted-foreground">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((user) => {
                    const userStores = stores.filter(s => s.user_id === user.id).length;
                    return (
                      <tr key={user.id} className="hover:bg-muted/30 transition">
                        <td className="py-3 px-0 flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="avatar-fallback font-medium text-sm bg-primary text-primary-foreground">
                              {(user.email || '').split('@')[0].substring(0,2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="truncate">{user.email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={user.role === 'super_admin' ? 'default' : 'outline'}>
                            {user.role === 'super_admin' ? '👑 Super Admin' : 'User'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={user.is_active ? 'default' : 'destructive'}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-medium">{userStores}</td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
