import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, CheckCircle, AlertCircle, Loader2, ExternalLink, Copy, Info, Link as LinkIcon, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [createdCalendarId, setCreatedCalendarId] = useState('');
  const [creatingCalendar, setCreatingCalendar] = useState(false);

  useEffect(() => {
    loadStore();
  }, [storeId]);

  async function loadStore() {
    const { data } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();

    setStore(data);

    if (data?.invite_calendar_id) {
      loadServices();
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

  // Helper: Get Google Calendar settings link
  const getGoogleCalendarLink = (calendarId: string) => {
    return `https://calendar.google.com/calendar/u/0/r/settings/calendar/${encodeURIComponent(calendarId)}`;
  };

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

    if (selectedType === 'specific' && !selectedServiceId) {
      toast({
        title: 'Service required',
        description: 'Please select a service',
        variant: 'destructive',
      });
      return;
    }

    setCreatingCalendar(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const serviceIds = selectedType === 'general' ? selectedServices : [selectedServiceId];

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
    setSelectedServiceId('');
    setCreatedCalendarId('');
    setCreatingCalendar(false);
  };

  // Helper: Get dynamic placeholder text for calendar name
  const getCalendarNamePlaceholder = () => {
    if (createStep === 'specific' && selectedServiceId) {
      const service = services.find(s => (s.serviceID || s.serviceName) === selectedServiceId);
      return service ? `${service.serviceName} - Availability` : 'Enter calendar name';
    }
    return 'Enter calendar name';
  };

  // Dialog Component - Create Calendar
  const CreateCalendarDialog = () => (
    <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
      <DialogContent className="max-w-2xl">
        {/* STEP 1: Choice */}
        {createStep === 'choice' && (
          <>
            <DialogHeader>
              <DialogTitle>Create Availability Calendar</DialogTitle>
              <DialogDescription>
                Choose how you want to set up your service availability
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <button
                onClick={() => {
                  setSelectedType('general');
                  setCreateStep('general');
                  setCalendarName('Store Hours');
                }}
                className="w-full p-4 text-left border rounded-lg hover:border-primary transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary mt-1">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">General Availability</h3>
                    <p className="text-sm text-muted-foreground">
                      For multiple services with the same schedule (e.g., "Store Hours" covering Pottery, Wheel Throwing, Sculpting)
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  setSelectedType('specific');
                  setCreateStep('specific');
                }}
                className="w-full p-4 text-left border rounded-lg hover:border-primary transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary mt-1">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">Specific Service</h3>
                    <p className="text-sm text-muted-foreground">
                      For a service with unique hours (e.g., weekend-only classes or special workshops)
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
                  Calendar Name
                </label>
                <Input
                  value={calendarName}
                  onChange={(e) => setCalendarName(e.target.value)}
                  placeholder="e.g., Store Hours"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Select Services (can select multiple)
                </label>
                <div className="space-y-2 border rounded-lg p-3 max-h-60 overflow-y-auto">
                  {services.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-2">
                      No services available
                    </div>
                  ) : (
                    services.map((service) => {
                      const serviceId = service.serviceID || service.serviceName;
                      return (
                        <div key={serviceId} className="flex items-center space-x-2">
                          <Checkbox
                            id={`service-${serviceId}`}
                            checked={selectedServices.includes(serviceId)}
                            onCheckedChange={(checked) => {
                              console.log('Service checkbox changed:', service.serviceName, checked);
                              if (checked) {
                                setSelectedServices([...selectedServices, serviceId]);
                              } else {
                                setSelectedServices(selectedServices.filter(id => id !== serviceId));
                              }
                            }}
                          />
                          <label
                            htmlFor={`service-${serviceId}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                          >
                            {service.serviceName}
                          </label>
                        </div>
                      );
                    })
                  )}
                </div>
                {selectedServices.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {selectedServices.length} service{selectedServices.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              <Alert>
                <div className="text-sm">
                  💡 <strong>Tip:</strong> Use recurring events in Google Calendar for regular hours (e.g., Mon-Fri 9 AM - 5 PM)
                </div>
              </Alert>
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
                Create a calendar for one service with unique hours
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Which service?
                </label>
                <Select
                  value={selectedServiceId}
                  onValueChange={(value) => {
                    setSelectedServiceId(value);
                    const service = services.find(s => (s.serviceID || s.serviceName) === value);
                    if (service) {
                      setCalendarName(`${service.serviceName} - Availability`);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => {
                      const serviceId = service.serviceID || service.serviceName;
                      return (
                        <SelectItem key={serviceId} value={serviceId}>
                          {service.serviceName}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Calendar Name
                </label>
                <Input
                  value={calendarName}
                  onChange={(e) => setCalendarName(e.target.value)}
                  placeholder={getCalendarNamePlaceholder()}
                />
              </div>

              <Alert>
                <div className="text-sm">
                  💡 <strong>Perfect for:</strong> Services with unique schedules like weekend-only classes or special workshops
                </div>
              </Alert>
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
                disabled={creatingCalendar || !selectedServiceId || !calendarName.trim()}
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
                Calendar Created Successfully!
              </DialogTitle>
              <DialogDescription>
                "{calendarName}" has been created and shared with your email
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Alert>
                <div className="space-y-2">
                  <div className="font-semibold">Next: Add Your Available Times</div>
                  <div className="text-sm space-y-1">
                    {selectedType === 'general' ? (
                      <>
                        <p>Add events to this calendar to define when your {selectedServices.length} selected services are available for booking.</p>
                        <p className="font-medium mt-2">Example:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1">
                          <li>Add a recurring event "Monday-Friday, 9 AM - 5 PM"</li>
                          <li>All {selectedServices.length} services become bookable during these hours</li>
                          <li>Remove or edit events anytime to adjust availability</li>
                        </ul>
                      </>
                    ) : (
                      <>
                        <p>Add events to this calendar to define when this specific service is available for booking.</p>
                        <p className="font-medium mt-2">Example:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1">
                          <li>Add "Saturday 10 AM - 4 PM" for weekend-only classes</li>
                          <li>Add "Dec 15, 6 PM - 9 PM" for a special workshop</li>
                          <li>Events in this calendar = bookable time slots</li>
                        </ul>
                      </>
                    )}
                  </div>
                </div>
              </Alert>

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    window.open(getGoogleCalendarLink(createdCalendarId), '_blank');
                  }}
                  className="flex-1"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in Google Calendar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(getGoogleCalendarLink(createdCalendarId));
                    toast({
                      title: 'Link copied!',
                      description: 'Calendar link copied to clipboard',
                    });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={resetCreateDialog}>
                Done
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );

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
              <CardTitle>Calendar Booking</CardTitle>
              <CardDescription>
                Enable booking through Google Calendar availability
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Set up calendar booking</AlertTitle>
            <AlertDescription>
              This will create a "Customer Bookings" calendar where confirmed bookings appear as events.
              You'll be able to link your services to availability calendars in the next step.
            </AlertDescription>
          </Alert>
          <Button onClick={setupCalendar} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up...
              </>
            ) : (
              'Set Up Calendar Booking'
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
              Manage service availability calendars
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Customer Bookings Calendar Info */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Customer Bookings Calendar</h4>
          <p className="text-sm text-muted-foreground">
            View all confirmed bookings in your Google Calendar
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(
              `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(store.invite_calendar_id)}`,
              '_blank'
            )}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open in Google Calendar
          </Button>
        </div>

        <Separator />

        {/* Services Section */}
        {services.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No services found. Add services to your Google Sheet first, then come back here to link them to availability calendars.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Service Availability</h4>
              <Button onClick={() => setCreateDialogOpen(true)} size="sm">
                + Add Calendar
              </Button>
            </div>

            {/* Service List */}
            <div className="space-y-2">
              {services.map((service) => {
                const serviceId = service.serviceID || service.serviceName;
                const linkedCalendar = getLinkedCalendar(serviceId);
                return (
                  <div key={serviceId} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{service.serviceName}</div>
                      {linkedCalendar ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Linked
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">{linkedCalendar.substring(0, 30)}...</span>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground mt-1">
                          Not linked to availability calendar
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {linkedCalendar && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(
                              `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(linkedCalendar)}`,
                              '_blank'
                            )}
                            title="Open calendar"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => unlinkCalendar(serviceId)}
                            title="Unlink calendar"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      {/* Create Calendar Dialog */}
      <CreateCalendarDialog />
    </Card>
  );
}
