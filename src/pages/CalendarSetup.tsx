import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Calendar, CheckCircle, AlertCircle, Loader2, ExternalLink, Copy, Info, Link as LinkIcon, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function CalendarSetup({ storeId }: { storeId: string }) {
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [calendarInputs, setCalendarInputs] = useState<Record<string, string>>({});
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

  // Already setup - show linking UI
  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Status Section */}
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-3">
            <Calendar className="h-6 w-6 text-green-600" />
            <div>
              <h3 className="text-lg font-semibold">Calendar Booking Management</h3>
              <p className="text-sm text-gray-600">Link services to Google Calendar availability schedules</p>
            </div>
          </div>
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        </div>

        {/* Customer Bookings Link */}
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-green-900">Customer Bookings Calendar</p>
              <p className="text-sm text-green-700">View all confirmed bookings</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(
                `https://calendar.google.com/calendar/u/0/r?cid=${store.invite_calendar_id}`,
                '_blank'
              )}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in Google Calendar
            </Button>
          </div>
        </div>

        <Separator />

        {/* Instructions */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>How to link service calendars</AlertTitle>
          <AlertDescription className="space-y-3 mt-2">
            <div className="space-y-2">
              <p className="font-semibold">Step 1: Create availability calendar in Google Calendar</p>
              <p className="text-sm">Create a calendar for your service (e.g., "Pottery Classes Availability")</p>
            </div>

            <div className="space-y-2">
              <p className="font-semibold">Step 2: Share with service account</p>
              <div className="flex items-center gap-2 bg-white p-2 rounded border">
                <code className="flex-1 text-xs">
                  heysheets-backend@heysheets-mvp.iam.gserviceaccount.com
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText('heysheets-backend@heysheets-mvp.iam.gserviceaccount.com');
                    toast({ title: 'Email copied!' });
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-sm text-orange-600 font-medium">
                ⚠️ Important: Select "Make changes to events" permission (NOT "See all event details")
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-semibold">Step 3: Get calendar ID</p>
              <p className="text-sm">In Google Calendar: Settings → Select your calendar → "Integrate calendar" → Copy Calendar ID</p>
              <p className="text-xs text-gray-500">Example: abc123xyz@group.calendar.google.com</p>
            </div>

            <div className="space-y-2">
              <p className="font-semibold">Step 4: Paste calendar ID below and click Link</p>
            </div>
          </AlertDescription>
        </Alert>

        {/* Service List */}
        {services.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No services found. Add services to your Google Sheet first.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h4 className="font-semibold">Link Services to Calendars</h4>
            {services.map((service) => {
              const serviceId = service.serviceID || service.serviceName;
              const linkedCalendar = getLinkedCalendar(serviceId);
              return (
                <div key={serviceId} className="border rounded-lg p-4">
                  <div className="space-y-3">
                    {/* Service Info */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-semibold">{service.serviceName}</h5>
                        <p className="text-sm text-gray-600">
                          Capacity: {service.capacity} | Price: ${service.price}
                        </p>
                      </div>
                      {linkedCalendar && (
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Linked
                        </Badge>
                      )}
                    </div>

                    {/* Link/Unlink Interface */}
                    {linkedCalendar ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 p-2 bg-gray-50 rounded border">
                          <p className="text-xs text-gray-500">Linked calendar:</p>
                          <p className="text-sm font-mono break-all">{linkedCalendar}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(
                              `https://calendar.google.com/calendar/u/0/r?cid=${linkedCalendar}`,
                              '_blank'
                            )}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => unlinkCalendar(serviceId)}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Unlink
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Paste calendar ID (e.g., abc123@group.calendar.google.com)"
                          value={calendarInputs[serviceId] || ''}
                          onChange={(e) => setCalendarInputs({
                            ...calendarInputs,
                            [serviceId]: e.target.value
                          })}
                          className="flex-1"
                        />
                        <Button
                          onClick={() => linkCalendar(
                            serviceId,
                            calendarInputs[serviceId] || ''
                          )}
                          disabled={!calendarInputs[serviceId]?.trim()}
                        >
                          <LinkIcon className="h-4 w-4 mr-1" />
                          Link
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Troubleshooting */}
        <Alert variant="default">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Troubleshooting</AlertTitle>
          <AlertDescription>
            <p className="text-sm mb-2">If linking fails:</p>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li>Verify you shared with the exact email above</li>
              <li>Confirm permission is "Make changes to events" (not read-only)</li>
              <li>Wait 30 seconds after sharing before linking</li>
              <li>Check calendar ID is correct (no extra spaces)</li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    </Card>
  );
}
