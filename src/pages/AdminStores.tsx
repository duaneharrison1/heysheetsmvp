import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useAllStores, useStoreUsers } from '@/hooks/useStores';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { H1, Lead } from '@/components/ui/heading';
import { Loader2, Store } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const AdminStores = () => {
    const navigate = useNavigate();
    const { isSuperAdmin, loading: roleLoading } = useUserRole();
    const { data: stores = [], isLoading: storesLoading, error: storesError } = useAllStores(!roleLoading && isSuperAdmin);
    const { data: users = [] } = useStoreUsers(!roleLoading && isSuperAdmin);

    const isLoading = storesLoading || roleLoading;
    const error = storesError?.message;

    const getOwnerEmail = (userId: string) => {
        return users.find(u => u.id === userId)?.email || userId;
    };

    if (roleLoading || isLoading) {
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
