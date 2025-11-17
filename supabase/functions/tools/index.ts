// All LLM-executable tools in one module: getStoreInfo, checkAvailability, createBooking, getProducts
import { } from '../chat-completion/types.ts';

export async function executeFunction(
  functionName: string,
  params: any,
  context: { storeId: string; userId: string; authToken: string }
): Promise<any> {
  const { storeId, authToken } = context;
  try {
    switch (functionName) {
      case 'get_store_info': return await getStoreInfo(params, storeId, authToken);
      case 'check_availability': return await checkAvailability(params, storeId, authToken);
      case 'create_booking': return await createBooking(params, storeId, authToken);
      case 'get_products': return await getProducts(params, storeId, authToken);
      default: throw new Error(`Unknown function: ${functionName}`);
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Executor] Error in ${functionName}:`, errMsg);
    return { success: false, error: errMsg || 'Function execution failed' };
  }
}

async function getStoreInfo(params: { info_type: string }, storeId: string, authToken: string): Promise<any> {
  const tabs = params.info_type === 'all' ? ['hours', 'services', 'products'] : [params.info_type];
  const result: any = { success: true, data: {}, type: params.info_type };

  for (const tab of tabs) {
    try {
      const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/google-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}`, 'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '' },
        body: JSON.stringify({ operation: 'read', storeId, tabName: tab.charAt(0).toUpperCase() + tab.slice(1) })
      });
      if (response.ok) {
        const data = await response.json();
        result.data[tab] = data.data || [];
      }
    } catch (error) {
      result.data[tab] = [];
    }
  }
  return result;
}

async function checkAvailability(params: { service_name: string; date: string }, storeId: string, authToken: string): Promise<any> {
  const { service_name, date } = params;

  const servicesResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/google-sheet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}`, 'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '' },
    body: JSON.stringify({ operation: 'read', storeId, tabName: 'Services' })
  });

  if (!servicesResponse.ok) throw new Error('Failed to fetch services');
  const servicesData = await servicesResponse.json();
  const services = servicesData.data || [];

  const service = services.find((s: any) => s.serviceName?.toLowerCase() === service_name.toLowerCase() || s.name?.toLowerCase() === service_name.toLowerCase());
  if (!service) {
    return { success: false, error: `Service "${service_name}" not found. Available: ${services.map((s: any) => s.serviceName || s.name).join(', ')}` };
  }

  const allPossibleSlots = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
  return {
    success: true,
    service: service_name,
    date,
    day: new Date(date).toLocaleDateString('en-US', { weekday: 'long' }),
    available_slots: allPossibleSlots,
    duration: service.duration || '60 minutes'
  };
}

async function createBooking(params: { service_name: string; date: string; time: string; customer_name: string; email: string; phone?: string }, storeId: string, authToken: string): Promise<any> {
  const required = ['service_name', 'date', 'time', 'customer_name', 'email'];
  const missing = required.filter(field => !params[field as keyof typeof params]);
  if (missing.length > 0) return { success: false, error: `Missing: ${missing.join(', ')}` };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(params.email)) return { success: false, error: 'Invalid email format' };

  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/google-sheet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}`, 'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '' },
    body: JSON.stringify({
      operation: 'append',
      storeId,
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
  });

  if (!response.ok) throw new Error('Failed to create booking');

  return {
    success: true,
    booking: { ...params, status: 'confirmed', confirmation: 'CONFIRMED-' + Date.now() },
    message: `Booking confirmed for ${params.service_name} on ${params.date} at ${params.time}`
  };
}

async function getProducts(params: { category?: string }, storeId: string, authToken: string): Promise<any> {
  try {
    const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-sheet`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}`, 'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '' },
      body: JSON.stringify({ operation: 'read', storeId, tabName: 'Products' })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch products: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    let products = data.data || [];

    if (params.category) {
      products = products.filter((p: any) => p.category?.toLowerCase() === params.category?.toLowerCase());
      if (products.length === 0) return { success: false, error: `No products in category "${params.category}"` };
    }

    return { success: true, products, category: params.category || 'all', count: products.length };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[getProducts] Caught error:', errMsg);
    return { success: false, error: `Failed to fetch products: ${errMsg}` };
  }
}
