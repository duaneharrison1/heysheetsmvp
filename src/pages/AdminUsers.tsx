import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { H1, Lead } from '@/components/ui/heading';
import { Loader2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const AdminUsers = () => {
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
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
    loadUsers();
  }, [isSuperAdmin, roleLoading]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const { data: usersData, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, email, role, is_active, created_at')
        .order('created_at', { ascending: false })
        .limit(100); // Smaller limit for faster queries

      clearTimeout(timeout);

      if (usersError) {
        console.error('Supabase error:', usersError);
        throw usersError;
      }
      setUsers(usersData || []);
    } catch (err: any) {
      console.error('Failed to load users:', err);
      const message = err?.name === 'AbortError' 
        ? 'Request timed out. Try refreshing.' 
        : err?.message || 'Failed to load users. Please try again.';
      setError(message);
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
            <p className="text-sm text-muted-foreground">Only super administrators can access user management.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <H1>User Management</H1>
        <Lead>Manage all user accounts and their roles</Lead>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="max-w-5xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>All Users</CardTitle>
                <CardDescription>Total users: {users.length}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No users found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 px-0 font-semibold text-xs text-muted-foreground">Email</th>
                      <th className="text-left py-2 px-4 font-semibold text-xs text-muted-foreground">Role</th>
                      <th className="text-left py-2 px-4 font-semibold text-xs text-muted-foreground">Status</th>
                      <th className="text-left py-2 px-4 font-semibold text-xs text-muted-foreground">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-muted/30 transition">
                        <td className="py-3 px-0 font-medium">{user.email}</td>
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
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString()}
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
    </div>
  );
};

export default AdminUsers;
