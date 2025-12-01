import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import StoreSetup from '@/components/store/StoreSetup';
import CalendarSetup from './CalendarSetup';
import { H1, Lead } from '@/components/ui/heading';
import { supabase } from '@/lib/supabase';
import { Loader2, Trash, ToggleRight, MessageCircle, FileText, Calendar } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
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
  { id: 'chatbot', label: 'Chatbot', icon: MessageCircle },
  { id: 'google-sheet', label: 'Google Sheet', icon: FileText },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'status', label: 'Store Status', icon: ToggleRight },
  { id: 'danger', label: 'Danger Zone', icon: Trash },
];

const StoreSettings = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [deleting, setDeleting] = useState(false);
  const [updatingActive, setUpdatingActive] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<boolean | null>(null);
  const [activeSection, setActiveSection] = useState('chatbot');

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
      const offset = 100; // Account for header
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: 'smooth',
      });
    }
  };

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

  const handleStatusChange = async () => {
    if (pendingStatusChange === null) return;
    try {
      setUpdatingActive(true);
      const { error } = await supabase
        .from('stores')
        .update({ is_active: pendingStatusChange })
        .eq('id', storeId);
      if (error) throw error;
      setStore({ ...store, is_active: pendingStatusChange });
      toast.success(`Store is now ${pendingStatusChange ? 'active' : 'inactive'}.`);
      setStatusDialogOpen(false);
      setPendingStatusChange(null);
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not update store status');
      setPendingStatusChange(null);
    } finally {
      setUpdatingActive(false);
    }
  };

  const handleDeleteStore = async () => {
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
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <H1>{store.name}</H1>
        <Lead>Settings &amp; integration for <span className="font-medium">{store.name}</span></Lead>
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
          <StoreSetup storeId={storeId} />

          <div id="calendar">
            <CalendarSetup storeId={storeId} />
          </div>

          <Card id="status">
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
                  onCheckedChange={(checked) => {
                    setPendingStatusChange(checked);
                    setStatusDialogOpen(true);
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

          <Card id="danger">
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
                onClick={() => setDeleteDialogOpen(true)}
              >
                {deleting ? 'Deleting...' : 'Delete store'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Status Change Confirmation Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Store Status</DialogTitle>
            <DialogDescription>
              Are you sure you want to make this store {pendingStatusChange ? 'active' : 'inactive'}? 
              {!pendingStatusChange && ' It will be hidden from your dashboard.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setStatusDialogOpen(false);
                setPendingStatusChange(null);
              }}
              disabled={updatingActive}
            >
              Cancel
            </Button>
            <Button
              onClick={handleStatusChange}
              disabled={updatingActive}
            >
              {updatingActive ? 'Updating...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Store</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete "{store.name}"? This action cannot be undone. All settings, data, and associated information will be removed permanently.
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
              onClick={handleDeleteStore}
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

export default StoreSettings;
