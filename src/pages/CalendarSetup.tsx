import { useState, useEffect } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar, CheckCircle, AlertCircle, Loader2, ExternalLink, Copy, Info, Link as LinkIcon, X, MoreVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getCalendarEmbedLink, getCalendarEditLink, getCalendarViewLink } from '@/lib/calendar-links';
import {
  fetchUpcomingBookings,
  fetchAvailableSlots,
  formatEventDate,
  formatEventTime,
  type CalendarEvent
} from '@/lib/calendar-data';

export default function CalendarSetup({ storeId }: { storeId: string }) {
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [calendarInputs, setCalendarInputs] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // Auto-create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createStep, setCreateStep] = useState<'choice' | 'general' | 'specific' | 'success'>('choice');
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

  useEffect(() => {
    loadStore();
  }, [storeId]);

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
    for (const [calId, svcId] of Object.entries(mappings)) {
      if (svcId === serviceId) return calId;
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

  // Auto-create calendar handler
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

    setCreatingCalendar(true);

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

      // Success!
      setCreatedCalendarId(data.calendarId);
      setCreateStep('success');

      // Reload store to show new mapping
      await loadStore();

      toast({
        title: 'Calendar created!',
        description: `${calendarName} is ready for availability events`,
      });

    } catch (error: any) {
      console.error('Error creating calendar:', error);
      toast({
        title: 'Failed to create calendar',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setCreatingCalendar(false);
    }
  }

  // Reset dialog state
  const resetCreateDialog = () => {
    setCreateDialogOpen(false);
    setCreateStep('choice');
    setSelectedType(null);
    setCalendarName('');
    setSelectedServices([]);
    setCreatedCalendarId('');
    setCreatingCalendar(false);
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
      // First, unlink all current services
      for (const serviceId of calendarToEdit.serviceIds) {
        await unlinkCalendar(serviceId);
      }

      // Then, link the new selected services
      for (const serviceId of editSelectedServices) {
        await linkCalendar(serviceId, calendarToEdit.calendarId);
      }

      toast({
        title: 'Services updated!',
        description: 'Calendar services have been updated successfully',
      });

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

  // Helper: Get dynamic placeholder text for schedule name
  const getCalendarNamePlaceholder = () => {
    if (createStep === 'specific' && selectedServices.length === 1) {
      const service = services.find(s => (s.serviceID || s.serviceName) === selectedServices[0]);
      return service ? `${service.serviceName} - Availability` : 'Enter schedule name';
    }
    return 'Enter schedule name';
  };

  // Dialog Component - Create Availability Schedule
  const CreateCalendarDialog = () => {
    console.log('Dialog opened - Services:', services.length, 'Selected services:', selectedServices);

    return (
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
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
                  onChange={(e) => setCalendarName(e.target.value)}
                  placeholder="e.g., Store Hours"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Name this availability schedule
                </p>
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
                            console.log('General - Checkbox clicked:', service.serviceName, 'Current checked:', isChecked, 'Current selection:', selectedServices);
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
                            onCheckedChange={(checked) => {
                              console.log('General - onCheckedChange:', service.serviceName, checked);
                            }}
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
                disabled={creatingCalendar}
              >
                Back
              </Button>
              <Button
                onClick={handleCreateCalendar}
                disabled={creatingCalendar || selectedServices.length === 0 || !calendarName.trim()}
              >
                {creatingCalendar ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Calendar'
                )}
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
                  onChange={(e) => setCalendarName(e.target.value)}
                  placeholder="e.g., Weekend Classes"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Name this availability schedule
                </p>
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
                            console.log('Specific - Service row clicked:', service.serviceName);
                            const newSelection = isChecked
                              ? selectedServices.filter(id => id !== serviceId)
                              : [...selectedServices, serviceId];
                            setSelectedServices(newSelection);

                            // Auto-fill name ONLY when exactly 1 service selected
                            if (newSelection.length === 1) {
                              const selectedService = services.find(s => (s.serviceID || s.serviceName) === newSelection[0]);
                              if (selectedService) {
                                setCalendarName(`${selectedService.serviceName} - Availability`);
                              }
                            } else if (newSelection.length === 0) {
                              setCalendarName(''); // Clear name if no services selected
                            }
                          }}
                        >
                          <Checkbox
                            id={`specific-service-${serviceId}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              console.log('Specific - Checkbox changed:', service.serviceName, checked);
                            }}
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
                disabled={creatingCalendar}
              >
                Back
              </Button>
              <Button
                onClick={handleCreateCalendar}
                disabled={creatingCalendar || selectedServices.length === 0 || !calendarName.trim()}
              >
                {creatingCalendar ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Calendar'
                )}
              </Button>
            </div>
          </>
        )}


        {/* STEP 3: Success with Guidance */}
        {createStep === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Calendar Created!
              </DialogTitle>
              <DialogDescription>
                "{calendarName}" has been created and shared with your email
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Alert>
                <div className="space-y-2">
                  <div className="font-semibold">Next: Add Your Available Time Slots</div>
                  <div className="text-sm space-y-2">
                    <p className="font-medium">When adding events in Google Calendar:</p>
                    <ol className="list-decimal list-inside ml-2 space-y-1">
                      <li>Click "+ Create" or click on a time slot</li>
                      <li><strong>Important:</strong> Select the calendar "<span className="font-semibold">{calendarName}</span>" from the dropdown</li>
                      <li>Add your available time (e.g., "Mon-Fri 9 AM - 5 PM")</li>
                      <li>Make it recurring if needed</li>
                      <li>Save the event</li>
                    </ol>

                    {selectedType === 'general' ? (
                      <p className="mt-2">All {selectedServices.length} service{selectedServices.length === 1 ? '' : 's'} will become bookable during the times you add to this calendar.</p>
                    ) : (
                      <p className="mt-2">Your {selectedServices.length} selected service{selectedServices.length === 1 ? '' : 's'} will become bookable during the times you add to this calendar.</p>
                    )}
                  </div>
                </div>
              </Alert>

              {/* Single button - use regular calendar view */}
              <Button
                onClick={() => {
                  window.open(getCalendarViewLink(createdCalendarId), '_blank');
                  resetCreateDialog();
                }}
                className="w-full"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open in Google Calendar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
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
              <Button onClick={() => setCreateDialogOpen(true)}>
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

                  const calendarGroups: Record<string, string[]> = {};
                  Object.entries(mappings).forEach(([calendarId, serviceId]) => {
                    if (!calendarGroups[calendarId]) {
                      calendarGroups[calendarId] = [];
                    }
                    calendarGroups[calendarId].push(serviceId as string);
                  });

                  return Object.entries(calendarGroups).map(([calendarId, serviceIds]) => {
                    const linkedServices = services.filter(s => {
                      const sid = s.serviceID || s.serviceName;
                      return serviceIds.includes(sid);
                    });

                    const calendarName = linkedServices.length === 1
                      ? `${linkedServices[0].serviceName} - Availability`
                      : linkedServices.length > 1
                        ? `Shared Schedule (${linkedServices.length} services)`
                        : 'Availability Schedule';

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
                                onClick={() => window.open(
                                  getCalendarEmbedLink(calendarId, { mode: 'WEEK' }),
                                  '_blank'
                                )}
                              >
                                View Schedule
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
                                  setCalendarToEdit({ calendarId, serviceIds, name: calendarName });
                                  setEditSelectedServices([...serviceIds]);
                                  setEditServicesDialogOpen(true);
                                }}
                              >
                                Edit Services
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  setCalendarToRemove({ calendarId, serviceIds, name: calendarName });
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
                onClick={() => setCreateDialogOpen(true)}
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

      {/* Create Calendar Dialog */}
      <CreateCalendarDialog />

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
