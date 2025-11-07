// Execute functions based on classification

export async function executeFunction(
  functionName: string,
  params: Record<string, any>,
  context: {
    storeId: string;
    userId: string;
    authToken: string;
  }
): Promise<any> {

  console.log(`[Executor] Calling function: ${functionName}`, params);

  const { storeId, authToken } = context;

  try {
    switch (functionName) {

      case 'get_store_info':
        return await getStoreInfo(params, storeId, authToken);

      case 'check_availability':
        return await checkAvailability(params, storeId, authToken);

      case 'create_booking':
        return await createBooking(params, storeId, authToken);

      case 'get_products':
        return await getProducts(params, storeId, authToken);

      default:
        throw new Error(`Unknown function: ${functionName}`);
    }

  } catch (error) {
    console.error(`[Executor] Error in ${functionName}:`, error);
    return {
      success: false,
      error: error.message || 'Function execution failed'
    };
  }
}

// ═══════════════════════════════════════════════════════════
// FUNCTION IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════

async function getStoreInfo(
  params: { info_type: string },
  storeId: string,
  authToken: string
): Promise<any> {

  const { info_type } = params;

  console.log(`[getStoreInfo] Fetching ${info_type} for store ${storeId}`);

  // Determine which tabs to fetch
  const tabs = info_type === 'all'
    ? ['hours', 'services', 'products']
    : [info_type];

  const result: any = { success: true, data: {}, type: info_type };

  // Fetch each tab
  for (const tab of tabs) {
    try {
      const response = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-sheet`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            'apikey': Deno.env.get('SUPABASE_ANON_KEY') || ''
          },
          body: JSON.stringify({
            operation: 'read',
            storeId: storeId,
            tabName: tab.charAt(0).toUpperCase() + tab.slice(1)
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        result.data[tab] = data.data || [];
      }
    } catch (error) {
      console.error(`[getStoreInfo] Error fetching ${tab}:`, error);
      result.data[tab] = [];
    }
  }

  console.log(`[getStoreInfo] Successfully fetched ${tabs.join(', ')}`);

  return result;
}

async function checkAvailability(
  params: { service_name: string; date: string },
  storeId: string,
  authToken: string
): Promise<any> {

  const { service_name, date } = params;

  console.log(`[checkAvailability] Checking ${service_name} on ${date}`);

  // Step 1: Get service details
  const servicesResponse = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-sheet`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'apikey': Deno.env.get('SUPABASE_ANON_KEY') || ''
      },
      body: JSON.stringify({
        operation: 'read',
        storeId: storeId,
        tabName: 'Services'
      })
    }
  );

  if (!servicesResponse.ok) {
    throw new Error('Failed to fetch services');
  }

  const servicesData = await servicesResponse.json();
  const services = servicesData.data || [];

  // Find the specific service (case-insensitive)
  const service = services.find(
    (s: any) => s.serviceName?.toLowerCase() === service_name.toLowerCase() ||
                s.name?.toLowerCase() === service_name.toLowerCase()
  );

  if (!service) {
    return {
      success: false,
      error: `Service "${service_name}" not found. Available services: ${services.map((s: any) => s.serviceName || s.name).join(', ')}`
    };
  }

  // Step 2: Get existing bookings for that date
  const bookingsResponse = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-sheet`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'apikey': Deno.env.get('SUPABASE_ANON_KEY') || ''
      },
      body: JSON.stringify({
        operation: 'read',
        storeId: storeId,
        tabName: 'Bookings'
      })
    }
  );

  const existingBookings = bookingsResponse.ok
    ? ((await bookingsResponse.json()).data || []).filter(
        (b: any) => b.date === date && (b.service === service_name || b.serviceName === service_name)
      )
    : [];

  console.log(`[checkAvailability] Found ${existingBookings.length} existing bookings`);

  // Step 3: Get store hours
  const hoursResponse = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-sheet`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'apikey': Deno.env.get('SUPABASE_ANON_KEY') || ''
      },
      body: JSON.stringify({
        operation: 'read',
        storeId: storeId,
        tabName: 'Hours'
      })
    }
  );

  const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
  const dayHours = hoursResponse.ok
    ? ((await hoursResponse.json()).data || []).find((h: any) => h.day === dayOfWeek)
    : null;

  if (dayHours && (dayHours.closed || dayHours.isOpen === 'No')) {
    return {
      success: false,
      error: `Store is closed on ${dayOfWeek}`
    };
  }

  // Step 4: Calculate available slots (simplified)
  const allPossibleSlots = [
    '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'
  ];

  const availableSlots = allPossibleSlots.filter(slot => {
    return !existingBookings.some((b: any) => b.time === slot);
  });

  console.log(`[checkAvailability] Available slots: ${availableSlots.join(', ')}`);

  return {
    success: true,
    service: service_name,
    date: date,
    day: dayOfWeek,
    available_slots: availableSlots,
    duration: service.duration || '60 minutes',
    existing_bookings: existingBookings.length
  };
}

