import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { H1, Lead } from '@/components/ui/heading';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Loader2,
  ImageIcon,
  Search,
  ChevronLeft,
  ChevronRight,
  Upload,
  Copy,
  Pencil,
  Trash,
  Check,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface ManageImage {
  id: string;
  name: string;
  url: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

const PAGE_SIZE = 20;

type SortField = 'name' | 'created_at';
type SortDirection = 'asc' | 'desc';

const ManageImages = () => {
  const { loading: roleLoading } = useUserRole();
  const [images, setImages] = useState<ManageImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters and search
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Upload modal
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Rename state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Hover preview state (fixed, so it doesn't affect table scrollbars)
  const [preview, setPreview] = useState<{ url: string; x: number; y: number; visible: boolean }>({ url: '', x: 0, y: 0, visible: false });

  // Load data when role loading completes or sort changes
  useEffect(() => {
    if (roleLoading) return;
    
    let cancelled = false;
    
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        // RLS handles authorization - super_admins and store owners can access
        const { data, error: queryError } = await supabase
          .from('admin_images')
          .select('*')
          .order(sortField, { ascending: sortDirection === 'asc' });

        if (queryError) {
          // RLS will return error if user doesn't have access
          throw queryError;
        }
        
        if (!cancelled) {
          setImages(data || []);
        }
      } catch (err: any) {
        console.error('Failed to load images:', err);
        if (!cancelled) {
          setError(err?.message || 'Failed to load images');
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
  }, [roleLoading, sortField, sortDirection]);

  // Client-side search filtering
  const filteredImages = useMemo(() => {
    if (!searchQuery.trim()) return images;
    const query = searchQuery.toLowerCase();
    return images.filter(
      (img) =>
        img.name.toLowerCase().includes(query) ||
        img.url.toLowerCase().includes(query)
    );
  }, [images, searchQuery]);

  // Pagination
  const totalCount = filteredImages.length;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const paginatedImages = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredImages.slice(start, start + PAGE_SIZE);
  }, [filteredImages, currentPage]);

  // Sort toggle
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'name' ? 'asc' : 'desc');
    }
    setCurrentPage(1);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    );
  };

  // Upload handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    setUploading(true);
    setUploadError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;

      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const response = await fetch(`${supabaseUrl}/functions/v1/upload-image`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Upload failed');

        setImages((prev) => [result.data, ...prev]);
      } else {
        throw new Error('Please select a file to upload');
      }

      // Reset and close modal
      setUploadModalOpen(false);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Copy URL
  const copyUrl = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Rename handlers
  const startRename = (image: ManageImage) => {
    setEditingId(image.id);
    setEditingName(image.name);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingName('');
  };

  const saveRename = async (id: string) => {
    if (!editingName.trim()) {
      cancelRename();
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;

      const response = await fetch(`${supabaseUrl}/functions/v1/upload-image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'rename',
          id,
          name: editingName.trim(),
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Rename failed');

      setImages((prev) =>
        prev.map((img) => (img.id === id ? { ...img, name: editingName.trim() } : img))
      );
      cancelRename();
    } catch (err: any) {
      console.error('Rename error:', err);
      setError(err?.message || 'Failed to rename');
    }
  };

  // Delete handler
  const deleteImage = async (id: string) => {
    const ok = window.confirm('Delete this image? This action cannot be undone.');
    if (!ok) return;

    setDeletingId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;

      const response = await fetch(`${supabaseUrl}/functions/v1/upload-image`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Delete failed');

      setImages((prev) => prev.filter((img) => img.id !== id));
    } catch (err: any) {
      console.error('Delete error:', err);
      setError(err?.message || 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If there's an auth/RLS error, show access denied
  if (error && (error.includes('permission') || error.includes('policy') || error.includes('row-level security'))) {
    return (
      <div className="space-y-6">
        <div>
          <H1>Access Denied</H1>
          <Lead>You don't have permission to access this page</Lead>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Only administrators (store owners) can access image management.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <H1>Image Management</H1>
        <Lead>Upload and manage images for use across the platform</Lead>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
                  <ImageIcon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>All Images</CardTitle>
                  <CardDescription>Total images: {totalCount}</CardDescription>
                </div>
              </div>
              <Button onClick={() => setUploadModalOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Image
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search */}
            <div className="mb-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or URL..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : paginatedImages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No images found
              </p>
            ) : (
              <>
                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left py-2 pr-2 font-semibold text-xs text-muted-foreground w-12">
                          
                        </th>
                        <th className="text-left py-2 px-2 font-semibold text-xs text-muted-foreground">
                          <button
                            className="flex items-center hover:text-foreground transition"
                            onClick={() => toggleSort('name')}
                          >
                            Name
                            {getSortIcon('name')}
                          </button>
                        </th>
                        <th className="text-left py-2 px-2 font-semibold text-xs text-muted-foreground">
                          URL
                        </th>
                        <th className="text-left py-2 px-2 font-semibold text-xs text-muted-foreground w-20">
                          Size
                        </th>
                        <th className="text-left py-2 px-2 font-semibold text-xs text-muted-foreground w-24">
                          <button
                            className="flex items-center hover:text-foreground transition"
                            onClick={() => toggleSort('created_at')}
                          >
                            Date
                            {getSortIcon('created_at')}
                          </button>
                        </th>
                        <th className="text-left py-2 pl-2 font-semibold text-xs text-muted-foreground w-16">
                          
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paginatedImages.map((image) => (
                        <tr
                          key={image.id}
                          className="hover:bg-muted/30 transition group"
                        >
                          {/* Thumbnail */}
                          <td
                            className="py-1.5 pr-2"
                            onMouseEnter={(e) => {
                              const rect = (e.currentTarget as HTMLTableCellElement).getBoundingClientRect();
                              const preferredX = rect.right + 8;
                              const fallbackX = rect.left - 8 - 224;
                              const viewportWidth = window.innerWidth;
                              const x = preferredX + 224 > viewportWidth ? Math.max(8, fallbackX) : preferredX;
                              const y = Math.min(window.innerHeight - 240, rect.top);
                              setPreview({ url: image.url, x, y, visible: true });
                            }}
                            onMouseLeave={() => setPreview({ url: '', x: 0, y: 0, visible: false })}
                          >
                            <div className="w-10 h-10 rounded overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                              <img
                                src={image.url}
                                alt={image.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          </td>
                          {/* Name with inline edit button */}
                          <td className="py-1.5 px-2 max-w-[200px]">
                            {editingId === image.id ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  className="h-7 text-sm flex-1"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveRename(image.id);
                                    if (e.key === 'Escape') cancelRename();
                                  }}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 flex-shrink-0"
                                  onClick={() => saveRename(image.id)}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 flex-shrink-0"
                                  onClick={cancelRename}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium truncate">{image.name}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => startRename(image)}
                                  disabled={editingId !== null}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </td>
                          {/* URL with copy */}
                          <td className="py-1.5 px-2 max-w-[220px]">
                            <div className="flex items-center gap-1.5">
                              <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate flex-1 min-w-0">
                                {image.url}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 flex-shrink-0"
                                onClick={() => copyUrl(image.url, image.id)}
                              >
                                {copiedId === image.id ? (
                                  <Check className="h-3 w-3 text-green-600" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </td>
                          {/* Size */}
                          <td className="py-1.5 px-2 text-muted-foreground text-xs">
                            {formatFileSize(image.file_size)}
                          </td>
                          {/* Date */}
                          <td className="py-1.5 px-2 text-muted-foreground text-xs">
                            {new Date(image.created_at).toLocaleDateString()}
                          </td>
                          {/* Delete action */}
                          <td className="py-1.5 pl-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => deleteImage(image.id)}
                              disabled={deletingId === image.id}
                            >
                              {deletingId === image.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground px-2">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                      >
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

      {/* Upload Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Image</DialogTitle>
            <DialogDescription>
              Upload an image from your computer
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Select Image
              </label>
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="cursor-pointer"
              />
              {selectedFile && (
                <p className="text-xs text-muted-foreground mt-2">
                  Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>
          </div>

          {uploadError && (
            <p className="text-sm text-red-600 mt-2">{uploadError}</p>
          )}

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setUploadModalOpen(false);
                setSelectedFile(null);
                setUploadError(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Fixed preview element rendered at top-level of this component so it doesn't affect table layout */}
      {preview.visible && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50"
          style={{ left: preview.x, top: preview.y }}
        >
          <div className="w-56 h-56 rounded-md overflow-hidden bg-muted shadow-lg">
            <img
              src={preview.url}
              alt="preview"
              className="w-full h-full object-contain bg-white"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageImages;
