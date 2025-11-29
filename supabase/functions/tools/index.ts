import { FunctionContext, FunctionResult, StoreConfig } from '../_shared/types.ts';
import {
  validateParams,
  GetStoreInfoSchema,
  GetServicesSchema,
  GetProductsSchema,
  SubmitLeadSchema,
  GetMiscDataSchema,
  CheckAvailabilitySchema,
  CreateBookingSchema
} from './validators.ts';
import { semanticMatch } from './semantic-matcher.ts';
import { checkAvailability, createBooking, getBookingSlots } from './calendar-booking.ts';

// ============================================================================
// FUNCTION EXECUTOR
// ============================================================================

export async function executeFunction(
  functionName: string,
  params: any,
  context: FunctionContext
): Promise<FunctionResult> {
  console.log(`[Executor] Calling ${functionName} with params:`, params);

  try {
    switch (functionName) {
      case 'get_store_info':
        return await getStoreInfo(params, context);
      case 'get_services':
        return await getServices(params, context);
      case 'get_products':
        return await getProducts(params, context);
      case 'submit_lead':
        return await submitLead(params, context);
      case 'get_misc_data':
        return await getMiscData(params, context);
      case 'check_availability':
        return await checkAvailability(params, context);
      case 'create_booking':
        return await createBooking(params, context);
      case 'get_booking_slots':
        return await getBookingSlots(params, context);
      default:
        return {
          success: false,
          error: `Unknown function: ${functionName}`
        };
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Executor] Error in ${functionName}:`, errMsg);
    return {
      success: false,
      error: errMsg || 'Function execution failed'
    };
  }
}

// ============================================================================
// FUNCTION: get_store_info
// ============================================================================

async function getStoreInfo(
  params: any,
  context: FunctionContext
): Promise<FunctionResult> {
  // Validate params
  const validation = validateParams(GetStoreInfoSchema, params);
  if (!validation.valid) {
    return {
      success: false,
      error: `Invalid parameters: ${validation.errors.join(', ')}`
    };
  }

  const validated = validation.data as Record<string, any>;
  const { info_type } = validated;
  const { storeId, authToken, store } = context;

  // Determine which tabs to load based on info_type
  const tabsToLoad = info_type === 'all'
    ? ['store_info', 'hours', 'services', 'products']
    : info_type === 'hours'
    ? ['store_info', 'hours']
    : info_type === 'services'
    ? ['store_info', 'services']
    : info_type === 'products'
    ? ['store_info', 'products']
    : ['store_info'];

  // Use detected_schema if available to find actual tab names
  const detectedSchema = store?.detected_schema || {};
  const tabMapping: Record<string, string> = {};

  // Map expected tabs to actual tab names (case-insensitive fuzzy match)
  for (const expectedTab of tabsToLoad) {
    let actualTab = findActualTabName(expectedTab, detectedSchema);

    // FALLBACK: If not in schema, try direct query with common names
    if (!actualTab) {
      const commonNames: Record<string, string[]> = {
        'hours': ['Hours', 'hours', 'HOURS', 'Store Hours', 'Opening Hours'],
        'services': ['Services', 'services', 'SERVICES', 'Service'],
        'products': ['Products', 'products', 'PRODUCTS', 'Product', 'Inventory'],
        'store_info': ['Store Info', 'store_info', 'Info', 'About']
      };

      const namesToTry = commonNames[expectedTab] || [expectedTab];
      for (const name of namesToTry) {
        try {
          const testData = await loadTabData(storeId, name, authToken, context.requestId);
          if (testData && testData.length >= 0) {
            actualTab = name;
            console.log(`[getStoreInfo] Found ${expectedTab} tab via direct query: ${name}`);
            break;
          }
        } catch (err) {
          continue;
        }
      }
    }

    if (actualTab) {
      tabMapping[expectedTab] = actualTab;
    }
  }

  // Load data from tabs
  const data: Record<string, any> = {};

  for (const [expectedTab, actualTab] of Object.entries(tabMapping)) {
    try {
      const tabData = await loadTabData(storeId, actualTab, authToken, context.requestId);
      data[expectedTab] = tabData;
    } catch (error) {
      console.error(`[getStoreInfo] Error loading ${actualTab}:`, error);
      data[expectedTab] = [];
    }
  }

  // Build optional UI components payload (frontend will render if available)
  const components: Array<Record<string, any>> = [];

  // Normalize hours into a consistent array shape so UI components can consume it
  function normalizeHours(raw: any): any[] {
    if (!raw) return [];
    // Already an array of day objects
    if (Array.isArray(raw)) return raw;
    // If it's a string (e.g. "Mon-Fri: 14:00-21:00"), return a single entry
    if (typeof raw === 'string') {
      return [{ day: 'Hours', openTime: raw, closeTime: '', isOpen: 'Yes' }];
    }
    // Unknown shape
    return [];
  }

  let hoursArray: any[] = [];
  if (Array.isArray(data.hours) && data.hours.length) {
    hoursArray = data.hours;
  } else if (Array.isArray(data.store_info) && data.store_info[0]?.hours) {
    hoursArray = normalizeHours(data.store_info[0].hours);
  }

  if (hoursArray.length) {
    components.push({
      id: `hours-${storeId}`,
      type: 'HoursList',
      props: { hours: hoursArray }
    });
  }

  return {
    success: true,
    data: {
      store_name: store?.name || 'Unknown',
      info_type,
      ...data
    },
    message: 'Here is the requested store information.',
    components,
    componentsVersion: '1'
  };
}

// ============================================================================
// FUNCTION: get_services
// ============================================================================

async function getServices(
  params: any,
  context: FunctionContext
): Promise<FunctionResult> {
  // Validate params
  const validation = validateParams(GetServicesSchema, params);
  if (!validation.valid) {
    return {
      success: false,
      error: `Invalid parameters: ${validation.errors.join(', ')}`
    };
  }

  const { query, category } = validation.data as Record<string, any>;
  const { storeId, authToken, store } = context;

  // Find services tab using schema if available
  const detectedSchema = store?.detected_schema || {};
  let servicesTab = findActualTabName('services', detectedSchema);

  // FALLBACK: If no schema or tab not found, try direct query with common names
  if (!servicesTab) {
    console.log('[getServices] No schema or tab not found, trying direct query');
    const commonNames = ['Services', 'services', 'SERVICES', 'Service'];
    for (const name of commonNames) {
      try {
        const testData = await loadTabData(storeId, name, authToken, context.requestId);
        if (testData && testData.length >= 0) {
          servicesTab = name;
          console.log(`[getServices] Found services tab via direct query: ${name}`);
          break;
        }
      } catch (err) {
        // Tab doesn't exist, continue trying
        continue;
      }
    }
  }

  if (!servicesTab) {
    return {
      success: false,
      error: `Services data not available. Please ensure your sheet has a tab named "Services" (or reconnect your sheet to detect tabs).`
    };
  }

  // Load all services
  let services = await loadTabData(storeId, servicesTab, authToken, context.requestId);

  // Apply category filter if specified
  if (category) {
    const categoryLower = category.toLowerCase();
    services = services.filter((s: any) =>
      (s.category || '').toLowerCase().includes(categoryLower)
    );
  }

  // Apply semantic matching if query provided
  if (query) {
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') || '';
    const matches = await semanticMatch(query, services, 'service', OPENROUTER_API_KEY);
    services = matches.map(m => m.item);
  }

  // Build optional UI components payload (frontend will render if available)
  const components: Array<Record<string, any>> = [];

  if (Array.isArray(services) && services.length) {
    components.push({
      id: `services-${storeId}`,
      type: 'services',
      props: { services }
    });
  }

  return {
    success: true,
    data: {
      services,
      count: services.length,
      query: query || null,
      category: category || null
    },
    message: `Found ${services.length} services.`,
    components,
    componentsVersion: '1'
  };
}

// ============================================================================
// FUNCTION: get_products
// ============================================================================

async function getProducts(
  params: any,
  context: FunctionContext
): Promise<FunctionResult> {
  // Validate params
  const validation = validateParams(GetProductsSchema, params);
  if (!validation.valid) {
    return {
      success: false,
      error: `Invalid parameters: ${validation.errors.join(', ')}`
    };
  }

  const { query, category } = validation.data as Record<string, any>;
  const { storeId, authToken, store } = context;

  // Find products tab using schema if available
  const detectedSchema = store?.detected_schema || {};
  let productsTab = findActualTabName('products', detectedSchema);

  // FALLBACK: If no schema or tab not found, try direct query with common names
  if (!productsTab) {
    console.log('[getProducts] No schema or tab not found, trying direct query');
    const commonNames = ['Products', 'products', 'PRODUCTS', 'Product', 'Inventory'];
    for (const name of commonNames) {
      try {
        const testData = await loadTabData(storeId, name, authToken, context.requestId);
        if (testData && testData.length >= 0) {
          productsTab = name;
          console.log(`[getProducts] Found products tab via direct query: ${name}`);
          break;
        }
      } catch (err) {
        continue;
      }
    }
  }

  if (!productsTab) {
    return {
      success: false,
      error: 'Products data not available. Please ensure your sheet has a tab named "Products" (or reconnect your sheet to detect tabs).'
    };
  }

  // Load all products
  let products = await loadTabData(storeId, productsTab, authToken, context.requestId);

  // Apply category filter if specified
  if (category) {
    const categoryLower = category.toLowerCase();
    products = products.filter((p: any) =>
      (p.category || '').toLowerCase().includes(categoryLower)
    );
  }

  // Apply semantic matching if query provided
  if (query) {
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') || '';
    const matches = await semanticMatch(query, products, 'product', OPENROUTER_API_KEY);
    products = matches.map(m => m.item);
  }

  // Build optional UI components payload (frontend will render if available)
  const components: Array<Record<string, any>> = [];

  if (Array.isArray(products) && products.length) {
    components.push({
      id: `products-${storeId}`,
      type: 'products',
      props: { products }
    });
  }

  return {
    success: true,
    data: {
      products,
      count: products.length,
      query: query || null,
      category: category || null
    },
    message: `Found ${products.length} products.`,
    components,
    componentsVersion: '1'
  };
}

// ============================================================================
// FUNCTION: submit_lead
// ============================================================================

/**
 * Parse key="value" patterns from a message string
 * Returns an object with extracted key-value pairs
 */
function parseFormDataFromMessage(message: string): Record<string, string> {
  const result: Record<string, string> = {};

  // Match patterns like: key="value with spaces" or key='value with spaces'
  const quotedRegex = /(\w+)="([^"]*)"/g;
  let match;
  while ((match = quotedRegex.exec(message)) !== null) {
    result[match[1]] = match[2];
  }

  // Also try single quotes
  const singleQuotedRegex = /(\w+)='([^']*)'/g;
  while ((match = singleQuotedRegex.exec(message)) !== null) {
    if (!result[match[1]]) { // Don't override double-quoted values
      result[match[1]] = match[2];
    }
  }

  return result;
}

async function submitLead(
  params: any,
  context: FunctionContext
): Promise<FunctionResult> {
  const { storeId, authToken, store, lastUserMessage } = context;

  // Try to extract form data from the message as a fallback
  // This handles cases where the classifier doesn't extract all fields
  let mergedParams = { ...params };
  if (lastUserMessage && lastUserMessage.toLowerCase().includes('submit_lead')) {
    const parsedFromMessage = parseFormDataFromMessage(lastUserMessage);
    console.log('[submitLead] Parsed from message:', parsedFromMessage);
    // Merge parsed data, preferring classifier-extracted params
    mergedParams = { ...parsedFromMessage, ...params };
  }
  params = mergedParams;

  // Find leads tab and get schema
  const detectedSchema = store?.detected_schema || {};
  const leadsTab = findActualTabName('leads', detectedSchema);

  if (!leadsTab) {
    return {
      success: false,
      error: 'Lead capture not available. Please ensure your sheet has a "Leads" tab.'
    };
  }

  // Get leads tab schema - columns from row A of the sheet
  const leadsSchema = detectedSchema[leadsTab];
  const columns: string[] = leadsSchema?.columns || [];

  console.log('[submitLead] Leads tab schema:', { leadsTab, columns });

  // Determine which fields are required and which are optional
  // By default, first two non-Date/Status columns are required (usually Name, Email)
  const excludedColumns = ['date', 'status', 'timestamp', 'created', 'id'];
  const formColumns = columns.filter(col =>
    !excludedColumns.includes(col.toLowerCase())
  );

  // Generate field definitions from sheet columns
  const fieldDefinitions = formColumns.map((col, index) => {
    const colLower = col.toLowerCase();
    let type: 'text' | 'email' | 'tel' | 'textarea' = 'text';

    // Detect field type based on column name
    if (colLower.includes('email')) {
      type = 'email';
    } else if (colLower.includes('phone') || colLower.includes('mobile') || colLower.includes('tel')) {
      type = 'tel';
    } else if (colLower.includes('message') || colLower.includes('note') || colLower.includes('comment') || colLower.includes('description')) {
      type = 'textarea';
    }

    // First two fields are typically required (name, email)
    const isRequired = index < 2;

    return {
      name: col,
      label: col,
      type,
      required: isRequired,
      placeholder: getPlaceholder(col)
    };
  });

  console.log('[submitLead] Generated field definitions:', fieldDefinitions);

  // Check if required fields are provided
  const requiredFields = fieldDefinitions.filter(f => f.required).map(f => f.name);
  const missingFields = requiredFields.filter(field => {
    const value = params[field] || params[field.toLowerCase()];
    return !value || String(value).trim() === '';
  });

  console.log('[submitLead] Checking params:', { params, requiredFields, missingFields });

  // If required info is missing, return LeadForm component with dynamic fields
  if (missingFields.length > 0) {
    // Build defaultValues from any params that were provided
    const defaultValues: Record<string, string> = {};
    for (const field of fieldDefinitions) {
      const value = params[field.name] || params[field.name.toLowerCase()] || '';
      if (value) {
        defaultValues[field.name] = String(value);
      }
    }

    const components = [{
      id: `lead-form-${storeId}-${Date.now()}`,
      type: 'LeadForm',
      props: {
        fields: fieldDefinitions,
        defaultValues
      }
    }];

    return {
      success: true,  // NOT an error - we're just collecting input
      awaiting_input: true,  // Flag to indicate we need user input
      data: {
        missing_fields: missingFields,
        fields: fieldDefinitions
      },
      message: `Please provide your contact information so we can assist you better.`,
      components,
      componentsVersion: '1'
    };
  }

  // All required fields are present - write to sheet
  // Build data object matching sheet columns exactly
  const leadData: Record<string, any> = {};

  // Add timestamp if there's a Date column
  const dateColumn = columns.find(col => col.toLowerCase() === 'date' || col.toLowerCase() === 'timestamp');
  if (dateColumn) {
    leadData[dateColumn] = new Date().toISOString();
  }

  // Add status if there's a Status column
  const statusColumn = columns.find(col => col.toLowerCase() === 'status');
  if (statusColumn) {
    leadData[statusColumn] = 'new';
  }

  // Map all form data to sheet columns (case-insensitive matching)
  for (const col of columns) {
    if (leadData[col]) continue; // Already set (date/status)

    // Try exact match first, then case-insensitive
    let value = params[col] || params[col.toLowerCase()];

    // Also check for common field name variations
    const colLower = col.toLowerCase();
    if (!value && colLower.includes('name')) {
      value = params.name || params.Name || params.fullname || params.full_name;
    }
    if (!value && colLower.includes('email')) {
      value = params.email || params.Email || params.e_mail;
    }
    if (!value && (colLower.includes('phone') || colLower.includes('mobile'))) {
      value = params.phone || params.Phone || params.mobile || params.Mobile || params.tel;
    }
    if (!value && (colLower.includes('message') || colLower.includes('note'))) {
      value = params.message || params.Message || params.note || params.Note || params.comment;
    }

    leadData[col] = value || '';
  }

  console.log('[submitLead] Writing to sheet:', { leadsTab, leadData });

  // Append to sheet
  try {
    await appendToSheet(storeId, leadsTab, leadData, authToken, context.requestId);

    return {
      success: true,
      data: {
        message: "Thank you! We've received your information and will get back to you soon.",
        lead_id: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('[submitLead] Error writing to sheet:', error);
    return {
      success: false,
      error: 'Failed to save your information. Please try again or contact us directly.'
    };
  }
}

// ============================================================================
// FUNCTION: get_misc_data
// ============================================================================

async function getMiscData(
  params: any,
  context: FunctionContext
): Promise<FunctionResult> {
  // Validate params
  const validation = validateParams(GetMiscDataSchema, params);
  if (!validation.valid) {
    return {
      success: false,
      error: `Invalid parameters: ${validation.errors.join(', ')}`
    };
  }

  const { tab_name, query } = validation.data as Record<string, any>;
  const { storeId, authToken, store } = context;

  // Find the requested tab using schema if available
  const detectedSchema = store?.detected_schema || {};
  let actualTab = findActualTabName(tab_name, detectedSchema);

  // FALLBACK: If no schema or tab not found, try direct query with exact name
  if (!actualTab) {
    console.log(`[getMiscData] Tab "${tab_name}" not in schema, trying direct query`);
    try {
      const testData = await loadTabData(storeId, tab_name, authToken, context.requestId);
      if (testData && testData.length >= 0) {
        actualTab = tab_name;
        console.log(`[getMiscData] Found tab via direct query: ${tab_name}`);
      }
    } catch (err) {
      // Tab doesn't exist
      const availableTabs = Object.keys(detectedSchema).length > 0
        ? Object.keys(detectedSchema).join(', ')
        : 'unknown (reconnect sheet to detect tabs)';
      return {
        success: false,
        error: `Tab "${tab_name}" not found. Available tabs: ${availableTabs}`
      };
    }
  }

  if (!actualTab) {
    const availableTabs = Object.keys(detectedSchema).length > 0
      ? Object.keys(detectedSchema).join(', ')
      : 'unknown (reconnect sheet to detect tabs)';
    return {
      success: false,
      error: `Tab "${tab_name}" not found. Available tabs: ${availableTabs}`
    };
  }

  // Load data from tab
  let data = await loadTabData(storeId, actualTab, authToken, context.requestId);

  // Apply simple filtering if query provided
  if (query) {
    const queryLower = query.toLowerCase();
    data = data.filter((row: any) => {
      return Object.values(row).some(value =>
        String(value).toLowerCase().includes(queryLower)
      );
    });
  }

  return {
    success: true,
    data: {
      tab_name: actualTab,
      data,
      count: data.length,
      query: query || null
    }
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get placeholder text for a field based on its name
 */
function getPlaceholder(fieldName: string): string {
  const name = fieldName.toLowerCase();
  if (name.includes('name')) return 'Your full name';
  if (name.includes('email')) return 'you@example.com';
  if (name.includes('phone')) return '+1 555 555 5555';
  if (name.includes('message') || name.includes('note')) return 'How can we help you?';
  if (name.includes('interest')) return 'What are you interested in?';
  return `Enter ${fieldName.toLowerCase()}`;
}

/**
 * Find actual tab name from detected schema using fuzzy matching
 */
function findActualTabName(
  expectedTab: string,
  detectedSchema: Record<string, any>
): string | null {
  const expectedLower = expectedTab.toLowerCase();

  // Try exact match first
  for (const actualTab of Object.keys(detectedSchema)) {
    if (actualTab.toLowerCase() === expectedLower) {
      return actualTab;
    }
  }

  // Try partial match
  for (const actualTab of Object.keys(detectedSchema)) {
    if (actualTab.toLowerCase().includes(expectedLower) ||
        expectedLower.includes(actualTab.toLowerCase())) {
      return actualTab;
    }
  }

  return null;
}

/**
 * Load data from a sheet tab via google-sheet function
 */
async function loadTabData(
  storeId: string,
  tabName: string,
  authToken: string,
  requestId?: string
): Promise<any[]> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

  console.log(`[loadTabData] Loading tab: ${tabName} for store: ${storeId}`);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
    'apikey': authToken
  };

  // Add correlation ID if provided
  if (requestId) {
    headers['X-Request-ID'] = requestId;
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/google-sheet`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      operation: 'read',
      storeId,
      tabName
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[loadTabData] Failed to load ${tabName}:`, errorText);
    throw new Error(`Failed to load ${tabName}: ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  console.log(`[loadTabData] Loaded ${result.data?.length || 0} rows from ${tabName}`);
  return result.data || [];
}

/**
 * Append data to a sheet tab via google-sheet function
 */
async function appendToSheet(
  storeId: string,
  tabName: string,
  data: Record<string, any>,
  authToken: string,
  requestId?: string
): Promise<void> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  };

  // Add correlation ID if provided
  if (requestId) {
    headers['X-Request-ID'] = requestId;
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/google-sheet`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      operation: 'append',
      storeId,
      tabName,
      data
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to append to ${tabName}: ${response.statusText}`);
  }
}