async function createBooking(
  params: {
    service_name: string;
    date: string;
    time: string;
    customer_name: string;
    email: string;
    phone?: string;
  },
  storeId: string,
  authToken: string
): Promise<any> {

  console.log('[createBooking] Creating booking:', params);

  // Validate required params
  const required = ['service_name', 'date', 'time', 'customer_name', 'email'];
  const missing = required.filter(field => !params[field as keyof typeof params]);

  if (missing.length > 0) {
    return {
      success: false,
      error: `Missing required fields: ${missing.join(', ')}. Please provide all booking details.`
    };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(params.email)) {
    return {
      success: false,
      error: 'Invalid email format. Please provide a valid email address.'
    };
  }

  // Check availability first
  const availability = await checkAvailability(
    { service_name: params.service_name, date: params.date },
    storeId,
    authToken
  );

  if (!availability.success) {
    return availability;
  }

  if (!availability.available_slots.includes(params.time)) {
    return {
      success: false,
      error: `Time slot ${params.time} is not available. Available times: ${availability.available_slots.join(', ')}`
    };
  }

  // Write to Bookings sheet
  const response = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-sheet`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'apikey': Deno.env.get('SUPABASE_ANON_KEY') || ''
      },
      body: JSON.stringify({
        operation: 'append',
        storeId: storeId,
        tabName: 'Bookings',
        data: {
          service: params.service_name,
          date: params.date,
          time: params.time,
          customerName: params.customer_name,
          email: params.email,
          phone: params.phone || '',
          status: 'confirmed',
          createdAt: new Date().toISOString()
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[createBooking] Error:', errorText);
    throw new Error('Failed to create booking in Google Sheet');
  }

  console.log('[createBooking] Successfully created booking');

  return {
    success: true,
    booking: {
      service: params.service_name,
      date: params.date,
      time: params.time,
      customer_name: params.customer_name,
      email: params.email,
      phone: params.phone,
      status: 'confirmed',
      confirmation: 'CONFIRMED-' + Date.now()
    },
    message: `Booking confirmed for ${params.service_name} on ${params.date} at ${params.time}`
  };
}

async function getProducts(
  params: { category?: string },
  storeId: string,
  authToken: string
): Promise<any> {

  console.log('[getProducts] Fetching products, category:', params.category || 'all');

  const response = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-sheet`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'apikey': Deno.env.get('SUPABASE_ANON_KEY') || ''
      },
      body: JSON.stringify({
        operation: 'read',
        storeId: storeId,
        tabName: 'Products'
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[getProducts] Error:', errorText);
    throw new Error('Failed to fetch products from Google Sheet');
  }

  const data = await response.json();
  let products = data.data || [];

  // Filter by category if provided
  if (params.category) {
    const originalCount = products.length;
    products = products.filter(
      (p: any) => p.category?.toLowerCase() === params.category?.toLowerCase()
    );

    console.log(`[getProducts] Filtered from ${originalCount} to ${products.length} products`);

    if (products.length === 0) {
      return {
        success: false,
        error: `No products found in category "${params.category}"`
      };
    }
  }

  console.log(`[getProducts] Returning ${products.length} products`);

  return {
    success: true,
    products: products,
    category: params.category || 'all',
    count: products.length
  };
}
