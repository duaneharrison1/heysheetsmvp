/**
 * DIRECT FUNCTION CALLS
 * =====================
 *
 * Call backend functions directly without going through LLM classification.
 * Used for UI interactions where intent is already known (button clicks, forms).
 *
 * ~50ms vs ~13s for LLM path
 */

export interface DirectFunctionResult {
  success: boolean;
  text: string;
  message: string;
  data?: any;
  functionResult?: any;
  components?: any[];
  componentsVersion?: string;
  error?: string;
  direct: boolean;
  debug?: {
    requestId: string;
    functionDuration: number;
    totalDuration: number;
    mode: string;
  };
}

/**
 * Map UI action names to function names and extract params
 */
interface ActionMapping {
  functionName: string;
  extractParams?: (data: any) => Record<string, any>;
}

const ACTION_MAPPINGS: Record<string, ActionMapping> = {
  'confirm_booking': {
    functionName: 'create_booking',
    extractParams: (data) => ({
      service_name: data.service_name || data.serviceName,
      date: data.date,
      time: data.time,
      customer_name: data.customer_name || data.customerName,
      customer_email: data.customer_email || data.customerEmail,
      customer_phone: data.customer_phone || data.customerPhone,
    }),
  },
  'book_service': {
    functionName: 'get_booking_slots',
    extractParams: (data) => ({
      service_name: data.service_name || data.serviceName || data.name,
      prefill_name: data.prefill_name,
      prefill_email: data.prefill_email,
    }),
  },
  'view_products': {
    functionName: 'get_products',
    extractParams: (data) => ({
      query: data.query,
      category: data.category,
    }),
  },
  'view_services': {
    functionName: 'get_services',
    extractParams: (data) => ({
      query: data.query,
      category: data.category,
    }),
  },
  'submit_lead': {
    functionName: 'submit_lead',
    extractParams: (data) => data, // Pass all form data
  },
  'get_recommendations': {
    functionName: 'get_recommendations',
    extractParams: (data) => ({
      goal: data.goal,
      experience_level: data.experience_level,
      budget: data.budget,
      time_preference: data.time_preference,
      offering_type: data.offering_type,
    }),
  },
  'check_availability': {
    functionName: 'check_availability',
    extractParams: (data) => ({
      service_name: data.service_name || data.serviceName,
      date: data.date,
      time: data.time,
    }),
  },
};

/**
 * Get function name for a UI action
 */
export function getFunctionForAction(action: string): string | null {
  const mapping = ACTION_MAPPINGS[action];
  return mapping?.functionName || null;
}

/**
 * Check if an action can be handled directly (without LLM)
 */
export function canHandleDirectly(action: string): boolean {
  return action in ACTION_MAPPINGS;
}

/**
 * Get display text for a UI action (for chat history)
 */
export function getActionDisplayText(action: string, data: Record<string, any>): string {
  switch (action) {
    case 'confirm_booking':
      return `Book ${data.service_name || data.serviceName} on ${data.date} at ${data.time}`;
    case 'book_service':
      return `Show booking options for ${data.service_name || data.serviceName || data.name}`;
    case 'view_products':
      return data.query ? `Search products: "${data.query}"` : 'View products';
    case 'view_services':
      return data.query ? `Search services: "${data.query}"` : 'View services';
    case 'submit_lead':
      return 'Submit contact information';
    case 'get_recommendations':
      return 'Get recommendations';
    case 'check_availability':
      return `Check availability for ${data.service_name || data.serviceName}`;
    default:
      return action.replace(/_/g, ' ');
  }
}

/**
 * Call a function directly (bypassing LLM)
 */
export async function directFunctionCall(
  action: string,
  data: Record<string, any>,
  storeId: string,
  cachedData?: any
): Promise<DirectFunctionResult> {
  const mapping = ACTION_MAPPINGS[action];

  if (!mapping) {
    console.error(`[directFunction] No mapping for action: ${action}`);
    return {
      success: false,
      text: 'Sorry, this action is not supported for direct calls.',
      message: 'Sorry, this action is not supported for direct calls.',
      error: `Unknown action: ${action}`,
      direct: true,
    };
  }

  const { functionName, extractParams } = mapping;
  const params = extractParams ? extractParams(data) : data;

  console.log(`[directFunction] Calling ${functionName}`, { action, params, storeId });

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/direct-function`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'X-Request-ID': crypto.randomUUID(),
      },
      body: JSON.stringify({
        functionName,
        params,
        storeId,
        cachedData,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[directFunction] HTTP error:', response.status, errorText);
      return {
        success: false,
        text: 'Sorry, something went wrong. Please try again.',
        message: 'Sorry, something went wrong. Please try again.',
        error: `HTTP ${response.status}: ${errorText}`,
        direct: true,
      };
    }

    const result = await response.json();

    console.log(`[directFunction] ${functionName} completed in ${result.debug?.totalDuration}ms`);

    return {
      success: result.success,
      text: result.text || result.message,
      message: result.message || result.text,
      data: result.data,
      functionResult: result.functionResult,
      components: result.components || [],
      componentsVersion: result.componentsVersion,
      debug: result.debug,
      direct: true,
    };

  } catch (err: any) {
    console.error('[directFunction] Exception:', err);
    return {
      success: false,
      text: 'Sorry, something went wrong. Please try again.',
      message: 'Sorry, something went wrong. Please try again.',
      error: err.message,
      direct: true,
    };
  }
}
