import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { H1, Lead } from '@/components/ui/heading';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, MessageSquare, ThumbsUp, ThumbsDown, Search, ChevronLeft, ChevronRight, Eye, AlertTriangle, ExternalLink, Trash } from 'lucide-react';
import { Select, SelectItem } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface FeedbackItem {
  id: string;
  store_id: string;
  store_url: string | null;
  message_id: string;
  message_content: string;
  feedback_type: 'like' | 'dislike';
  conversation_history: Array<{ role: string; content: string }> | null;
  priority: 'low' | 'medium' | 'high' | 'critical' | null;
  created_at: string;
}

const PAGE_SIZE = 20;

const PRIORITY_OPTIONS = [
  { value: '', label: 'No Priority' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

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

const AdminFeedback = () => {
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackFilter, setFeedbackFilter] = useState<'all' | 'like' | 'dislike'>('all');
  const [storeFilter, setStoreFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState<string | null>(null); // Track which item is being updated
  const [priorityError, setPriorityError] = useState<string | null>(null);

  // Load stores once on mount
  useEffect(() => {
    if (!roleLoading && isSuperAdmin) {
      loadStores();
    }
  }, [roleLoading, isSuperAdmin]);

  // Load feedback when filters change
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
        let query = supabase
          .from('chat_feedback')
          .select('*', { count: 'exact' });

        if (feedbackFilter !== 'all') {
          query = query.eq('feedback_type', feedbackFilter);
        }
        if (storeFilter !== 'all') {
          query = query.eq('store_id', storeFilter);
        }
        if (priorityFilter !== 'all') {
          if (priorityFilter === 'none') {
            query = query.is('priority', null);
          } else {
            query = query.eq('priority', priorityFilter);
          }
        }

        query = query
          .order('created_at', { ascending: false })
          .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

        const { data, error, count } = await query;

        if (error) throw error;
        
        if (!cancelled) {
          setFeedback(data || []);
          setTotalCount(count || 0);
        }
      } catch (err: any) {
        console.error('Failed to load feedback:', err);
        if (!cancelled) {
          setError(err?.message || 'Failed to load feedback');
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
  }, [isSuperAdmin, roleLoading, currentPage, feedbackFilter, storeFilter, priorityFilter]);

  const loadStores = async () => {
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
  };

  const updatePriority = async (feedbackId: string, priority: string | null) => {
    // Clear any previous error
    setPriorityError(null);
    setUpdatingPriority(feedbackId);
    
    try {
      const { error } = await supabase
        .from('chat_feedback')
        .update({ priority: priority || null })
        .eq('id', feedbackId);

      if (error) throw error;

      // Update local state immutably
      const newPriority = (priority || null) as FeedbackItem['priority'];
      
      setFeedback(prev => prev.map(f => 
        f.id === feedbackId ? { ...f, priority: newPriority } : f
      ));
      
      // Update selected feedback if it matches
      setSelectedFeedback(prev => {
        if (prev && prev.id === feedbackId) {
          return { ...prev, priority: newPriority };
        }
        return prev;
      });
    } catch (err: any) {
      console.error('Failed to update priority:', err);
      setPriorityError(err?.message || 'Failed to update priority');
    } finally {
      setUpdatingPriority(null);
    }
  };

  const deleteFeedback = async (feedbackId: string) => {
    const ok = window.confirm('Delete this feedback entry? This action cannot be undone.');
    if (!ok) return;
    // reuse priorityError for UI errors for simplicity
    setPriorityError(null);
    setUpdatingPriority(feedbackId);
    try {
      const { error } = await supabase.from('chat_feedback').delete().eq('id', feedbackId);
      if (error) throw error;

      setFeedback(prev => prev.filter(f => f.id !== feedbackId));
      if (selectedFeedback?.id === feedbackId) {
        setSelectedFeedback(null);
        setModalOpen(false);
      }
    } catch (err: any) {
      console.error('Failed to delete feedback:', err);
      setPriorityError(err?.message || 'Failed to delete feedback');
    } finally {
      setUpdatingPriority(null);
    }
  };

  // Client-side search filtering (semantic search across store_id and message_content)
  const filteredFeedback = useMemo(() => {
    if (!searchQuery.trim()) return feedback;
    
    const query = searchQuery.toLowerCase();
    return feedback.filter(item => 
      item.store_id.toLowerCase().includes(query) ||
      item.message_content.toLowerCase().includes(query) ||
      (item.store_url && item.store_url.toLowerCase().includes(query))
    );
  }, [feedback, searchQuery]);

  const getStoreName = (storeId: string) => {
    return stores.find(s => s.id === storeId)?.name || storeId;
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleFilterChange = () => {
    setCurrentPage(1); // Reset to first page when filters change
  };

  const openDetailModal = (item: FeedbackItem) => {
    setSelectedFeedback(item);
    setPriorityError(null); // Clear any previous errors when opening modal
    setModalOpen(true);
  };

  const handleModalClose = (open: boolean) => {
    setModalOpen(open);
    if (!open) {
      // Clear error state when modal closes
      setPriorityError(null);
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
            <p className="text-sm text-muted-foreground">Only super administrators can access feedback management.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <H1>Chat Feedback</H1>
        <Lead>Review user feedback on AI responses for quality improvement</Lead>
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
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>All Feedback</CardTitle>
                <CardDescription>Total feedback: {totalCount}</CardDescription>
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
                  placeholder="Search store ID or message..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Feedback Type Filter */}
              <Select
                value={feedbackFilter}
                onChange={(e) => {
                  setFeedbackFilter(e.target.value as 'all' | 'like' | 'dislike');
                  handleFilterChange();
                }}
                className="w-[120px]"
              >
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="like">👍 Likes</SelectItem>
                <SelectItem value="dislike">👎 Dislikes</SelectItem>
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

              {/* Store Filter */}
              <Select
                value={storeFilter}
                onChange={(e) => {
                  setStoreFilter(e.target.value);
                  handleFilterChange();
                }}
                className="w-[140px]"
              >
                <SelectItem value="all">All Stores</SelectItem>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </Select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : filteredFeedback.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No feedback found</p>
            ) : (
              <>
                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left py-2 px-0 font-semibold text-xs text-muted-foreground">Type</th>
                        <th className="text-left py-2 px-4 font-semibold text-xs text-muted-foreground w-[160px]">Store</th>
                        <th className="text-left py-2 px-4 font-semibold text-xs text-muted-foreground">Snippet</th>
                        <th className="text-left py-2 px-4 font-semibold text-xs text-muted-foreground">Priority</th>
                        <th className="text-left py-2 px-4 font-semibold text-xs text-muted-foreground">Date</th>
                        <th className="text-left py-2 px-4 font-semibold text-xs text-muted-foreground whitespace-nowrap w-[120px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredFeedback.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/30 transition cursor-pointer" onClick={() => openDetailModal(item)}>
                          <td className="py-3 px-0">
                            {item.feedback_type === 'like' ? (
                              <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                                <ThumbsUp className="h-3 w-3 mr-1" />
                                Like
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <ThumbsDown className="h-3 w-3 mr-1" />
                                Dislike
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 font-medium w-[160px] truncate">
                            <span className="truncate block">{getStoreName(item.store_id)}</span>
                          </td>
                          <td className="py-3 px-4 max-w-[48ch]">
                            <p className="text-sm text-muted-foreground line-clamp-2 truncate">{item.message_content}</p>
                          </td>
                          <td className="py-3 px-4">
                            {getPriorityBadge(item.priority)}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2 whitespace-nowrap">
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
                                className="text-red-600"
                                onClick={(e) => { e.stopPropagation(); deleteFeedback(item.id); }}
                                aria-label="Delete feedback"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
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
      <style>{`.admin-feedback-modal-scroll{ -ms-overflow-style:none; scrollbar-width:none; } .admin-feedback-modal-scroll::-webkit-scrollbar{ display: none; }`}</style>
      <Dialog open={modalOpen} onOpenChange={handleModalClose}>
        <DialogContent className="admin-feedback-modal-scroll max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex flex-col gap-6">
            {/* Header: title + meta */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
                  {selectedFeedback?.feedback_type === 'like' ? (
                    <ThumbsUp className="h-6 w-6 text-white" />
                  ) : (
                    <ThumbsDown className="h-6 w-6 text-white" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Feedback Details</h3>
                  <p className="text-sm text-muted-foreground">{selectedFeedback && new Date(selectedFeedback.created_at).toLocaleString()}</p>
                </div>
              </div>

              {/* header meta (no explicit priority badge here anymore) */}
            </div>

            {/* Main grid: left = details/message, right = meta & actions */}
            {selectedFeedback && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <div>
                    <div className="p-4 bg-muted rounded-md">
                      <div className="mb-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase">Rated Message</p>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{selectedFeedback.message_content}</p>
                    </div>
                  </div>

                  {/* store URL moved to aside — link shown next to store name */}

                  <Separator />

                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Conversation History ({selectedFeedback.conversation_history?.length || 0})</p>
                    {selectedFeedback.conversation_history && selectedFeedback.conversation_history.length > 0 ? (
                      <div className="space-y-3">
                        {selectedFeedback.conversation_history.map((msg, index) => (
                          <div key={index} className="flex flex-col">
                            <div className={`text-xs font-medium text-muted-foreground mb-1 ${msg.role === 'user' ? 'ml-6' : ''}`}>
                              {msg.role === 'user' || msg.role === 'human' ? 'User' : 'Assistant'}
                            </div>
                            <div className={`p-3 rounded-md text-sm ${msg.role === 'user' ? 'bg-primary/10 ml-6' : 'bg-muted'}`}>
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No conversation history available</p>
                    )}
                  </div>
                </div>

                <aside className="space-y-4">
                  <div className="p-4 bg-muted rounded-md">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Store</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium mb-0 truncate">{getStoreName(selectedFeedback.store_id)}</p>
                    </div>
                    <code className="text-xs text-muted-foreground bg-muted px-1 py-0.5 rounded break-all inline-flex items-center gap-2 mt-1">
                      <span className="break-all">{selectedFeedback.store_id}</span>
                      {selectedFeedback.store_url && (
                        <a href={selectedFeedback.store_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary inline-flex items-center">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </code>
                  </div>

                  <div className="p-4 bg-muted rounded-md">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Feedback Type</p>
                    {selectedFeedback.feedback_type === 'like' ? (
                      <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                        <ThumbsUp className="h-3 w-3 mr-1" /> Like
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <ThumbsDown className="h-3 w-3 mr-1" /> Dislike
                      </Badge>
                    )}
                  </div>

                  <div className="p-4 bg-muted rounded-md">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Set Priority</p>
                    <div className="mb-3">{getPriorityBadge(selectedFeedback?.priority || null)}</div>
                    <Select
                      value={selectedFeedback.priority || ''}
                      onChange={(e) => updatePriority(selectedFeedback.id, e.target.value)}
                      disabled={updatingPriority === selectedFeedback.id}
                      className="w-full"
                    >
                      {PRIORITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </Select>
                    {updatingPriority === selectedFeedback.id && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Updating...
                      </div>
                    )}
                  </div>

                  {priorityError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-md text-xs text-red-600">
                      <AlertTriangle className="h-3 w-3" />
                      {priorityError}
                    </div>
                  )}

                  <div className="p-4 bg-muted rounded-md">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Actions</p>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="destructive"
                        onClick={() => deleteFeedback(selectedFeedback.id)}
                        disabled={updatingPriority === selectedFeedback.id}
                        className="w-full"
                      >
                        {updatingPriority === selectedFeedback.id ? (
                          <span>Deleting...</span>
                        ) : (
                          <>
                            <Trash className="h-4 w-4 mr-2" />
                            <span>Delete Feedback</span>
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

export default AdminFeedback;