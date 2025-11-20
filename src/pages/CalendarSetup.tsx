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
                  Select Services
                  <span className="text-xs text-muted-foreground ml-2">(can select multiple)</span>
                </label>
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
                  <p className="text-xs text-muted-foreground mt-2">
                    {selectedServices.length} service{selectedServices.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Calendar Name
                </label>
                <Input
                  value={calendarName}
                  onChange={(e) => setCalendarName(e.target.value)}
                  placeholder="e.g., Store Hours"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Tip: Use recurring events in Google Calendar for regular hours (e.g., Mon-Fri 9 AM - 5 PM)
                </p>
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
                Create a calendar for one or more services with unique hours
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Select Service(s)
                  <span className="text-xs text-muted-foreground ml-2">(can select multiple)</span>
                </label>
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
                            console.log('Specific - Checkbox clicked:', service.serviceName, 'Current checked:', isChecked, 'Current selection:', selectedServices);
                            const newSelection = isChecked
                              ? selectedServices.filter(id => id !== serviceId)
                              : [...selectedServices, serviceId];
                            setSelectedServices(newSelection);

                            // Auto-fill name if only one service selected
                            if (newSelection.length === 1) {
                              const selectedService = services.find(s => (s.serviceID || s.serviceName) === newSelection[0]);
                              if (selectedService) {
                                setCalendarName(`${selectedService.serviceName} - Availability`);
                              }
                            }
                          }}
                        >
                          <Checkbox
                            id={`specific-service-${serviceId}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              console.log('Specific - onCheckedChange:', service.serviceName, checked);
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
                  <p className="text-xs text-muted-foreground mt-2">
                    {selectedServices.length} service{selectedServices.length > 1 ? 's' : ''} selected
                  </p>
                )}
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
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Perfect for: Services with unique schedules like weekend-only classes or special workshops
                </p>
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
                        <p>Add events to this calendar to define when your {selectedServices.length} selected service{selectedServices.length > 1 ? 's are' : ' is'} available for booking.</p>
                        <p className="font-medium mt-2">Example:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1">
                          <li>Add a recurring event "Monday-Friday, 9 AM - 5 PM"</li>
                          <li>All {selectedServices.length} service{selectedServices.length > 1 ? 's' : ''} become bookable during these hours</li>
                          <li>Remove or edit events anytime to adjust availability</li>
                        </ul>
                      </>
                    ) : (
                      <>
                        <p>Add events to this calendar to define when {selectedServices.length > 1 ? 'these services are' : 'this service is'} available for booking.</p>
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
                Define when customers can book your services by creating availability schedules
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
              'Set Up Booking Availability'
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
            <div className="flex items-center gap-2">
              <CardTitle>Service Availability</CardTitle>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Active
              </Badge>
            </div>
            <CardDescription>
              Set up time slots when services can be booked
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Customer Bookings Calendar Info */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-muted-foreground">Customer Bookings Calendar</h4>
          <p className="text-sm text-muted-foreground">
            View all confirmed bookings
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

        {/* Availability Schedules Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Availability Schedules</h4>
          </div>

          {services.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No services found. Add services to your Google Sheet first.
              </AlertDescription>
            </Alert>
          ) : (
            <>
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
                            No availability schedule
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
                              title="Unlink"
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

              {/* Add Availability Button */}
              <Button
                onClick={() => setCreateDialogOpen(true)}
                variant="outline"
                className="w-full"
              >
                + Add Availability
              </Button>
            </>
          )}
        </div>
      </CardContent>

      {/* Create Calendar Dialog */}
      <CreateCalendarDialog />
    </Card>
  );
}
