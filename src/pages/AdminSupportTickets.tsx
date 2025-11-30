import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { H1, Lead } from '@/components/ui/heading';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, LifeBuoy, Search, ChevronLeft, ChevronRight, Eye, AlertTriangle, ExternalLink, Trash } from 'lucide-react';
import { Select, SelectItem } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

interface SupportTicket {
  id: string;
  user_id: string | null;
  store_id: string | null;
  category: 'feedback' | 'bug' | 'question' | 'other';
  subject: string;
  message: string;
  contact_email: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical' | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
  // optional enrichment fields (fetched client-side)
  user_name?: string | null;
  user_email?: string | null;
  store_name?: string | null;
  store_url?: string | null;
}

const PAGE_SIZE = 20;

const PRIORITY_OPTIONS = [
  { value: '', label: 'No Priority' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const CATEGORY_LABELS: Record<string, string> = {
  feedback: 'Feedback',
  bug: 'Bug Report',
  question: 'Question',
  other: 'Other',
};

const getPriorityBadge = (priority: string | null) => {
  switch (priority) {
    case 'critical':
      return <Badge variant="destructive">Critical</Badge>;
    case 'high':
      return <Badge className="bg-orange-500 hover:bg-orange-500">High</Badge>;
    case 'medium':
      return <Badge className="bg-yellow-500 hover:bg-yellow-500 text-black">Medium</Badge>;
    case 'low':
      return <Badge variant="secondary">Low</Badge>;
    default:
      return <span className="text-xs text-muted-foreground">—</span>;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'open':
      return <Badge variant="default" className="bg-blue-600 hover:bg-blue-600">Open</Badge>;
    case 'in_progress':
      return <Badge className="bg-yellow-500 hover:bg-yellow-500 text-black">In Progress</Badge>;
    case 'resolved':
      return <Badge className="bg-green-600 hover:bg-green-600">Resolved</Badge>;
    case 'closed':
      return <Badge variant="secondary">Closed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const getCategoryBadge = (category: string) => {
  switch (category) {
    case 'bug':
      return <Badge variant="destructive">Bug</Badge>;
    case 'feedback':
      return <Badge variant="default">Feedback</Badge>;
    case 'question':
      return <Badge className="bg-purple-500 hover:bg-purple-500">Question</Badge>;
    default:
      return <Badge variant="outline">Other</Badge>;
  }
};

const AdminSupportTickets = () => {
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   
   // Filters
   const [searchQuery, setSearchQuery] = useState('');
   const [categoryFilter, setCategoryFilter] = useState<string>('all');
   const [statusFilter, setStatusFilter] = useState<string>('all');
   const [priorityFilter, setPriorityFilter] = useState<string>('all');
   
   // Pagination
   const [currentPage, setCurrentPage] = useState(1);
   const [totalCount, setTotalCount] = useState(0);

   // Modal
   const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
   const [modalOpen, setModalOpen] = useState(false);
   const [updatingField, setUpdatingField] = useState<string | null>(null);
   const [updateError, setUpdateError] = useState<string | null>(null);

   const loadStores = useCallback(async () => {
     try {
       const { data, error } = await supabase
         .from('stores')
         .select('id, name')
         .order('name', { ascending: true });

       if (error) throw error;
       setStores(data || []);
     } catch (err: any) {
       console.error('Failed to load stores:', err);
     }
   }, []);

   // Load stores once on mount
   useEffect(() => {
     if (!roleLoading && isSuperAdmin) {
       loadStores();
     }
   }, [roleLoading, isSuperAdmin, loadStores]);

   const getStoreInfo = (storeId: string) => {
     return stores.find(s => s.id === storeId);
   };

  // Load data when filters change
  useEffect(() => {
    if (roleLoading) return;
    
    if (!isSuperAdmin) {
      setError('Unauthorized: Super admin access required');
      setLoading(false);
      return;
    }
    
    let cancelled = false;
    
    const loadTickets = async () => {
      setLoading(true);
      setError(null);
    try {
      let query = supabase
        .from('support_tickets')
        .select('*', { count: 'exact' });

      // Apply category filter
      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // Apply priority filter
      if (priorityFilter !== 'all') {
        if (priorityFilter === 'none') {
          query = query.is('priority', null);
        } else {
          query = query.eq('priority', priorityFilter);
        }
      }

      // Order and paginate
      query = query
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

      const { data, error, count } = await query;

      if (error) throw error;
      const rawTickets: SupportTicket[] = data || [];

      // Enrich with user profiles when available
      const userIds = Array.from(new Set(rawTickets.map(t => t.user_id).filter(Boolean) as string[]));

      let profiles: any[] = [];
      if (userIds.length > 0) {
        const { data, error } = await supabase.from('user_profiles').select('id, email').in('id', userIds);
        if (error) {
          console.error('Failed to load profiles:', error);
        } else {
          profiles = data || [];
        }
      }

      const profileMap = new Map<string, any>();
      profiles.forEach((p: any) => profileMap.set(p.id, p));

      const enriched = rawTickets.map(t => {
         const ticket = { ...t } as SupportTicket;
         if (t.user_id) {
           const p = profileMap.get(t.user_id);
           if (p) {
             ticket.user_name = p.email || null;
             ticket.user_email = p.email || null;
           }
         }
         if (t.store_id) {
           ticket.store_url = `${window.location.origin}/store/${t.store_id}`;
         }
         return ticket;
       });

      // Only update state if not cancelled
      if (!cancelled) {
        setTickets(enriched);
        setTotalCount(count || 0);
      }
    } catch (err: any) {
      console.error('Failed to load tickets:', err);
      if (!cancelled) {
        setError(err?.message || 'Failed to load tickets');
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  };
    
    loadTickets();
    
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, roleLoading, currentPage, categoryFilter, statusFilter, priorityFilter]);

  const updateTicket = async (ticketId: string, field: 'priority' | 'status', value: string | null) => {
    setUpdateError(null);
    setUpdatingField(`${ticketId}-${field}`);
    
    try {
      const updateData = field === 'priority' 
        ? { priority: value || null }
        : { status: value };

      const { error } = await supabase
        .from('support_tickets')
        .update(updateData)
        .eq('id', ticketId);

      if (error) throw error;

      // Update local state
      setTickets(prev => prev.map(t => 
        t.id === ticketId ? { ...t, [field]: field === 'priority' ? (value || null) : value } : t
      ));
      
      setSelectedTicket(prev => {
        if (prev && prev.id === ticketId) {
          return { ...prev, [field]: field === 'priority' ? (value || null) : value };
        }
        return prev;
      });
    } catch (err: any) {
      console.error(`Failed to update ${field}:`, err);
      setUpdateError(err?.message || `Failed to update ${field}`);
    } finally {
      setUpdatingField(null);
    }
  };

  const deleteTicket = async (ticketId: string) => {
    const ok = window.confirm('Delete this ticket? This action cannot be undone.');
    if (!ok) return;
    setUpdateError(null);
    setUpdatingField(`${ticketId}-delete`);
    try {
      const { error } = await supabase.from('support_tickets').delete().eq('id', ticketId);
      if (error) throw error;

      // Remove from local state
      setTickets(prev => prev.filter(t => t.id !== ticketId));
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(null);
        setModalOpen(false);
      }
    } catch (err: any) {
      console.error('Failed to delete ticket:', err);
      setUpdateError(err?.message || 'Failed to delete ticket');
    } finally {
      setUpdatingField(null);
    }
  };

  // Client-side search filtering
  const filteredTickets = useMemo(() => {
    if (!searchQuery.trim()) return tickets;
    
    const query = searchQuery.toLowerCase();
    return tickets.filter(item => 
      item.subject.toLowerCase().includes(query) ||
      item.message.toLowerCase().includes(query) ||
      (item.contact_email && item.contact_email.toLowerCase().includes(query))
    );
  }, [tickets, searchQuery]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  const openDetailModal = (item: SupportTicket) => {
    setSelectedTicket(item);
    setUpdateError(null);
    setModalOpen(true);
  };

  const handleModalClose = (open: boolean) => {
    setModalOpen(open);
    if (!open) {
      setUpdateError(null);
    }
  };

  if (roleLoading) {
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
            <p className="text-sm text-muted-foreground">Only super administrators can access support ticket management.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <H1>Support Tickets</H1>
        <Lead>Manage user support requests and track resolution status</Lead>
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
                <LifeBuoy className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>All Tickets</CardTitle>
                <CardDescription>Total tickets: {totalCount}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search subject, message, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Category Filter */}
              <Select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  handleFilterChange();
                }}
                className="w-[120px]"
              >
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="feedback">Feedback</SelectItem>
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="question">Question</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </Select>

              {/* Status Filter */}
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  handleFilterChange();
                }}
                className="w-[130px]"
              >
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </Select>

              {/* Priority Filter */}
              <Select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  handleFilterChange();
                }}
                className="w-[120px]"
              >
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="none">No Priority</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </Select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No tickets found</p>
            ) : (
              <>
                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left py-2 px-0 font-semibold text-xs text-muted-foreground">Category</th>
                        <th className="text-left py-2 px-4 font-semibold text-xs text-muted-foreground">Subject</th>
                        <th className="text-left py-2 px-4 font-semibold text-xs text-muted-foreground">Status</th>
                        <th className="text-left py-2 px-4 font-semibold text-xs text-muted-foreground">Priority</th>
                        <th className="text-left py-2 px-4 font-semibold text-xs text-muted-foreground">Date</th>
                        <th className="text-left py-2 px-4 font-semibold text-xs text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredTickets.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/30 transition cursor-pointer" onClick={() => openDetailModal(item)}>
                          <td className="py-3 px-0">
                            {getCategoryBadge(item.category)}
                          </td>
                          <td className="py-3 px-4 max-w-[200px]">
                            <p className="font-medium truncate">{item.subject}</p>
                          </td>
                          <td className="py-3 px-4">
                            {getStatusBadge(item.status)}
                          </td>
                          <td className="py-3 px-4">
                            {getPriorityBadge(item.priority)}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); openDetailModal(item); }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="ml-2 text-red-600"
                              onClick={(e) => { e.stopPropagation(); deleteTicket(item.id); }}
                              aria-label="Delete ticket"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground px-2">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Modal */}
      <style>{`.admin-support-modal-scroll{ -ms-overflow-style:none; scrollbar-width:none; } .admin-support-modal-scroll::-webkit-scrollbar{ display: none; }`}</style>
      <Dialog open={modalOpen} onOpenChange={handleModalClose}>
        <DialogContent className="admin-support-modal-scroll max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
                <LifeBuoy className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Ticket Details</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedTicket && new Date(selectedTicket.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            {selectedTicket && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  {/* Subject */}
                  <div className="p-4 bg-muted rounded-md">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Subject</p>
                    <p className="font-medium">{selectedTicket.subject}</p>
                  </div>

                  {/* Message */}
                  <div className="p-4 bg-muted rounded-md">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Message</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedTicket.message}</p>
                  </div>
                </div>

                <aside className="space-y-4">
                  {/* Store (if available) and User details */}
                  <div className="p-4 bg-muted rounded-md">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Store</p>
                    {selectedTicket.store_id && getStoreInfo(selectedTicket.store_id) ? (
                      <div className="flex flex-col">
                        <p className="font-medium mb-0 truncate">{getStoreInfo(selectedTicket.store_id)?.name}</p>
                        <code className="text-xs text-muted-foreground bg-muted px-1 py-0.5 rounded break-all inline-flex items-center gap-2 mt-1">
                          <span className="break-all">{selectedTicket.store_id}</span>
                          {selectedTicket.store_url && (
                            <a href={selectedTicket.store_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary inline-flex items-center">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </code>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">No store associated</span>
                    )}
                  </div>

                  <div className="p-4 bg-muted rounded-md">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">User</p>
                    {selectedTicket.user_name || selectedTicket.user_email ? (
                      <div className="flex flex-col">
                        <p className="font-medium mb-0 truncate">{selectedTicket.user_name || '—'}</p>
                        {selectedTicket.user_email ? (
                          <a href={`mailto:${selectedTicket.user_email}`} className="text-sm text-primary hover:underline mt-1">{selectedTicket.user_email}</a>
                        ) : (
                          <p className="text-sm text-muted-foreground mt-1">No email provided</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">No user information</span>
                    )}
                  </div>

                  <Separator />

                  {/* Status */}
                  <div className="p-4 bg-muted rounded-md">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Status</p>
                    <div className="mb-3">{getStatusBadge(selectedTicket.status)}</div>
                    <Select
                      value={selectedTicket.status}
                      onChange={(e) => updateTicket(selectedTicket.id, 'status', e.target.value)}
                      disabled={updatingField === `${selectedTicket.id}-status`}
                      className="w-full"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </Select>
                    {updatingField === `${selectedTicket.id}-status` && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Updating...
                      </div>
                    )}
                  </div>

                  {/* Priority */}
                  <div className="p-4 bg-muted rounded-md">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Priority</p>
                    <div className="mb-3">{getPriorityBadge(selectedTicket.priority)}</div>
                    <Select
                      value={selectedTicket.priority || ''}
                      onChange={(e) => updateTicket(selectedTicket.id, 'priority', e.target.value)}
                      disabled={updatingField === `${selectedTicket.id}-priority`}
                      className="w-full"
                    >
                      {PRIORITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </Select>
                    {updatingField === `${selectedTicket.id}-priority` && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Updating...
                      </div>
                    )}
                  </div>

                  {updateError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-md text-xs text-red-600">
                      <AlertTriangle className="h-3 w-3" />
                      {updateError}
                    </div>
                  )}
                  <div className="p-4 bg-muted rounded-md">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Actions</p>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="destructive"
                        onClick={() => deleteTicket(selectedTicket.id)}
                        disabled={updatingField === `${selectedTicket?.id}-delete`}
                        className="w-full"
                      >
                        {updatingField === `${selectedTicket?.id}-delete` ? (
                          <span>Deleting...</span>
                        ) : (
                          <>
                            <Trash className="h-4 w-4 mr-2" />
                            <span>Delete Ticket</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </aside>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSupportTickets;