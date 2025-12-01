import { useEffect, useState, useMemo, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { H1, Lead } from '@/components/ui/heading';
import { Select, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { ChartContainer, ChartConfig } from '@/components/ui/chart';
import { UserContext } from '@/components/SidebarLayout';
import { DateRangePicker, DateRange, DateRangePreset, getPresetRange } from '@/components/ui/date-range-picker';
import { useAnalyticsStore } from '@/stores/useAnalyticsStore';
import { Calendar, DollarSign, Users, TrendingUp, Filter, Percent, RefreshCw, BarChart3, Sparkles } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const chartConfig: ChartConfig = {
  bookings: { label: 'Bookings', color: 'hsl(var(--primary))' },
  revenue: { label: 'Revenue', color: 'hsl(var(--chart-2))' },
};

export default function AnalyticsDashboard() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const user = useContext(UserContext);

  const [storesList, setStoresList] = useState<Array<{ id: string; name?: string }>>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(storeId || null);
  const [store, setStore] = useState<any | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>(() => getPresetRange('last_28_days'));
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Zustand store for persistent caching across navigation
  const { getCache, setCache, isCacheValid } = useAnalyticsStore();

  // Load list of stores for selector
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.from('stores').select('id, name').eq('user_id', user.id).order('created_at', { ascending: false });
        if (error) throw error;
        if (cancelled) return;
        setStoresList(data || []);
        // If storeId is provided via URL, use it; otherwise default to first store
        if (storeId) {
          setSelectedStoreId(storeId);
        } else if (Array.isArray(data) && data.length > 0) {
          setSelectedStoreId(data[0].id);
          navigate(`/analytics/${data[0].id}`, { replace: true });
        }
      } catch (err) {
        console.error('Failed to load stores for selector', err);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, storeId]);

  // Keep URL in sync when selector changes
  useEffect(() => {
    if (!selectedStoreId) return;
    if (selectedStoreId !== storeId) navigate(`/analytics/${selectedStoreId}`);
  }, [selectedStoreId]);

  // Load analytics data for selected store
  useEffect(() => {
    if (!selectedStoreId || !user?.id) return;
    let cancelled = false;

    // Check Zustand cache first - use cached data if valid
    if (isCacheValid(selectedStoreId)) {
      const cached = getCache(selectedStoreId);
      if (cached) {
        setStore(cached.store);
        setBookings(cached.bookings);
        setServices(cached.services);
        setLastUpdated(cached.timestamp);
        setLoading(false);
        return;
      }
    }

    (async () => {
      setLoading(true);
      let loadedStore: any = null;
      let loadedBookings: any[] = [];
      let loadedServices: any[] = [];
      
      try {
        const { data: storeData, error: storeError } = await supabase.from('stores').select('*').eq('id', selectedStoreId).eq('user_id', user.id).single();
        if (storeError) {
          console.error('Failed to load store', storeError);
          setLoading(false);
          return;
        }
        if (cancelled) return;
        loadedStore = storeData;
        setStore(storeData);

        if (storeData?.sheet_id) {
          try {
            const { data } = await supabase.functions.invoke('google-sheet', { body: { operation: 'read', storeId: selectedStoreId, tabName: 'Bookings' } });
            if (data?.success && data?.data) {
              loadedBookings = data.data.map((r: any, i: number) => ({
                id: r.id || `b-${i}`,
                service: r.Service || r.service || 'Unknown',
                customer_name: r['Customer Name'] || r.customer_name || r.Name || 'Guest',
                customer_email: r['Customer Email'] || r.customer_email || r.Email || '',
                date: r.Date || r.date || new Date().toISOString().split('T')[0],
                time: r.Time || r.time || '09:00',
                duration: parseInt(r.Duration || r.duration || '60', 10),
                price: parseFloat(r.Price || r.price || '0'),
                status: (r.Status || r.status || 'pending').toLowerCase(),
              }));
              setBookings(loadedBookings);
            } else {
              loadedBookings = generateSampleBookings();
              setBookings(loadedBookings);
            }
          } catch (err) {
            console.error('Error loading bookings', err);
            loadedBookings = generateSampleBookings();
            setBookings(loadedBookings);
          }

          try {
            const { data } = await supabase.functions.invoke('google-sheet', { body: { operation: 'read', storeId: selectedStoreId, tabName: 'Services' } });
            if (data?.success && data?.data) {
              loadedServices = data.data.map((r: any) => ({ name: r.Name || r.name || r.Service || 'Unknown', duration: parseInt(r.Duration || r.duration || '60', 10), price: parseFloat(r.Price || r.price || '0') }));
              setServices(loadedServices);
            } else {
              loadedServices = generateSampleServices();
              setServices(loadedServices);
            }
          } catch (err) {
            console.error('Error loading services', err);
            loadedServices = generateSampleServices();
            setServices(loadedServices);
          }
        } else {
          loadedBookings = generateSampleBookings();
          loadedServices = generateSampleServices();
          setBookings(loadedBookings);
          setServices(loadedServices);
        }
      } catch (err) {
        console.error('Error loading analytics', err);
        loadedBookings = generateSampleBookings();
        loadedServices = generateSampleServices();
        setBookings(loadedBookings);
        setServices(loadedServices);
      } finally {
        if (!cancelled) {
          setLoading(false);
          const now = new Date();
          setLastUpdated(now);
          // Save to Zustand cache
          if (loadedStore) {
            setCache(selectedStoreId, {
              store: loadedStore,
              bookings: loadedBookings,
              services: loadedServices,
            });
          }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [selectedStoreId, user?.id, getCache, setCache, isCacheValid]);

  // Sample data generators
  function generateSampleBookings() {
    const names = ['Haircut', 'Massage', 'Manicure', 'Facial'];
    const statuses = ['completed', 'pending', 'cancelled'];
    const out: any[] = [];
    const now = new Date();
    for (let i = 0; i < 50; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - Math.floor(Math.random() * 30));
      out.push({
        id: `s-${i}`,
        service: names[Math.floor(Math.random() * names.length)],
        customer_name: `Customer ${i}`,
        customer_email: `cust${i}@example.com`,
        date: d.toISOString().split('T')[0],
        time: '10:00',
        duration: [30, 45, 60, 90][Math.floor(Math.random() * 4)],
        price: [25, 50, 75, 100][Math.floor(Math.random() * 4)],
        status: statuses[Math.floor(Math.random() * statuses.length)]
      });
    }
    return out;
  }

  function generateSampleServices() {
    return [
      { name: 'Haircut', duration: 45, price: 50 },
      { name: 'Massage', duration: 60, price: 80 },
      { name: 'Manicure', duration: 30, price: 35 },
      { name: 'Facial', duration: 45, price: 65 },
    ];
  }

  // Filter bookings by date range
  const filteredBookings = useMemo(() => {
    if (!dateRange) return bookings;
    const start = new Date(dateRange.from);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateRange.to);
    end.setHours(23, 59, 59, 999);
    return bookings.filter(b => {
      const bd = new Date(b.date);
      return bd >= start && bd <= end;
    });
  }, [bookings, dateRange]);

  // Calculate statistics
  const stats = useMemo(() => {
    const completed = filteredBookings.filter((b: any) => b.status === 'completed');
    const cancelled = filteredBookings.filter((b: any) => b.status === 'cancelled');
    const pending = filteredBookings.filter((b: any) => b.status === 'pending');
    const customerEmails = filteredBookings.map((b: any) => b.customer_email);
    const uniqueCustomers = new Set(customerEmails);
    const totalRevenue = completed.reduce((s: any, b: any) => s + b.price, 0);
    const avgBookingsPerCustomer = uniqueCustomers.size > 0 ? filteredBookings.length / uniqueCustomers.size : 0;

    // Calculate booking/occupancy rate (assuming 8 working hours, 1 hour slots per day)
    const daysInRange = dateRange ? Math.max(1, Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1) : 1;
    const totalSlots = daysInRange * 8; // 8 slots per day
    const occupancyRate = totalSlots > 0 ? Math.min(100, (filteredBookings.length / totalSlots) * 100) : 0;

    return {
      totalBookings: filteredBookings.length,
      totalRevenue,
      averageBookingValue: completed.length ? totalRevenue / completed.length : 0,
      completedBookings: completed.length,
      cancelledBookings: cancelled.length,
      pendingBookings: pending.length,
      totalCustomers: uniqueCustomers.size,
      avgBookingsPerCustomer,
      occupancyRate,
    };
  }, [filteredBookings, dateRange]);

  // Chart data - bookings over time (fill all dates in range)
  const bookingsOverTime = useMemo(() => {
    if (!dateRange) return [];
    
    // Create a map of existing bookings by date
    const bookingsMap: Record<string, { bookings: number; revenue: number }> = {};
    filteredBookings.forEach((b: any) => {
      const k = b.date;
      if (!bookingsMap[k]) bookingsMap[k] = { bookings: 0, revenue: 0 };
      bookingsMap[k].bookings++;
      if (b.status === 'completed') bookingsMap[k].revenue += b.price;
    });
    
    // Generate all dates in range
    const result: { date: string; dateRaw: string; bookings: number; revenue: number }[] = [];
    const currentDate = new Date(dateRange.from);
    const endDate = new Date(dateRange.to);
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const data = bookingsMap[dateStr] || { bookings: 0, revenue: 0 };
      result.push({
        dateRaw: dateStr,
        date: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        bookings: data.bookings,
        revenue: data.revenue,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Sort by raw date ascending (earliest first)
    return result.sort((a, b) => a.dateRaw.localeCompare(b.dateRaw));
  }, [filteredBookings, dateRange]);

  // Service breakdown
  const serviceBreakdown = useMemo(() => {
    const m: Record<string, { name: string; count: number; revenue: number }> = {};
    filteredBookings.forEach((b: any) => {
      if (!m[b.service]) m[b.service] = { name: b.service, count: 0, revenue: 0 };
      m[b.service].count++;
      if (b.status === 'completed') m[b.service].revenue += b.price;
    });
    return Object.values(m).sort((a, b) => b.count - a.count);
  }, [filteredBookings]);

  // Conversion funnel data (simulated based on bookings)
  const funnelData = useMemo(() => {
    // Simulate funnel stages based on actual bookings
    // In a real scenario, you'd track these events separately
    const totalBookings = filteredBookings.length;
    const visitors = Math.round(totalBookings * 5.2); // Simulate ~20% conversion to chat
    const chatInitiated = Math.round(totalBookings * 2.8); // Simulate ~35% conversion to info/booking
    const infoShared = Math.round(totalBookings * 1.4); // Some share info but don't book
    const booked = totalBookings;

    return [
      { name: 'Store Visitors', value: visitors },
      { name: 'Chat Initiated', value: chatInitiated },
      { name: 'Info Shared', value: infoShared },
      { name: 'Booked', value: booked },
    ];
  }, [filteredBookings]);

  // Handle date range change
  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
  };

  // Handle store selection
  const handleStoreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStoreId = e.target.value;
    if (newStoreId) {
      setSelectedStoreId(newStoreId);
    }
  };

  if (loading) return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-[200px]" />
        <Skeleton className="h-10 w-[280px]" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
            <CardContent><Skeleton className="h-8 w-16" /></CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardHeader><Skeleton className="h-6 w-40" /></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card>
        <Card><CardHeader><Skeleton className="h-6 w-40" /></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card>
      </div>
    </div>
  );

  if (!store) return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {storesList.length > 0 && (
          <div className="min-w-[200px]">
            <Select value={selectedStoreId || ''} onChange={handleStoreChange}>
              {storesList.map(s => <SelectItem key={s.id} value={s.id}>{s.name || s.id}</SelectItem>)}
            </Select>
          </div>
        )}
      </div>
      <div>
        <H1>Analytics Dashboard</H1>
        <p className="text-muted-foreground">Store not found or you don't have access to this store.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <H1>Analytics</H1>
        <Lead>Track bookings, revenue, and customer engagement</Lead>
      </div>

      {/* Header with Store Selector and Date Range Picker */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {storesList.length > 0 && (
            <div className="min-w-[200px]">
              <Select value={selectedStoreId || ''} onChange={handleStoreChange}>
                {storesList.map(s => <SelectItem key={s.id} value={s.id}>{s.name || s.id}</SelectItem>)}
              </Select>
            </div>
          )}
          {lastUpdated && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3" />
              <span>Updated {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
            </div>
          )}
        </div>

        <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
      </div>

      {/* Stats Cards - 4 metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBookings}</div>
            <p className="text-xs text-muted-foreground">
              {stats.completedBookings} completed, {stats.pendingBookings} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Avg ${stats.averageBookingValue.toFixed(2)} per booking
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.avgBookingsPerCustomer.toFixed(1)} avg bookings per customer
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Booking Rate</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.occupancyRate.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.cancelledBookings > 0 ? `${stats.cancelledBookings} cancelled` : 'No cancellations'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row - Bookings Over Time (3 cols) + Popular Services (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Bookings Over Time</CardTitle>
                <CardDescription>Daily booking count across selected period</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {bookingsOverTime.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bookingsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      className="text-xs" 
                      tick={{ fontSize: 11 }}
                      interval={Math.max(0, Math.floor(bookingsOverTime.length / 6) - 1)}
                      tickMargin={8}
                    />
                    <YAxis className="text-xs" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="bookings"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={bookingsOverTime.length <= 14}
                      activeDot={{ r: 5, fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No bookings data for this period
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Popular Services</CardTitle>
                <CardDescription>By booking count</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {serviceBreakdown.length > 0 ? (
              <div className="space-y-3">
                {serviceBreakdown.slice(0, 5).map((s) => (
                  <div key={s.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate">{s.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {s.count}
                      </span>
                    </div>
                    <Progress value={(s.count / (stats.totalBookings || 1)) * 100} className="h-1.5" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No services data
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lead Funnel */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
              <Filter className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Lead Funnel</CardTitle>
              <CardDescription>Customer journey from visit to booking</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {funnelData.length > 0 && funnelData[0].value > 0 ? (
            <div className="space-y-3">
              {funnelData.map((item, idx) => {
                const maxValue = funnelData[0].value;
                const widthPercent = (item.value / maxValue) * 100;
                const prevValue = idx > 0 ? funnelData[idx - 1].value : item.value;
                const conversionRate = prevValue > 0 ? ((item.value / prevValue) * 100).toFixed(0) : '100';

                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{item.name}</span>
                      <span className="text-muted-foreground">
                        {item.value.toLocaleString()}
                        {idx > 0 && <span className="ml-2 text-xs">({conversionRate}%)</span>}
                      </span>
                    </div>
                    <div className="h-8 w-full bg-muted rounded-md overflow-hidden">
                      <div
                        className="h-full rounded-md transition-all flex items-center justify-end pr-3"
                        style={{
                          width: `${Math.max(widthPercent, 5)}%`,
                          backgroundColor: 'hsl(var(--primary))',
                        }}
                      >
                        {widthPercent > 15 && (
                          <span className="text-xs font-medium text-primary-foreground">
                            {widthPercent.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              No funnel data for this period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Banner for stores without sheet */}
      {!store.sheet_id && (
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Connect Your Google Sheet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This dashboard is showing sample data. Connect a Google Sheet with your
                  booking data to see real analytics. Go to Store Settings to link your sheet.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
