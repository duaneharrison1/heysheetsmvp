import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Calendar, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function CalendarSetup({ storeId }: { storeId: string }) {
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [calendars, setCalendars] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [calendarIdInput, setCalendarIdInput] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [creatingForService, setCreatingForService] = useState<string | null>(null);
  const { toast } = useToast();

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
      loadCalendars();
      loadServices();

      // Parse calendar mappings
      if (data.calendar_mappings) {
        const parsed = typeof data.calendar_mappings === 'string'
          ? JSON.parse(data.calendar_mappings)
          : data.calendar_mappings;
        setMappings(parsed);
      }
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

  async function loadCalendars() {
    try {
      const { data } = await supabase.functions.invoke('link-calendar', {
        body: { storeId, action: 'list' },
      });

      if (data?.success) {
        setCalendars(data.calendars || []);
      }
    } catch (error) {
      console.error('Failed to load calendars:', error);
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
    try {
      const { data, error } = await supabase.functions.invoke('link-calendar', {
        body: {
          storeId,
          serviceId,
          calendarId,
          action: 'link',
        },
      });

      if (error) throw error;

      toast({
        title: 'Calendar linked!',
        description: `Service is now available for booking`,
      });

      loadStore();
    } catch (error: any) {
      toast({
        title: 'Link failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  async function unlinkCalendar(calendarId: string) {
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
        description: 'Service is no longer available for booking',
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

  async function subscribeToCalendar() {
    if (!calendarIdInput.trim()) {
      toast({
        title: 'Calendar ID required',
        description: 'Please enter a calendar ID',
        variant: 'destructive',
      });
      return;
    }

    setSubscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke('link-calendar', {
        body: {
          storeId,
          calendarId: calendarIdInput.trim(),
          action: 'subscribe',
        },
      });

      if (error) throw error;

      toast({
        title: 'Calendar subscribed!',
        description: data.message || 'Calendar has been added to your list',
      });

      setCalendarIdInput('');
      // Reload calendars to show the newly subscribed one
      loadCalendars();
    } catch (error: any) {
      toast({
        title: 'Subscribe failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSubscribing(false);
    }
  }

  async function createCalendarForService(serviceId: string, serviceName: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      toast({
        title: 'Error',
        description: 'User email not found',
        variant: 'destructive',
      });
      return;
    }

    setCreatingForService(serviceId);
    try {
      const { data, error } = await supabase.functions.invoke('link-calendar', {
        body: {
          storeId,
          serviceId,
          serviceName,
          ownerEmail: user.email,
          action: 'create',
        },
      });

      if (error) throw error;

      toast({
        title: 'Calendar created!',
        description: data.message || 'Availability calendar has been created and linked',
      });

      // Reload everything
      loadCalendars();
      loadStore();
    } catch (error: any) {
      toast({
        title: 'Create failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreatingForService(null);
    }
  }

  function getLinkedCalendar(serviceId: string): string | null {
    for (const [calId, svcId] of Object.entries(mappings)) {
      if (svcId === serviceId) return calId;
    }
    return null;
  }

  // Not setup yet
  if (!store?.invite_calendar_id) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="h-6 w-6 text-blue-600" />
          <h3 className="text-lg font-semibold">Enable Calendar Booking</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Set up automatic booking with Google Calendar integration.
          Customers will receive calendar invites and email confirmations automatically.
        </p>
        <Button onClick={setupCalendar} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Setting up...
            </>
          ) : (
            'Set Up Calendar Booking'
          )}
        </Button>
      </Card>
    );
  }

  // Already setup
  return (
    <div className="space-y-6">
      <Card className="p-6 bg-green-50 border-green-200">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle className="h-6 w-6 text-green-600" />
          <h3 className="text-lg font-semibold">Calendar Booking Active</h3>
        </div>
        <p className="text-sm text-gray-700 mb-4">
          Your calendar booking system is set up! Link your service calendars below.
        </p>
        <Button
          variant="outline"
          onClick={() => window.open(
            `https://calendar.google.com/calendar/u/0/r?cid=${store.invite_calendar_id}`,
            '_blank'
          )}
        >
          <Calendar className="h-4 w-4 mr-2" />
          View Customer Bookings
        </Button>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Link Service Calendars</h3>

        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded space-y-3">
          <div>
            <p className="text-sm text-blue-900 mb-3">
              <strong>📅 Recommended: Click "Create Calendar"</strong>
            </p>
            <p className="text-sm text-blue-900 mb-3">
              For each service, click the <strong>"Create Calendar"</strong> button below. This will:
            </p>
            <ul className="text-sm text-blue-900 space-y-1 list-disc list-inside ml-2">
              <li>Create an availability calendar automatically</li>
              <li>Share it with your email so you can manage availability</li>
              <li>Link it to the service instantly</li>
            </ul>
            <p className="text-sm text-blue-700 mt-3 italic">
              Then, add events to the calendar in Google Calendar to mark when the service is available for booking.
            </p>
          </div>

          <div className="pt-3 border-t border-blue-300">
            <label className="text-sm font-medium text-blue-900 block mb-2">
              Advanced: Add Existing Calendar by ID
            </label>
            <p className="text-xs text-blue-700 mb-2">
              Note: Service accounts have limited access to calendars. Use "Create Calendar" above for best results.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Paste calendar ID here (e.g., abc123@group.calendar.google.com)"
                value={calendarIdInput}
                onChange={(e) => setCalendarIdInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    subscribeToCalendar();
                  }
                }}
                disabled={subscribing}
              />
              <Button
                onClick={subscribeToCalendar}
                disabled={subscribing || !calendarIdInput.trim()}
                size="sm"
                variant="outline"
              >
                {subscribing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Subscribing...
                  </>
                ) : (
                  'Subscribe'
                )}
              </Button>
            </div>
          </div>
        </div>

        {services.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No services found. Add services to your Google Sheet first.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {services.map((service) => {
              const serviceId = service.serviceID || service.serviceName;
              const linkedCalendarId = getLinkedCalendar(serviceId);
              const linkedCalendar = calendars.find(c => c.id === linkedCalendarId);

              return (
                <div key={serviceId} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">{service.serviceName}</h4>
                      <p className="text-sm text-gray-600">
                        Capacity: {service.capacity || 'N/A'} | Price: ${service.price || 'N/A'}
                      </p>
                      {linkedCalendar && (
                        <p className="text-sm text-green-600 mt-1">
                          ✓ Linked to: {linkedCalendar.name}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {linkedCalendarId ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(
                              `https://calendar.google.com/calendar/u/0/r?cid=${linkedCalendarId}`,
                              '_blank'
                            )}
                          >
                            <Calendar className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => unlinkCalendar(linkedCalendarId)}
                          >
                            Unlink
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            onClick={() => createCalendarForService(serviceId, service.serviceName)}
                            disabled={creatingForService === serviceId}
                          >
                            {creatingForService === serviceId ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Creating...
                              </>
                            ) : (
                              <>
                                <Calendar className="h-4 w-4 mr-2" />
                                Create Calendar
                              </>
                            )}
                          </Button>
                          <select
                            className="border rounded px-3 py-2 text-sm"
                            onChange={(e) => {
                              if (e.target.value) {
                                linkCalendar(serviceId, e.target.value);
                                e.target.value = ''; // Reset
                              }
                            }}
                            defaultValue=""
                            disabled={creatingForService === serviceId}
                          >
                            <option value="">Or select existing...</option>
                            {calendars.map((cal) => (
                              <option key={cal.id} value={cal.id}>
                                {cal.name}
                              </option>
                            ))}
                          </select>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 pt-6 border-t">
          <Button
            variant="outline"
            onClick={() => {
              loadCalendars();
              toast({
                title: 'Refreshed',
                description: 'Calendar list updated',
              });
            }}
          >
            Refresh Calendar List
          </Button>
        </div>
      </Card>
    </div>
  );
}
