import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar, CheckCircle, AlertCircle, Loader2, ExternalLink, Copy, Info, Link as LinkIcon, X, MoreVertical, ChevronDown, Circle, Pencil, Trash2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getCalendarEmbedLink, getCalendarEditLink, getCalendarViewLink } from '@/lib/calendar-links';
import {
  fetchUpcomingBookings,
  fetchAvailableSlots,
  formatEventDate,
  formatEventTime,
  type CalendarEvent
} from '@/lib/calendar-data';
import {
  AvailabilityBlock,
  generateRRule,
  generateTimeOptions,
  formatDaysForDisplay,
  formatTimeForDisplay,
  getCalendarEmbedUrl,
  getSmartCalendarView,
  parseTimeToHour
} from '@/lib/google-calendar-url';

export default function CalendarSetup({ storeId }: { storeId: string }) {
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [calendarInputs, setCalendarInputs] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // Auto-create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createStep, setCreateStep] = useState<
    'choice' | 'general' | 'specific' |
    'availability-type' | 'weekly-setup' | 'specific-setup' | 'add-blocks' | 'congrats'
  >('choice');
  const [selectedType, setSelectedType] = useState<'general' | 'specific' | null>(null);
  const [calendarName, setCalendarName] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [createdCalendarId, setCreatedCalendarId] = useState('');
  const [creatingCalendar, setCreatingCalendar] = useState(false);

  // Event data state
  const [upcomingBookings, setUpcomingBookings] = useState<CalendarEvent[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [scheduleEvents, setScheduleEvents] = useState<Record<string, CalendarEvent[]>>({});

  // Confirmation dialog state
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [calendarToRemove, setCalendarToRemove] = useState<{ calendarId: string; serviceIds: string[]; name: string } | null>(null);

  // Edit services dialog state
  const [editServicesDialogOpen, setEditServicesDialogOpen] = useState(false);
  const [calendarToEdit, setCalendarToEdit] = useState<{ calendarId: string; serviceIds: string[]; name: string } | null>(null);
  const [editSelectedServices, setEditSelectedServices] = useState<string[]>([]);

  // Availability setup state
  const [availabilityType, setAvailabilityType] = useState<'weekly' | 'specific' | null>(null);
  const [availabilityDays, setAvailabilityDays] = useState<string[]>(['MO', 'TU', 'WE', 'TH', 'FR']);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [hasBreak, setHasBreak] = useState(false);
  const [breakStartTime, setBreakStartTime] = useState('12:00');
  const [breakEndTime, setBreakEndTime] = useState('13:00');
  const [specificDate, setSpecificDate] = useState<Date | undefined>();
  const [isOngoing, setIsOngoing] = useState(true);
  const [endRecurrenceDate, setEndRecurrenceDate] = useState<Date | undefined>();
  // Direct API creation state
  const [isCreatingAvailability, setIsCreatingAvailability] = useState(false);
  // Added modal can be in loading, success, or error state
  const [addedModalStatus, setAddedModalStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [addedModalError, setAddedModalError] = useState<string | null>(null);

  // Edit guide flow state
  const [editGuideStep, setEditGuideStep] = useState<'idle' | 'waiting-click' | 'clicked'>('idle');
  const editGuideCleanupRef = useRef<(() => void) | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Edit helper drag state
  const [editHelperPosition, setEditHelperPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });

  // Weekly start date
  const [weeklyStartDate, setWeeklyStartDate] = useState<Date>(() => new Date());

  // Calendar refresh key - increment to force iframe reload
  const [calendarKey, setCalendarKey] = useState(0);

  // View mode for calendar embed
  const [calendarViewMode, setCalendarViewMode] = useState<'WEEK' | 'MONTH' | 'AGENDA'>('WEEK');

  // Current step in the add availability flow (simplified - no waiting-save)
  const [availabilityStep, setAvailabilityStep] = useState<'choose-type' | 'set-availability' | 'added' | 'success'>('choose-type');

  // Track which availability type was selected (for form step)
  const [selectedAvailabilityType, setSelectedAvailabilityType] = useState<'weekly' | 'specific' | null>(null);

  // Duplicate calendar name check
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [duplicateExists, setDuplicateExists] = useState(false);

  // Get session for API calls
  const [session, setSession] = useState<any>(null);

  // Tip visibility
  const [showTip, setShowTip] = useState(true);

  // Track if this is first availability (for dynamic title)
  const [isFirstAvailability, setIsFirstAvailability] = useState(true);

  // Time options for dropdowns
  const timeOptions = generateTimeOptions();

  useEffect(() => {
    loadStore();
  }, [storeId]);

  // Get session for API calls
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
  }, []);

  // Load schedule slots when calendar mappings change
  useEffect(() => {
    if (store?.calendar_mappings) {
      const mappings = typeof store.calendar_mappings === 'string'
        ? JSON.parse(store.calendar_mappings)
        : store.calendar_mappings || {};

      const calendarIds = Object.keys(mappings);
      calendarIds.forEach(calId => loadScheduleSlots(calId));
    }
  }, [store?.calendar_mappings]);

  async function loadStore() {
    const { data } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();

    setStore(data);

    if (data?.invite_calendar_id) {
      loadServices();
      loadUpcomingBookings(data.invite_calendar_id);
    }
  }

  async function loadUpcomingBookings(inviteCalendarId: string) {
    if (!inviteCalendarId) return;

    setLoadingBookings(true);
    try {
      const bookings = await fetchUpcomingBookings(inviteCalendarId, 10);
      setUpcomingBookings(bookings);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoadingBookings(false);
    }
  }

  async function loadScheduleSlots(calendarId: string) {
    try {
      const slots = await fetchAvailableSlots(calendarId, 5);
      setScheduleEvents(prev => ({
        ...prev,
        [calendarId]: slots,
      }));
    } catch (error) {
      console.error('Error loading schedule slots:', error);
    }
  }

  async function setupCalendar() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('setup-calendars', {
        body: { storeId, ownerEmail: user.email },
      });

      if (error) throw error;

      toast({
        title: 'Calendar booking enabled!',
        description: data.message,
      });

      loadStore();
    } catch (error: any) {
      toast({
        title: 'Setup failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadServices() {
    try {
      const { data } = await supabase.functions.invoke('google-sheet', {
        body: {
          operation: 'read',
          storeId,
          tabName: 'Services',
        },
      });

      if (data?.success) {
        setServices(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load services:', error);
    }
  }

  // Check for duplicate calendar name
  async function checkDuplicateCalendarName(name: string) {
    if (!name.trim()) {
      setDuplicateExists(false);
      return;
    }

    setIsCheckingDuplicate(true);
    try {
      // Call edge function to list calendars and check for duplicate
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/link-calendar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          action: 'list',
          storeId: store?.id,
        }),
      });

      const data = await response.json();
      if (data.calendars) {
        const exists = data.calendars.some(
          (cal: any) => cal.summary.toLowerCase() === name.trim().toLowerCase()
        );
        setDuplicateExists(exists);
      }
    } catch (error) {
      console.error('Error checking duplicate:', error);
    } finally {
      setIsCheckingDuplicate(false);
    }
  }

  async function linkCalendar(serviceId: string, calendarId: string) {
    if (!calendarId.trim()) {
      toast({
        title: 'Calendar ID required',
        description: 'Please enter a valid calendar ID',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('link-calendar', {
        body: {
          storeId,
          serviceId,
          calendarId: calendarId.trim(),
          action: 'link',
        },
      });

      if (error) throw error;

      toast({
        title: 'Calendar linked!',
        description: 'Calendar linked to service successfully',
      });

      // Clear input
      setCalendarInputs({ ...calendarInputs, [serviceId]: '' });

      loadStore();
    } catch (error: any) {
      toast({
        title: 'Link failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  function getLinkedCalendar(serviceId: string): string | null {
    if (!store?.calendar_mappings) return null;

    const mappings = typeof store.calendar_mappings === 'string'
      ? JSON.parse(store.calendar_mappings)
      : store.calendar_mappings;

    // Find calendar ID that maps to this service
    for (const [calId, value] of Object.entries(mappings)) {
      let serviceIds: string[];

      // Handle different formats
      if (value && typeof value === 'object' && 'serviceIds' in value) {
        // New metadata format
        serviceIds = (value as { name: string; serviceIds: string[] }).serviceIds;
      } else if (Array.isArray(value)) {
        // Legacy array format
        serviceIds = value;
      } else {
        // Legacy string format
        serviceIds = [value as string];
      }

      if (serviceIds.includes(serviceId)) return calId;
    }

    return null;
  }

  async function unlinkCalendar(serviceId: string) {
    const calendarId = getLinkedCalendar(serviceId);
    if (!calendarId) return;

    try {
      const { data, error } = await supabase.functions.invoke('link-calendar', {
        body: {
          storeId,
          calendarId,
          serviceId,  // Pass serviceId to remove just this service
          action: 'unlink',
        },
      });

      if (error) throw error;

      toast({
        title: 'Calendar unlinked',
        description: 'Service is no longer linked to a calendar',
      });

      loadStore();
    } catch (error: any) {
      toast({
        title: 'Unlink failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  // Auto-create calendar handler - async, no loading state
  async function handleCreateCalendar() {
    if (!calendarName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a calendar name',
        variant: 'destructive',
      });
      return;
    }

    if (selectedType === 'general' && selectedServices.length === 0) {
      toast({
        title: 'Services required',
        description: 'Please select at least one service',
        variant: 'destructive',
      });
      return;
    }

    if (selectedType === 'specific' && selectedServices.length === 0) {
      toast({
        title: 'Service required',
        description: 'Please select at least one service',
        variant: 'destructive',
      });
      return;
    }

    // Immediately transition to fullscreen view - no loading state
    setCreateStep('add-blocks');
    setAvailabilityStep('choose-type');

    // Create calendar in background
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const serviceIds = selectedServices;

      const { data, error } = await supabase.functions.invoke('link-calendar', {
        body: {
          action: 'create',
          storeId,
          serviceIds,
          calendarName,
          ownerEmail: user.email,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to create calendar');
      }

      // Success - set the calendar ID
      setCreatedCalendarId(data.calendarId);

      // Reload store to show new mapping
      await loadStore();

    } catch (error: any) {
      console.error('Error creating calendar:', error);
      toast({
        title: 'Failed to create calendar',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
      // Go back to name step on failure
      setCreateStep('name');
    }
  }

  // Build availability blocks based on current state
  const buildAvailabilityBlocks = (): AvailabilityBlock[] => {
    const blocks: AvailabilityBlock[] = [];

    // Use selectedAvailabilityType if available (new flow), fall back to availabilityType (legacy)
    const effectiveType = selectedAvailabilityType || availabilityType;

    console.log('[buildAvailabilityBlocks] selectedAvailabilityType:', selectedAvailabilityType);
    console.log('[buildAvailabilityBlocks] availabilityType:', availabilityType);
    console.log('[buildAvailabilityBlocks] effectiveType:', effectiveType);
    console.log('[buildAvailabilityBlocks] startTime:', startTime);
    console.log('[buildAvailabilityBlocks] endTime:', endTime);
    console.log('[buildAvailabilityBlocks] hasBreak:', hasBreak);
    console.log('[buildAvailabilityBlocks] availabilityDays:', availabilityDays);

    if (effectiveType === 'weekly') {
      if (hasBreak) {
        // Morning block
        blocks.push({
          id: 'morning',
          title: 'Available',
          days: availabilityDays,
          startTime: startTime,
          endTime: breakStartTime,
          isRecurring: true,
          specificDate: weeklyStartDate,  // Use selected start date
          endDate: isOngoing ? undefined : endRecurrenceDate,
        });

        // Afternoon block
        blocks.push({
          id: 'afternoon',
          title: 'Available',
          days: availabilityDays,
          startTime: breakEndTime,
          endTime: endTime,
          isRecurring: true,
          specificDate: weeklyStartDate,  // Use selected start date
          endDate: isOngoing ? undefined : endRecurrenceDate,
        });
      } else {
        // Single block
        blocks.push({
          id: 'main',
          title: 'Available',
          days: availabilityDays,
          startTime: startTime,
          endTime: endTime,
          isRecurring: true,
          specificDate: weeklyStartDate,  // Use selected start date
          endDate: isOngoing ? undefined : endRecurrenceDate,
        });
      }
    } else if (effectiveType === 'specific' && specificDate) {
      // Specific date/time - ALWAYS a single block (no break option)
      blocks.push({
        id: 'specific',
        title: 'Available',
        days: [],
        startTime: startTime,
        endTime: endTime,
        isRecurring: false,
        specificDate: specificDate,
      });
    }

    console.log('[buildAvailabilityBlocks] Built blocks:', blocks);
    return blocks;
  };

  // Reset availability state
  const resetAvailabilityState = () => {
    setAvailabilityType(null);
    setAvailabilityDays(['MO', 'TU', 'WE', 'TH', 'FR']);
    setStartTime('09:00');
    setEndTime('17:00');
    setHasBreak(false);
    setBreakStartTime('12:00');
    setBreakEndTime('13:00');
    setSpecificDate(undefined);
    setIsOngoing(true);
    setEndRecurrenceDate(undefined);
    setWeeklyStartDate(new Date());
    // Reset new flow state
    setSelectedAvailabilityType(null);
    setAvailabilityStep('choose-type');
    setCalendarViewMode('WEEK');
  };

  // Handle "Add Another" from success state
  const handleAddAnother = () => {
    setSelectedAvailabilityType(null);
    setAvailabilityDays(['MO', 'TU', 'WE', 'TH', 'FR']);
    setStartTime('09:00');
    setEndTime('17:00');
    setHasBreak(false);
    setBreakStartTime('12:00');
    setBreakEndTime('13:00');
    setSpecificDate(undefined);
    setAvailabilityStep('choose-type');
  };

  // Direct API creation - creates availability events without popup/polling
  const createAvailabilityDirect = async () => {
    // === GUARD: Prevent double-click ===
    if (isCreatingAvailability) {
      console.log('[createAvailabilityDirect] Already in progress, ignoring');
      return;
    }

    console.log('[createAvailabilityDirect] === START ===');
    console.log('[createAvailabilityDirect] createdCalendarId:', createdCalendarId);
    console.log('[createAvailabilityDirect] selectedAvailabilityType:', selectedAvailabilityType);
    console.log('[createAvailabilityDirect] State values - startTime:', startTime, 'endTime:', endTime);
    console.log('[createAvailabilityDirect] State values - breakStartTime:', breakStartTime, 'breakEndTime:', breakEndTime);
    console.log('[createAvailabilityDirect] State values - hasBreak:', hasBreak);

    setIsCreatingAvailability(true);

    // Build blocks FIRST (before showing modal)
    const blocks = buildAvailabilityBlocks();
    console.log('[createAvailabilityDirect] Built blocks:', blocks);

    // Only validation that stays on form - if no blocks configured
    if (blocks.length === 0) {
      toast({
        title: 'Configuration required',
        description: 'Please configure your availability times',
        variant: 'destructive',
      });
      setIsCreatingAvailability(false);
      return;
    }

    // IMMEDIATELY go to 'added' step in LOADING state
    setAddedModalStatus('loading');
    setAddedModalError(null);
    setAvailabilityStep('added');

    try {
      // Check calendar ID - if not ready, show error on modal
      if (!createdCalendarId) {
        setAddedModalStatus('error');
        setAddedModalError('Calendar is still being created. Please wait and try again.');
        setIsCreatingAvailability(false);
        return;
      }

      // Convert blocks to API format with ISO datetime strings
      const apiBlocks = blocks.map((block, index) => {
        // Get the date to use for the event
        const eventDate = block.specificDate || weeklyStartDate || new Date();

        // Parse start and end times
        const [startHour, startMin] = block.startTime.split(':').map(Number);
        const [endHour, endMin] = block.endTime.split(':').map(Number);

        console.log(`[createAvailabilityDirect] Block ${index} (${block.id}):`);
        console.log(`  - Raw times: ${block.startTime} → ${block.endTime}`);
        console.log(`  - Parsed: ${startHour}:${startMin} → ${endHour}:${endMin}`);

        // Create start datetime
        const startDateTime = new Date(eventDate);
        startDateTime.setHours(startHour, startMin, 0, 0);

        // Create end datetime
        const endDateTime = new Date(eventDate);
        endDateTime.setHours(endHour, endMin, 0, 0);

        // Validate: end must be after start
        if (endDateTime <= startDateTime) {
          console.error(`[createAvailabilityDirect] Block ${index}: Invalid time range! End (${endDateTime.toISOString()}) <= Start (${startDateTime.toISOString()})`);
          throw new Error(`Invalid time range for ${block.id} block: end time must be after start time`);
        }

        console.log(`  - ISO: ${startDateTime.toISOString()} → ${endDateTime.toISOString()}`);

        // Build the block for API
        const apiBlock: any = {
          title: 'Available',
          startDateTime: startDateTime.toISOString(),
          endDateTime: endDateTime.toISOString(),
          timeZone: 'Asia/Hong_Kong',
        };

        // Add recurrence if this is a weekly block
        if (block.isRecurring && block.days && block.days.length > 0) {
          apiBlock.recurrence = generateRRule(block.days, block.endDate);
        }

        return apiBlock;
      });

      console.log('[createAvailabilityDirect] Sending API request...');

      const response = await supabase.functions.invoke('link-calendar', {
        body: {
          action: 'create-availability',
          calendarId: createdCalendarId,
          blocks: apiBlocks,
          storeId: storeId,
        },
      });

      console.log('[createAvailabilityDirect] Response:', response);

      if (response.error) {
        console.error('[createAvailabilityDirect] Response error:', response.error);
        setAddedModalStatus('error');
        setAddedModalError(response.error.message || 'Failed to add availability. Please try again.');
        return;
      }

      if (response.data?.success) {
        console.log('[createAvailabilityDirect] Success!');

        // Refresh calendar (it loads behind the modal)
        setCalendarKey(prev => prev + 1);

        // Calculate smart view based on the event
        const eventStartHour = parseTimeToHour(startTime);
        const eventEndHour = parseTimeToHour(endTime);
        const eventDate = selectedAvailabilityType === 'specific' ? specificDate : weeklyStartDate || new Date();

        if (eventDate) {
          const smartView = getSmartCalendarView(eventStartHour, eventEndHour, eventDate);
          setCalendarViewMode(smartView.mode);
        }

        // SUCCESS!
        setAddedModalStatus('success');
      } else {
        console.error('[createAvailabilityDirect] API error:', response.data?.error);
        setAddedModalStatus('error');
        setAddedModalError(response.data?.error || 'Failed to add availability. Please try again.');
      }
    } catch (error: any) {
      console.error('[createAvailabilityDirect] Exception:', error);
      setAddedModalStatus('error');
      setAddedModalError(error.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsCreatingAvailability(false);
      console.log('[createAvailabilityDirect] === END ===');
    }
  };

  // Edit guide - start listening for iframe clicks using blur detection
  const startEditGuideListener = () => {
    // Reset helper position
    setEditHelperPosition({ x: 0, y: 0 });

    // Force focus on parent window
    window.focus();

    const handleBlur = () => {
      setTimeout(() => {
        if (document.activeElement === iframeRef.current) {
          // User clicked inside the calendar iframe!
          setEditGuideStep('clicked');
          window.removeEventListener('blur', handleBlur);
          // Return focus to parent so we can detect again if needed
          window.focus();
        }
      }, 0);
    };

    window.addEventListener('blur', handleBlur);

    // Store cleanup function
    editGuideCleanupRef.current = () => {
      window.removeEventListener('blur', handleBlur);
    };
  };

  // Edit helper drag handlers
  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: editHelperPosition.x,
      y: editHelperPosition.y,
      startX: e.clientX,
      startY: e.clientY
    };
  };

  const handleDrag = (e: MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;
    setEditHelperPosition({
      x: dragStartRef.current.x + deltaX,
      y: dragStartRef.current.y + deltaY
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Drag event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDrag);
        window.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging]);

  // Cleanup edit guide listener on unmount or step change
  useEffect(() => {
    return () => {
      if (editGuideCleanupRef.current) {
        editGuideCleanupRef.current();
      }
    };
  }, []);

  // Reset dialog state
  const resetCreateDialog = () => {
    setCreateDialogOpen(false);
    setCreateStep('choice');
    setSelectedType(null);
    setCalendarName('');
    setSelectedServices([]);
    setCreatedCalendarId('');
    setCreatingCalendar(false);
    setDuplicateExists(false);
    resetAvailabilityState();
  };

  // Handle confirmation of schedule removal
  const handleRemoveSchedule = async () => {
    if (!calendarToRemove) return;

    // Unlink all services associated with this calendar
    for (const serviceId of calendarToRemove.serviceIds) {
      await unlinkCalendar(serviceId);
    }

    setRemoveDialogOpen(false);
    setCalendarToRemove(null);
  };

  // Handle saving edited services
  const handleSaveEditedServices = async () => {
    if (!calendarToEdit) return;

    try {
      // Update the calendar_mappings directly to preserve the calendar name
      const mappings = typeof store.calendar_mappings === 'string'
        ? JSON.parse(store.calendar_mappings)
        : store.calendar_mappings || {};

      // Parse and convert legacy formats
      type CalendarData = { name: string; serviceIds: string[] };
      const updatedMappings: Record<string, CalendarData> = {};

      Object.entries(mappings).forEach(([calId, value]: [string, any]) => {
        if (value && typeof value === 'object' && 'serviceIds' in value) {
          updatedMappings[calId] = value as CalendarData;
        } else if (Array.isArray(value)) {
          updatedMappings[calId] = { name: 'Availability Schedule', serviceIds: value };
        } else {
          updatedMappings[calId] = { name: 'Availability Schedule', serviceIds: [value as string] };
        }
      });

      // Update the specific calendar's services while preserving its name
      updatedMappings[calendarToEdit.calendarId] = {
        name: calendarToEdit.name, // Preserve the calendar name
        serviceIds: editSelectedServices
      };

      // Save to database
      const { error } = await supabase
        .from('stores')
        .update({ calendar_mappings: JSON.stringify(updatedMappings) })
        .eq('id', storeId);

      if (error) throw error;

      toast({
        title: 'Services updated!',
        description: 'Calendar services have been updated successfully',
      });

      // Reload store to reflect changes
      await loadStore();

      setEditServicesDialogOpen(false);
      setCalendarToEdit(null);
      setEditSelectedServices([]);
    } catch (error: any) {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };


  // Not setup yet
  if (!store?.invite_calendar_id) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Service Availability</CardTitle>
              <CardDescription>
                Define when customers can book your services by creating availability schedules. Use shared hours for services with the same schedule, or create unique availability for individual services.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Set up booking availability</AlertTitle>
            <AlertDescription>
              This will create a "Customer Bookings" calendar where confirmed bookings appear as events. After setup, you'll create availability schedules to define when services can be booked.
            </AlertDescription>
          </Alert>
          <Button onClick={setupCalendar} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up...
              </>
            ) : (
              '+ Create Schedule'
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Already setup - show linking UI
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
            <Calendar className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <CardTitle>Calendar Booking</CardTitle>
            <CardDescription>
              Manage booking calendars and availability schedules
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Check if Google Sheet is connected */}
        {!store.sheet_id ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Set up your services first</AlertTitle>
            <AlertDescription>
              To create availability schedules, add your Google Sheet with services. Go to Store Setup to connect your sheet.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Availability Schedules Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Availability Schedules</h4>
              </div>

              {services.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No services found in your Google Sheet. Add services to your sheet to set up availability schedules.
              </AlertDescription>
            </Alert>
          ) : Object.keys(store?.calendar_mappings || {}).length === 0 ? (
            /* EMPTY STATE - No schedules created yet */
            <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-3">
              <div className="flex justify-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div>
                <h5 className="font-semibold mb-1">No availability schedules yet</h5>
                <p className="text-sm text-muted-foreground">
                  Create a schedule to define when your services can be booked. You can create shared hours for multiple services or unique schedules for specific services.
                </p>
              </div>
              <Button onClick={() => {
                setCreateStep('choice');
                setCreateDialogOpen(true);
              }}>
                + Create Schedule
              </Button>
            </div>
          ) : (
            <>
              {/* Show calendar cards */}
              <div className="space-y-3">
                {(() => {
                  const mappings = typeof store.calendar_mappings === 'string'
                    ? JSON.parse(store.calendar_mappings)
                    : store.calendar_mappings || {};

                  // Convert to calendarGroups - handle all formats
                  type CalendarData = { name: string; serviceIds: string[] };
                  const calendarGroups: Record<string, CalendarData> = {};

                  Object.entries(mappings).forEach(([calendarId, value]) => {
                    if (value && typeof value === 'object' && 'serviceIds' in value) {
                      // New metadata format
                      calendarGroups[calendarId] = value as CalendarData;
                    } else if (Array.isArray(value)) {
                      // Legacy array format - generate default name
                      calendarGroups[calendarId] = {
                        name: 'Availability Schedule',
                        serviceIds: value
                      };
                    } else {
                      // Legacy string format - generate default name
                      calendarGroups[calendarId] = {
                        name: 'Availability Schedule',
                        serviceIds: [value as string]
                      };
                    }
                  });

                  return Object.entries(calendarGroups).map(([calendarId, calendarData]) => {
                    const linkedServices = services.filter(s => {
                      const sid = s.serviceID || s.serviceName;
                      return calendarData.serviceIds.includes(sid);
                    });

                    const calendarName = calendarData.name;

                    const slots = scheduleEvents[calendarId] || [];

                    return (
                      <div key={calendarId} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium">{calendarName}</div>
                            <div className="text-sm text-muted-foreground">
                              {linkedServices.map(s => s.serviceName).join(', ')}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="z-50">
                              <DropdownMenuItem
                                onClick={() => {
                                  // Navigate to fullscreen calendar view
                                  setCalendarName(calendarName);
                                  setCreatedCalendarId(calendarId);
                                  setCreateStep('add-blocks');
                                  setAvailabilityStep('success');  // Show calendar with buttons
                                  setIsFirstAvailability(false);   // Not first time
                                }}
                              >
                                Manage Schedule
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => window.open(
                                  getCalendarEditLink(calendarId),
                                  '_blank'
                                )}
                              >
                                Edit in Google Calendar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setCalendarToEdit({ calendarId, serviceIds: calendarData.serviceIds, name: calendarName });
                                  setEditSelectedServices([...calendarData.serviceIds]);
                                  setEditServicesDialogOpen(true);
                                }}
                              >
                                Edit Services
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  setCalendarToRemove({ calendarId, serviceIds: calendarData.serviceIds, name: calendarName });
                                  setRemoveDialogOpen(true);
                                }}
                              >
                                Remove Schedule
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Show next available slots */}
                        {slots.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Next Available:</div>
                            {slots.slice(0, 3).map(slot => (
                              <button
                                key={slot.id}
                                onClick={() => window.open(slot.htmlLink, '_blank')}
                                className="text-xs text-muted-foreground hover:underline text-left block"
                              >
                                {slot.summary && <span className="font-medium">{slot.summary} • </span>}
                                📅 {formatEventDate(slot.start.dateTime)} • {formatEventTime(slot.start.dateTime)} - {formatEventTime(slot.end.dateTime)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              <Button
                onClick={() => {
                  setCreateStep('choice');
                  setCreateDialogOpen(true);
                }}
                variant="outline"
                className="w-full"
              >
                + Add Schedule
              </Button>
            </>
          )}
        </div>

        <Separator />

        {/* Customer Bookings Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Upcoming Bookings</h4>
            {upcomingBookings.length > 0 && (
              <Badge variant="outline">{upcomingBookings.length} upcoming</Badge>
            )}
          </div>

          {loadingBookings ? (
            <div className="space-y-2">
              <div className="h-16 bg-gray-100 animate-pulse rounded" />
              <div className="h-16 bg-gray-100 animate-pulse rounded" />
            </div>
          ) : upcomingBookings.length > 0 ? (
            <>
              <div className="space-y-2">
                {upcomingBookings.slice(0, 5).map(booking => (
                  <button
                    key={booking.id}
                    onClick={() => window.open(booking.htmlLink, '_blank')}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors w-full text-left"
                  >
                    <div>
                      <div className="font-medium text-sm">{booking.summary}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatEventDate(booking.start.dateTime)} • {formatEventTime(booking.start.dateTime)}
                      </div>
                    </div>
                    <Badge variant={booking.status === 'confirmed' ? 'default' : 'outline'} className="text-xs">
                      {booking.status}
                    </Badge>
                  </button>
                ))}
              </div>

              {upcomingBookings.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  +{upcomingBookings.length - 5} more booking{upcomingBookings.length - 5 > 1 ? 's' : ''}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              No upcoming bookings
            </p>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => window.open(
              getCalendarEmbedLink(store.invite_calendar_id, { mode: 'AGENDA' }),
              '_blank'
            )}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            View All Bookings
          </Button>
        </div>
          </>
        )}
      </CardContent>

      {/* Create Calendar Dialog - Inline to prevent re-creation on render */}
      <Dialog open={createDialogOpen && createStep !== 'add-blocks'} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          {/* STEP 1: Choice */}
          {createStep === 'choice' && (
            <>
              <DialogHeader>
                <DialogTitle>Create Availability Schedule</DialogTitle>
                <DialogDescription>
                  Choose how to organize your booking hours
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <button
                  onClick={() => {
                    setSelectedType('general');
                    setCreateStep('general');
                    setCalendarName('');
                    setSelectedServices([]);
                  }}
                  className="w-full p-4 text-left border rounded-lg hover:border-primary transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary mt-1">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">⭐ General Hours</h3>
                      <p className="text-sm text-muted-foreground">
                        One schedule for services with the same hours
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Example: "Store Hours" for Mon-Fri 9-5
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setSelectedType('specific');
                    setCreateStep('specific');
                    setSelectedServices([]);
                    setCalendarName('');
                  }}
                  className="w-full p-4 text-left border rounded-lg hover:border-primary transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary mt-1">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">🎯 Unique Schedule</h3>
                      <p className="text-sm text-muted-foreground">
                        Custom availability for specific services
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Example: "Weekend Classes" for Sat-Sun only
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </>
          )}


        {/* STEP 2a: General Path */}
        {createStep === 'general' && (
          <>
            <DialogHeader>
              <DialogTitle>General Availability Calendar</DialogTitle>
              <DialogDescription>
                Create a calendar for multiple services with shared hours
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Schedule Name
                </label>
                <Input
                  value={calendarName}
                  onChange={(e) => {
                    setCalendarName(e.target.value);
                    setDuplicateExists(false);
                  }}
                  onBlur={(e) => checkDuplicateCalendarName(e.target.value)}
                  placeholder="e.g., Store Hours"
                />
                {duplicateExists && (
                  <p className="text-sm text-amber-600 flex items-center gap-1 mt-1">
                    <AlertCircle className="h-4 w-4" />
                    A calendar with this name already exists
                  </p>
                )}
                {!duplicateExists && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Name this availability schedule
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Which services share this schedule?
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  Select all services that will be available during the same hours
                </p>
                <div className="space-y-2 border rounded-lg p-3 max-h-60 overflow-y-auto">
                  {services.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-2">
                      No services available
                    </div>
                  ) : (
                    services.map((service) => {
                      const serviceId = service.serviceID || service.serviceName;
                      const isChecked = selectedServices.includes(serviceId);
                      return (
                        <div
                          key={serviceId}
                          className="flex items-center space-x-3 py-2 px-2 rounded hover:bg-gray-50 cursor-pointer"
                          onClick={() => {
                            if (isChecked) {
                              setSelectedServices(selectedServices.filter(id => id !== serviceId));
                            } else {
                              setSelectedServices([...selectedServices, serviceId]);
                            }
                          }}
                        >
                          <Checkbox
                            id={`general-service-${serviceId}`}
                            checked={isChecked}
                            onCheckedChange={() => {}}
                          />
                          <label
                            htmlFor={`general-service-${serviceId}`}
                            className="text-sm font-medium leading-none cursor-pointer flex-1"
                            onClick={(e) => e.preventDefault()}
                          >
                            {service.serviceName}
                          </label>
                        </div>
                      );
                    })
                  )}
                </div>
                {selectedServices.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {selectedServices.length} service{selectedServices.length === 1 ? '' : 's'} selected
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => setCreateStep('choice')}
              >
                Back
              </Button>
              <Button
                onClick={handleCreateCalendar}
                disabled={selectedServices.length === 0 || !calendarName.trim() || duplicateExists || isCheckingDuplicate}
              >
                {isCheckingDuplicate ? 'Checking...' : 'Create'}
              </Button>
            </div>
          </>
        )}


        {/* STEP 2b: Specific Path */}
        {createStep === 'specific' && (
          <>
            <DialogHeader>
              <DialogTitle>Specific Service Availability</DialogTitle>
              <DialogDescription>
                Create a calendar for services with unique availability
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* FIRST: Schedule Name */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Schedule Name
                </label>
                <Input
                  value={calendarName}
                  onChange={(e) => {
                    setCalendarName(e.target.value);
                    setDuplicateExists(false);
                  }}
                  onBlur={(e) => checkDuplicateCalendarName(e.target.value)}
                  placeholder="e.g., Weekend Classes"
                />
                {duplicateExists && (
                  <p className="text-sm text-amber-600 flex items-center gap-1 mt-1">
                    <AlertCircle className="h-4 w-4" />
                    A calendar with this name already exists
                  </p>
                )}
                {!duplicateExists && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Name this availability schedule
                  </p>
                )}
              </div>

              {/* SECOND: Select Services */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Select Service(s)
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  Choose which services will use this availability schedule
                </p>
                <div className="space-y-2 border rounded-lg p-3 max-h-60 overflow-y-auto">
                  {services.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-2">
                      No services available
                    </div>
                  ) : (
                    services.map((service) => {
                      const serviceId = service.serviceID || service.serviceName;
                      const isChecked = selectedServices.includes(serviceId);
                      return (
                        <div
                          key={serviceId}
                          className="flex items-center space-x-3 py-2 px-2 rounded hover:bg-gray-50 cursor-pointer"
                          onClick={() => {
                            const newSelection = isChecked
                              ? selectedServices.filter(id => id !== serviceId)
                              : [...selectedServices, serviceId];
                            setSelectedServices(newSelection);
                          }}
                        >
                          <Checkbox
                            id={`specific-service-${serviceId}`}
                            checked={isChecked}
                            onCheckedChange={() => {}}
                          />
                          <label
                            htmlFor={`specific-service-${serviceId}`}
                            className="text-sm font-medium leading-none cursor-pointer flex-1"
                            onClick={(e) => e.preventDefault()}
                          >
                            {service.serviceName}
                          </label>
                        </div>
                      );
                    })
                  )}
                </div>
                {selectedServices.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {selectedServices.length} service{selectedServices.length === 1 ? '' : 's'} selected
                  </p>
                )}
              </div>

              <Alert>
                <div className="text-sm">
                  💡 <strong>Perfect for:</strong> Services with unique schedules like weekend-only classes, evening sessions, or services available at different times than your regular hours.
                </div>
              </Alert>
            </div>

            <div className="flex justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateStep('choice');
                  setSelectedServices([]);
                  setCalendarName('');
                }}
              >
                Back
              </Button>
              <Button
                onClick={handleCreateCalendar}
                disabled={selectedServices.length === 0 || !calendarName.trim() || duplicateExists || isCheckingDuplicate}
              >
                {isCheckingDuplicate ? 'Checking...' : 'Create'}
              </Button>
            </div>
          </>
        )}


        {/* Step: Availability Type Selection */}
        {createStep === 'availability-type' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Let's add your first availability block</h2>
              <p className="text-muted-foreground mt-1">
                This tells customers when your services are open to book.
              </p>
            </div>

            <RadioGroup
              value={availabilityType || ''}
              onValueChange={(value) => setAvailabilityType(value as 'weekly' | 'specific')}
              className="space-y-3"
            >
              <RadioGroupItem
                value="weekly"
                id="availability-weekly"
                className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors hover:bg-gray-50 ${
                  availabilityType === 'weekly' ? 'border-primary bg-primary/5' : 'border-gray-200'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    📅 Weekly Schedule
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Hours that repeat every week
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    e.g., "Mon-Fri 9am-5pm"
                  </p>
                </div>
              </RadioGroupItem>

              <RadioGroupItem
                value="specific"
                id="availability-specific"
                className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors hover:bg-gray-50 ${
                  availabilityType === 'specific' ? 'border-primary bg-primary/5' : 'border-gray-200'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    📌 Specific Day/Time
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    One-off availability for a particular date
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    e.g., "Sat Dec 14, 10am-2pm"
                  </p>
                </div>
              </RadioGroupItem>
            </RadioGroup>

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setCreateStep(selectedType === 'general' ? 'general' : 'specific')}
              >
                Back
              </Button>
              <Button
                disabled={!availabilityType}
                onClick={() => {
                  if (availabilityType === 'weekly') {
                    setCreateStep('weekly-setup');
                  } else {
                    setCreateStep('specific-setup');
                  }
                }}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step: Weekly Schedule Setup */}
        {createStep === 'weekly-setup' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Set your weekly hours</h2>
            </div>

            {/* Day Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Which days?
              </label>
              <div className="flex gap-2">
                {[
                  { code: 'MO', label: 'Mon' },
                  { code: 'TU', label: 'Tue' },
                  { code: 'WE', label: 'Wed' },
                  { code: 'TH', label: 'Thu' },
                  { code: 'FR', label: 'Fri' },
                  { code: 'SA', label: 'Sat' },
                  { code: 'SU', label: 'Sun' },
                ].map((day) => (
                  <label
                    key={day.code}
                    className={`flex flex-col items-center justify-center w-12 h-14 rounded-lg border-2 cursor-pointer transition-all text-center ${
                      availabilityDays.includes(day.code)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={availabilityDays.includes(day.code)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAvailabilityDays([...availabilityDays, day.code]);
                        } else {
                          setAvailabilityDays(availabilityDays.filter(d => d !== day.code));
                        }
                      }}
                      className="sr-only"
                    />
                    <span className="text-xs font-medium">{day.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Time Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Hours
              </label>
              <div className="flex items-center gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">From</label>
                  <select
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="block w-32 mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {timeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">To</label>
                  <select
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="block w-32 mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {timeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Break Checkbox */}
            <div>
              <Checkbox
                id="hasBreak-weekly"
                checked={hasBreak}
                onChange={(e) => setHasBreak(e.target.checked)}
                className="text-sm cursor-pointer"
              >
                I have a break (e.g., lunch)
              </Checkbox>

              {hasBreak && (
                <div className="mt-3 ml-6 flex items-center gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Break from</label>
                    <select
                      value={breakStartTime}
                      onChange={(e) => setBreakStartTime(e.target.value)}
                      className="block w-28 mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {timeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">to</label>
                    <select
                      value={breakEndTime}
                      onChange={(e) => setBreakEndTime(e.target.value)}
                      className="block w-28 mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {timeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Recurrence End */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Runs until
              </label>
              <RadioGroup
                value={isOngoing ? 'ongoing' : 'until'}
                onValueChange={(value) => setIsOngoing(value === 'ongoing')}
                className="space-y-2"
              >
                <RadioGroupItem value="ongoing" id="ongoing" className="text-sm cursor-pointer">
                  Ongoing (no end date)
                </RadioGroupItem>
                <RadioGroupItem value="until" id="until" className="text-sm cursor-pointer">
                  Until specific date
                </RadioGroupItem>
              </RadioGroup>

              {!isOngoing && (
                <div className="mt-3 ml-6">
                  <input
                    type="date"
                    value={endRecurrenceDate ? endRecurrenceDate.toISOString().split('T')[0] : ''}
                    onChange={(e) => setEndRecurrenceDate(e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-auto max-w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}

              <p className="text-xs text-muted-foreground mt-2">
                💡 You can change this anytime in Google Calendar
              </p>
            </div>

            {/* Starting from date */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Starting from
              </label>
              <input
                type="date"
                value={weeklyStartDate ? weeklyStartDate.toISOString().split('T')[0] : ''}
                onChange={(e) => setWeeklyStartDate(e.target.value ? new Date(e.target.value + 'T00:00:00') : new Date())}
                min={new Date().toISOString().split('T')[0]}
                className="w-auto max-w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your recurring availability will start from this date
              </p>
            </div>

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setCreateStep('availability-type')}
              >
                Back
              </Button>
              <Button
                disabled={availabilityDays.length === 0}
                onClick={() => setCreateStep('add-blocks')}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step: Specific Date Setup */}
        {createStep === 'specific-setup' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Set your availability</h2>
            </div>

            {/* Date Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Which date?
              </label>
              <input
                type="date"
                value={specificDate ? specificDate.toISOString().split('T')[0] : ''}
                onChange={(e) => setSpecificDate(e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined)}
                min={new Date().toISOString().split('T')[0]}
                className="w-auto max-w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Time Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Hours
              </label>
              <div className="flex items-center gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">From</label>
                  <select
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="block w-32 mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {timeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">To</label>
                  <select
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="block w-32 mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {timeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Break Checkbox */}
            <div>
              <Checkbox
                id="hasBreak-specific"
                checked={hasBreak}
                onChange={(e) => setHasBreak(e.target.checked)}
                className="text-sm cursor-pointer"
              >
                I have a break (e.g., lunch)
              </Checkbox>

              {hasBreak && (
                <div className="mt-3 ml-6 flex items-center gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Break from</label>
                    <select
                      value={breakStartTime}
                      onChange={(e) => setBreakStartTime(e.target.value)}
                      className="block w-28 mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {timeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">to</label>
                    <select
                      value={breakEndTime}
                      onChange={(e) => setBreakEndTime(e.target.value)}
                      className="block w-28 mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {timeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setCreateStep('availability-type')}
              >
                Back
              </Button>
              <Button
                disabled={!specificDate}
                onClick={() => setCreateStep('add-blocks')}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step: Congratulations */}
        {createStep === 'congrats' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                🎉 You're all set!
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {(() => {
                const allBlocks = buildAvailabilityBlocks();
                const detectedCount = allBlocks.filter(block => addedBlocks.has(block.id)).length;
                const allDetected = detectedCount === allBlocks.length;

                return (
                  <>
                    {allDetected ? (
                      // All blocks were detected - show success with summary
                      <>
                        <Alert className="border-green-200 bg-green-50">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <AlertDescription className="text-green-800">
                            Your availability has been added to Google Calendar!
                          </AlertDescription>
                        </Alert>

                        <div className="rounded-lg bg-muted/50 p-4">
                          <p className="text-sm font-medium text-foreground mb-2">
                            Your availability schedule:
                          </p>
                          <div className="space-y-1">
                            {allBlocks.map((block) => (
                              <div key={block.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="text-green-600">✓</span>
                                <span>
                                  {block.id === 'morning' && '☀️ Morning: '}
                                  {block.id === 'afternoon' && '🌤️ Afternoon: '}
                                  {block.id === 'main' && '📅 '}
                                  {block.id === 'specific' && '📌 '}
                                  {block.isRecurring
                                    ? formatDaysForDisplay(block.days)
                                    : block.specificDate?.toLocaleDateString()
                                  }
                                  {' '}
                                  {formatTimeForDisplay(block.startTime)} - {formatTimeForDisplay(block.endTime)}
                                </span>
                              </div>
                            ))}
                          </div>
                          {allBlocks.some(b => b.isRecurring && b.specificDate) && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Starting from {allBlocks.find(b => b.specificDate)?.specificDate?.toLocaleDateString()}
                            </p>
                          )}
                        </div>

                        <div className="text-sm text-muted-foreground">
                          <strong>Tip:</strong> Now you know how it works! You can add or change availability
                          directly in Google Calendar anytime. Just select "<strong>{calendarName}</strong>" as the calendar.
                        </div>
                      </>
                    ) : (
                      // Not all detected - show simple reminder
                      <Alert>
                        <AlertDescription>
                          <p className="mb-2">
                            Don't forget to add your availability to Google Calendar!
                          </p>
                          <p className="text-muted-foreground">
                            You can add or change availability directly in Google Calendar anytime.
                            Just select "<strong>{calendarName}</strong>" as the calendar when creating events.
                          </p>
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="flex justify-center pt-4">
              <Button onClick={resetCreateDialog}>
                Done
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>

      {/* Fullscreen Calendar View - Shows after calendar is created */}
      {createStep === 'add-blocks' && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          {/* Top Header Bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
            <h1 className="text-lg font-semibold truncate">{calendarName}</h1>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setCreateStep('choice');
                resetCreateDialog();
              }}
            >
              Done
            </Button>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 relative flex flex-col">
            {/* Calendar Embed Container */}
            <div className="flex-1 relative">
              <iframe
                ref={iframeRef}
                key={calendarKey}
                src={getCalendarEmbedUrl(
                  createdCalendarId,
                  selectedAvailabilityType === 'specific' ? specificDate : weeklyStartDate,
                  calendarViewMode
                )}
                className="w-full h-full"
                style={{ border: 'none' }}
                frameBorder="0"
              />

              {/* Floating Controls - ALWAYS visible in fullscreen view */}
              <div
                className="absolute z-10 flex items-center gap-2"
                style={{
                  top: '10px',
                  right: '12px',
                }}
              >
                {/* View Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="bg-white shadow-sm">
                      {calendarViewMode === 'WEEK' && 'Week'}
                      {calendarViewMode === 'MONTH' && 'Month'}
                      {calendarViewMode === 'AGENDA' && 'Agenda'}
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setCalendarViewMode('WEEK')}>
                      Week
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCalendarViewMode('MONTH')}>
                      Month
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCalendarViewMode('AGENDA')}>
                      Agenda
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Edit Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white shadow-sm"
                  onClick={() => {
                    setEditGuideStep('waiting-click');
                    startEditGuideListener();
                  }}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>

                {/* Add Availability Button */}
                <Button
                  size="sm"
                  className="shadow-sm"
                  onClick={() => {
                    console.log('[Add Availability Button] Clicked');
                    setIsCreatingAvailability(false);  // Reset in case stuck
                    setSelectedAvailabilityType(null);
                    setAvailabilityStep('choose-type');
                  }}
                >
                  + Add Availability
                </Button>
              </div>

              {/* Bottom Tip - only in success state */}
              {availabilityStep === 'success' && showTip && (
                <div className="absolute bottom-4 right-4 max-w-md z-10">
                  <div className="bg-white/95 backdrop-blur rounded-lg px-4 py-3 shadow-lg border relative">
                    <button
                      onClick={() => setShowTip(false)}
                      className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label="Dismiss tip"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <p className="text-sm text-muted-foreground pr-6">
                      💡 You can also add availability directly in Google Calendar. In the event details, select "<strong>{calendarName}</strong>" as the calendar. To edit or delete, click any block above.
                    </p>
                  </div>
                </div>
              )}

            {/* Modal Overlay - covers entire screen including header */}
            {(availabilityStep === 'choose-type' ||
              availabilityStep === 'set-availability' ||
              availabilityStep === 'added') && (
              <div
                className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
                onClick={(e) => {
                  if (e.target === e.currentTarget && availabilityStep === 'choose-type') {
                    setAvailabilityStep('success');
                  }
                }}
              >

                  {/* Step: Choose Type */}
                  {availabilityStep === 'choose-type' && (
                    <div
                      className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Close button */}
                      <button
                        onClick={() => setAvailabilityStep('success')}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label="Close"
                      >
                        <X className="h-5 w-5" />
                      </button>

                      <h2 className="text-xl font-semibold mb-2 pr-8">
                        {isFirstAvailability
                          ? "Let's add your first availability block"
                          : "Add availability"
                        }
                      </h2>
                      <p className="text-muted-foreground mb-6">
                        {isFirstAvailability
                          ? "This tells customers when your services are open to book."
                          : "Add another time block when customers can book."
                        }
                      </p>

                      <div className="space-y-3">
                      {/* Weekly Option */}
                      <button
                        onClick={() => {
                          setSelectedAvailabilityType('weekly');
                          setAvailabilityType('weekly');
                          setAvailabilityStep('set-availability');
                        }}
                        className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-primary hover:bg-primary/5 transition-all text-left"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">📅</span>
                          <div>
                            <p className="font-medium">Weekly Schedule</p>
                            <p className="text-sm text-muted-foreground">
                              Hours that repeat every week
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              e.g., "Mon-Fri 9am-5pm"
                            </p>
                          </div>
                        </div>
                      </button>

                      {/* Specific Option */}
                      <button
                        onClick={() => {
                          setSelectedAvailabilityType('specific');
                          setAvailabilityType('specific');
                          setAvailabilityStep('set-availability');
                        }}
                        className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-primary hover:bg-primary/5 transition-all text-left"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">📌</span>
                          <div>
                            <p className="font-medium">Specific Day/Time</p>
                            <p className="text-sm text-muted-foreground">
                              One-off availability for a particular date
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              e.g., "Sat Dec 14, 10am-2pm"
                            </p>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                  {/* Step: Set Availability */}
                  {availabilityStep === 'set-availability' && (
                    <div
                      className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Close button */}
                      <button
                        onClick={() => setAvailabilityStep('success')}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label="Close"
                      >
                        <X className="h-5 w-5" />
                      </button>

                      <h2 className="text-xl font-semibold mb-4 pr-8">
                        Set your availability
                      </h2>

                    {/* Weekly Form */}
                    {selectedAvailabilityType === 'weekly' && (
                      <div className="space-y-4">
                        {/* Days Selection */}
                        <div>
                          <label className="block text-sm font-medium mb-2">Which days?</label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { code: 'MO', label: 'Mon' },
                              { code: 'TU', label: 'Tue' },
                              { code: 'WE', label: 'Wed' },
                              { code: 'TH', label: 'Thu' },
                              { code: 'FR', label: 'Fri' },
                              { code: 'SA', label: 'Sat' },
                              { code: 'SU', label: 'Sun' },
                            ].map((day) => (
                              <button
                                key={day.code}
                                onClick={() => {
                                  setAvailabilityDays(prev =>
                                    prev.includes(day.code)
                                      ? prev.filter(d => d !== day.code)
                                      : [...prev, day.code]
                                  );
                                }}
                                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                  availabilityDays.includes(day.code)
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-white border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                {day.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Time Selection */}
                        <div>
                          <label className="block text-sm font-medium mb-2">What time?</label>
                          <div className="flex items-center gap-2">
                            <select
                              value={startTime}
                              onChange={(e) => setStartTime(e.target.value)}
                              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              {timeOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <span className="text-muted-foreground">to</span>
                            <select
                              value={endTime}
                              onChange={(e) => setEndTime(e.target.value)}
                              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              {timeOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Break Option */}
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="hasBreak-modal"
                            checked={hasBreak}
                            onChange={(e) => setHasBreak(e.target.checked)}
                          >
                            I have a break
                          </Checkbox>
                        </div>

                        {hasBreak && (
                          <div className="flex items-center gap-2 pl-6">
                            <select
                              value={breakStartTime}
                              onChange={(e) => setBreakStartTime(e.target.value)}
                              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              {timeOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <span className="text-muted-foreground">to</span>
                            <select
                              value={breakEndTime}
                              onChange={(e) => setBreakEndTime(e.target.value)}
                              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              {timeOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Starting Date */}
                        <div>
                          <label className="block text-sm font-medium mb-2">Starting from</label>
                          <input
                            type="date"
                            value={weeklyStartDate ? weeklyStartDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                            onChange={(e) => setWeeklyStartDate(e.target.value ? new Date(e.target.value) : new Date())}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-auto max-w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {/* Specific Date Form */}
                    {selectedAvailabilityType === 'specific' && (
                      <div className="space-y-4">
                        {/* Date Selection */}
                        <div>
                          <label className="block text-sm font-medium mb-2">Which date?</label>
                          <input
                            type="date"
                            value={specificDate ? specificDate.toISOString().split('T')[0] : ''}
                            onChange={(e) => setSpecificDate(e.target.value ? new Date(e.target.value) : undefined)}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-auto max-w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                          />
                        </div>

                        {/* Time Selection */}
                        <div>
                          <label className="block text-sm font-medium mb-2">What time?</label>
                          <div className="flex items-center gap-2">
                            <select
                              value={startTime}
                              onChange={(e) => setStartTime(e.target.value)}
                              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              {timeOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <span className="text-muted-foreground">to</span>
                            <select
                              value={endTime}
                              onChange={(e) => setEndTime(e.target.value)}
                              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              {timeOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 mt-6">
                      <Button
                        variant="outline"
                        onClick={() => setAvailabilityStep('choose-type')}
                      >
                        Back
                      </Button>
                      <Button
                        className="flex-1"
                        disabled={(selectedAvailabilityType === 'specific' && !specificDate) || isCreatingAvailability}
                        onClick={createAvailabilityDirect}
                      >
                        {isCreatingAvailability ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Adding...
                          </>
                        ) : (
                          'Add Availability'
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                  {/* Step: Added - Loading/Success/Error states */}
                  {availabilityStep === 'added' && (
                    <div
                      className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 relative text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* LOADING state */}
                      {addedModalStatus === 'loading' && (
                        <>
                          <div className="mb-4">
                            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                              <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                            </div>
                          </div>
                          <h2 className="text-xl font-semibold mb-2">Adding availability...</h2>
                          <p className="text-muted-foreground">
                            Please wait while we update your calendar.
                          </p>
                        </>
                      )}

                      {/* SUCCESS state */}
                      {addedModalStatus === 'success' && (
                        <>
                          <div className="mb-4">
                            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                              <Check className="h-8 w-8 text-green-600" />
                            </div>
                          </div>
                          <h2 className="text-xl font-semibold mb-2">Added!</h2>
                          <p className="text-muted-foreground mb-6">
                            Your availability has been added to the calendar.
                          </p>
                          <div className="flex gap-3 justify-center">
                            <button
                              onClick={() => setAvailabilityStep('choose-type')}
                              className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              Add More
                            </button>
                            <button
                              onClick={() => {
                                setIsFirstAvailability(false);
                                setAvailabilityStep('success');
                              }}
                              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                            >
                              Done
                            </button>
                          </div>
                        </>
                      )}

                      {/* ERROR state */}
                      {addedModalStatus === 'error' && (
                        <>
                          <div className="mb-4">
                            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                              <AlertCircle className="h-8 w-8 text-red-600" />
                            </div>
                          </div>
                          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
                          <p className="text-muted-foreground mb-6">
                            {addedModalError || 'Failed to add availability.'}
                          </p>
                          <div className="flex gap-3 justify-center">
                            <button
                              onClick={() => setAvailabilityStep('set-availability')}
                              className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              Go Back
                            </button>
                            <button
                              onClick={() => {
                                setAvailabilityStep('set-availability');
                                setTimeout(() => createAvailabilityDirect(), 100);
                              }}
                              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                            >
                              Try Again
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                </div>
              )}

            {/* Edit Guide - Floating Helper (top-left, draggable) */}
            {editGuideStep !== 'idle' && (
              <div
                className="absolute z-20 bg-white rounded-lg shadow-lg border p-4 max-w-xs cursor-move select-none"
                style={{
                  top: `${65 + editHelperPosition.y}px`,
                  left: `${22 + editHelperPosition.x}px`
                }}
                onMouseDown={handleDragStart}
              >
                {/* Close button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditGuideStep('idle');
                    if (editGuideCleanupRef.current) {
                      editGuideCleanupRef.current();
                    }
                  }}
                  className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>

                {editGuideStep === 'waiting-click' && (
                  <div className="pr-6">
                    <p className="font-medium mb-1">Edit availability</p>
                    <p className="text-sm text-muted-foreground">
                      Click any availability block in the calendar.
                    </p>
                  </div>
                )}

                {editGuideStep === 'clicked' && (
                  <div className="pr-6 space-y-3">
                    {/* Step 1 - completed */}
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <Check className="h-3 w-3 text-green-600" />
                      </div>
                      <p className="text-sm text-muted-foreground line-through">
                        Click any availability block
                      </p>
                    </div>

                    {/* Step 2 - current */}
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-white">2</span>
                      </div>
                      <div className="text-sm space-y-2">
                        <p>
                          In the popup, click <strong>"More details"</strong>
                        </p>
                        <p className="text-muted-foreground">
                          This opens Google Calendar in a new tab.
                        </p>
                        <p className="text-muted-foreground">
                          Use <Pencil className="h-3 w-3 inline mx-0.5" /> to edit or <Trash2 className="h-3 w-3 inline mx-0.5" /> to delete.
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditGuideStep('idle');
                      }}
                    >
                      Got it
                    </Button>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Remove Schedule Confirmation Dialog */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{calendarToRemove?.name}"? This will unlink all services from this calendar, but the calendar itself will remain in Google Calendar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveSchedule}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Schedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Services Dialog */}
      <Dialog open={editServicesDialogOpen} onOpenChange={setEditServicesDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Services</DialogTitle>
            <DialogDescription>
              Update which services use "{calendarToEdit?.name}"
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">
              Select Services
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Choose which services will use this availability schedule
            </p>
            <div className="space-y-2 border rounded-lg p-3 max-h-60 overflow-y-auto">
              {services.length === 0 ? (
                <div className="text-sm text-muted-foreground py-2">
                  No services available
                </div>
              ) : (
                services.map((service) => {
                  const serviceId = service.serviceID || service.serviceName;
                  const isChecked = editSelectedServices.includes(serviceId);
                  return (
                    <div
                      key={serviceId}
                      className="flex items-center space-x-3 py-2 px-2 rounded hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        if (isChecked) {
                          setEditSelectedServices(editSelectedServices.filter(id => id !== serviceId));
                        } else {
                          setEditSelectedServices([...editSelectedServices, serviceId]);
                        }
                      }}
                    >
                      <Checkbox
                        id={`edit-service-${serviceId}`}
                        checked={isChecked}
                        onCheckedChange={() => {}}
                      />
                      <label
                        htmlFor={`edit-service-${serviceId}`}
                        className="text-sm font-medium leading-none cursor-pointer flex-1"
                        onClick={(e) => e.preventDefault()}
                      >
                        {service.serviceName}
                      </label>
                    </div>
                  );
                })
              )}
            </div>
            {editSelectedServices.length > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                {editSelectedServices.length} service{editSelectedServices.length === 1 ? '' : 's'} selected
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setEditServicesDialogOpen(false);
                setCalendarToEdit(null);
                setEditSelectedServices([]);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEditedServices}
              disabled={editSelectedServices.length === 0}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
