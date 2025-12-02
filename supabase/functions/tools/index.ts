import { FunctionContext, FunctionResult, StoreConfig } from '../_shared/types.ts';
import {
  validateParams,
  GetStoreInfoSchema,
  GetServicesSchema,
  GetProductsSchema,
  SubmitLeadSchema,
  GetMiscDataSchema,
  CheckAvailabilitySchema,
  CreateBookingSchema,
  GetRecommendationsSchema
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
      case 'get_recommendations':
        return await getRecommendations(params, context);
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

  // Load data from tabs - USE CACHED DATA FIRST if available
  const data: Record<string, any> = {};

  for (const [expectedTab, actualTab] of Object.entries(tabMapping)) {
    // Check if we have this data cached in context.storeData
    if (expectedTab === 'services' && context.storeData?.services && context.storeData.services.length > 0) {
      console.log('[getStoreInfo] ✅ Using cached services from context:', context.storeData.services.length, 'items');
      data[expectedTab] = context.storeData.services;
      continue;
    }
    if (expectedTab === 'products' && context.storeData?.products && context.storeData.products.length > 0) {
      console.log('[getStoreInfo] ✅ Using cached products from context:', context.storeData.products.length, 'items');
      data[expectedTab] = context.storeData.products;
      continue;
    }
    if (expectedTab === 'hours' && context.storeData?.hours && context.storeData.hours.length > 0) {
      console.log('[getStoreInfo] ✅ Using cached hours from context:', context.storeData.hours.length, 'items');
      data[expectedTab] = context.storeData.hours;
      continue;
    }

    // Fallback: load from sheet
    try {
      console.log(`[getStoreInfo] No cached ${expectedTab}, fetching from sheet...`);
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

  // USE CACHED DATA FIRST if available in context
  let services = context.storeData?.services;

  if (services && services.length > 0) {
    console.log('[getServices] ✅ Using cached services from context:', services.length, 'items');
  } else {
    // Fallback: fetch from Google Sheets if not in context
    console.log('[getServices] No cached services, fetching from sheet...');

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
    services = await loadTabData(storeId, servicesTab, authToken, context.requestId);
  }

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

  // USE CACHED DATA FIRST if available in context
  let products = context.storeData?.products;

  if (products && products.length > 0) {
    console.log('[getProducts] ✅ Using cached products from context:', products.length, 'items');
  } else {
    // Fallback: fetch from Google Sheets if not in context
    console.log('[getProducts] No cached products, fetching from sheet...');

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
    products = await loadTabData(storeId, productsTab, authToken, context.requestId);
  }

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
// FUNCTION: get_recommendations
// ============================================================================

/**
 * Generic preference fields for the PreferencesForm component
 */
const PREFERENCE_FIELDS = [
  {
    name: 'goal',
    label: 'What are you looking for?',
    type: 'textarea' as const,
    required: true,
    placeholder: 'Tell us what you\'re interested in or what you\'d like to achieve...'
  },
  {
    name: 'experience_level',
    label: 'Experience Level',
    type: 'select' as const,
    required: false,
    options: [
      { value: 'beginner', label: 'Beginner - New to this' },
      { value: 'intermediate', label: 'Intermediate - Some experience' },
      { value: 'advanced', label: 'Advanced - Very experienced' },
      { value: 'any', label: 'No preference' }
    ]
  },
  {
    name: 'budget',
    label: 'Budget Range',
    type: 'select' as const,
    required: false,
    options: [
      { value: 'low', label: 'Budget-friendly' },
      { value: 'medium', label: 'Mid-range' },
      { value: 'high', label: 'Premium' },
      { value: 'any', label: 'No preference' }
    ]
  },
  {
    name: 'time_preference',
    label: 'Preferred Time',
    type: 'select' as const,
    required: false,
    options: [
      { value: 'morning', label: 'Morning' },
      { value: 'afternoon', label: 'Afternoon' },
      { value: 'evening', label: 'Evening' },
      { value: 'any', label: 'No preference' }
    ]
  }
];

async function getRecommendations(
  params: any,
  context: FunctionContext
): Promise<FunctionResult> {
  // Validate params
  const validation = validateParams(GetRecommendationsSchema, params);
  if (!validation.valid) {
    return {
      success: false,
      error: `Invalid parameters: ${validation.errors.join(', ')}`
    };
  }

  const validated = validation.data as Record<string, any>;
  const { offering_type, budget, budget_max, experience_level, time_preference, day_preference, duration_preference, goal, category, limit } = validated;
  const { storeId, authToken, store } = context;

  console.log('[getRecommendations] Params:', { offering_type, budget, experience_level, time_preference, goal, category, limit });

  // Check if we have enough preferences to make recommendations
  // We need at least a goal OR category to provide meaningful recommendations
  const hasMinimumPreferences = goal || category;

  if (!hasMinimumPreferences) {
    // Return PreferencesForm component for user to fill out
    const components = [{
      id: `preferences-form-${storeId}-${Date.now()}`,
      type: 'PreferencesForm',
      props: {
        fields: PREFERENCE_FIELDS,
        title: 'Help us find the perfect match for you!',
        subtitle: 'Tell us a bit about what you\'re looking for',
        defaultValues: {
          experience_level: experience_level || '',
          budget: budget || '',
          time_preference: time_preference || '',
          goal: goal || ''
        }
      }
    }];

    return {
      success: true,
      awaiting_input: true,
      data: {
        needs_preferences: true,
        fields: PREFERENCE_FIELDS
      },
      message: 'I\'d love to help you find the perfect option! Let me ask you a few quick questions to understand what you\'re looking for.',
      components,
      componentsVersion: '1'
    };
  }

  // Load offerings based on type - USE CACHED DATA FIRST if available
  const detectedSchema = store?.detected_schema || {};
  let services: any[] = [];
  let products: any[] = [];

  // Load services if needed
  if (offering_type === 'services' || offering_type === 'both') {
    // USE CACHED DATA FIRST if available in context
    if (context.storeData?.services && context.storeData.services.length > 0) {
      console.log('[getRecommendations] ✅ Using cached services from context:', context.storeData.services.length, 'items');
      services = context.storeData.services;
    } else {
      // Fallback: fetch from sheet
      console.log('[getRecommendations] No cached services, fetching from sheet...');
      const servicesTab = findActualTabName('services', detectedSchema);
      if (servicesTab) {
        try {
          services = await loadTabData(storeId, servicesTab, authToken, context.requestId);
        } catch (err) {
          console.error('[getRecommendations] Failed to load services:', err);
        }
      }
    }
  }

  // Load products if needed
  if (offering_type === 'products' || offering_type === 'both') {
    // USE CACHED DATA FIRST if available in context
    if (context.storeData?.products && context.storeData.products.length > 0) {
      console.log('[getRecommendations] ✅ Using cached products from context:', context.storeData.products.length, 'items');
      products = context.storeData.products;
    } else {
      // Fallback: fetch from sheet
      console.log('[getRecommendations] No cached products, fetching from sheet...');
      const productsTab = findActualTabName('products', detectedSchema);
      if (productsTab) {
        try {
          products = await loadTabData(storeId, productsTab, authToken, context.requestId);
        } catch (err) {
          console.error('[getRecommendations] Failed to load products:', err);
        }
      }
    }
  }

  // Combine all offerings with type marker
  let allOfferings = [
    ...services.map(s => ({ ...s, _type: 'service', _name: s.serviceName || s.name })),
    ...products.map(p => ({ ...p, _type: 'product', _name: p.name }))
  ];

  if (allOfferings.length === 0) {
    return {
      success: false,
      error: 'No offerings available to recommend. Please ensure your sheet has Services or Products data.'
    };
  }

  console.log(`[getRecommendations] Loaded ${services.length} services and ${products.length} products`);

  // Apply filters based on preferences
  allOfferings = applyPreferenceFilters(allOfferings, {
    budget,
    budget_max,
    experience_level,
    time_preference,
    day_preference,
    duration_preference,
    category
  });

  console.log(`[getRecommendations] After filtering: ${allOfferings.length} offerings`);

  // If goal is provided, use semantic matching to rank
  let recommendations: any[] = [];
  if (goal && allOfferings.length > 0) {
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') || '';
    const matches = await semanticMatchRecommendations(goal, allOfferings, OPENROUTER_API_KEY, {
      experience_level,
      budget,
      time_preference
    });
    recommendations = matches.slice(0, limit);
  } else {
    // No goal - just take top items (could be random or by some default ordering)
    recommendations = allOfferings.slice(0, limit).map(item => ({
      item,
      score: 80,
      reasoning: 'Matches your preferences'
    }));
  }

  // Build UI components for recommendations
  const components: Array<Record<string, any>> = [];

  if (recommendations.length > 0) {
    components.push({
      id: `recommendations-${storeId}-${Date.now()}`,
      type: 'RecommendationList',
      props: {
        recommendations: recommendations.map(r => ({
          ...r.item,
          _score: r.score,
          _reasoning: r.reasoning
        })),
        preferences: { goal, experience_level, budget, time_preference }
      }
    });
  }

  return {
    success: true,
    data: {
      recommendations: recommendations.map(r => r.item),
      count: recommendations.length,
      preferences_used: { goal, experience_level, budget, time_preference, category },
      total_available: services.length + products.length
    },
    message: recommendations.length > 0
      ? `Based on your preferences, here are my top ${recommendations.length} recommendation${recommendations.length > 1 ? 's' : ''} for you!`
      : 'I couldn\'t find any offerings that match your specific preferences. Try adjusting your criteria or browse all our options.',
    components,
    componentsVersion: '1'
  };
}

/**
 * Apply preference-based filters to offerings
 */
function applyPreferenceFilters(
  offerings: any[],
  preferences: {
    budget?: string;
    budget_max?: number;
    experience_level?: string;
    time_preference?: string;
    day_preference?: string;
    duration_preference?: string;
    category?: string;
  }
): any[] {
  let filtered = [...offerings];
  const { budget, budget_max, experience_level, time_preference, day_preference, duration_preference, category } = preferences;

  // Filter by category if specified
  if (category) {
    const categoryLower = category.toLowerCase();
    filtered = filtered.filter(item =>
      (item.category || '').toLowerCase().includes(categoryLower)
    );
  }

  // Filter by budget
  if (budget && budget !== 'any') {
    filtered = filtered.filter(item => {
      const price = parseFloat(item.price) || 0;
      if (price === 0) return true; // Keep items without price
      // Define budget ranges (can be customized per store type)
      const budgetRanges: Record<string, [number, number]> = {
        low: [0, 50],
        medium: [30, 150],
        high: [100, Infinity]
      };
      const range = budgetRanges[budget];
      if (range) {
        return price >= range[0] && price <= range[1];
      }
      return true;
    });
  }

  // Filter by max budget
  if (budget_max) {
    filtered = filtered.filter(item => {
      const price = parseFloat(item.price) || 0;
      return price === 0 || price <= budget_max;
    });
  }

  // Filter by experience level (check tags, description, name for level indicators)
  if (experience_level && experience_level !== 'any') {
    const levelKeywords: Record<string, string[]> = {
      beginner: ['beginner', 'intro', 'introduction', 'starter', 'basic', 'first time', 'newbie', 'fundamentals', 'level 1', 'entry'],
      intermediate: ['intermediate', 'level 2', 'continuing', 'progression', 'next level'],
      advanced: ['advanced', 'expert', 'pro', 'professional', 'master', 'level 3', 'intensive']
    };
    const keywords = levelKeywords[experience_level] || [];
    if (keywords.length > 0) {
      const scoredFiltered = filtered.map(item => {
        const searchText = `${item._name || ''} ${item.tags || ''} ${item.description || ''} ${item.category || ''}`.toLowerCase();
        const matchesLevel = keywords.some(kw => searchText.includes(kw));
        return { item, matchesLevel };
      });
      // Prefer items matching level, but don't exclude others if too few matches
      const matching = scoredFiltered.filter(s => s.matchesLevel).map(s => s.item);
      if (matching.length >= 2) {
        filtered = matching;
      }
      // If fewer than 2 matches, keep all items (level wasn't specified in data)
    }
  }

  // Filter by time preference (morning/afternoon/evening)
  if (time_preference && time_preference !== 'any') {
    const timeRanges: Record<string, [number, number]> = {
      morning: [5, 12],
      afternoon: [12, 17],
      evening: [17, 23]
    };
    const range = timeRanges[time_preference];
    if (range) {
      const timeFiltered = filtered.filter(item => {
        const startTime = item.startTime || item.time;
        if (!startTime) return true; // Keep items without time info
        const hour = parseTimeToHour(startTime);
        if (hour === null) return true;
        return hour >= range[0] && hour < range[1];
      });
      // Only apply filter if we have reasonable results
      if (timeFiltered.length >= 2) {
        filtered = timeFiltered;
      }
    }
  }

  // Filter by day preference (weekday/weekend)
  if (day_preference && day_preference !== 'any') {
    const dayKeywords: Record<string, string[]> = {
      weekday: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'mon', 'tue', 'wed', 'thu', 'fri', 'weekday'],
      weekend: ['saturday', 'sunday', 'sat', 'sun', 'weekend']
    };
    const keywords = dayKeywords[day_preference] || [];
    if (keywords.length > 0) {
      const dayFiltered = filtered.filter(item => {
        const days = (item.days || '').toLowerCase();
        if (!days) return true;
        return keywords.some(kw => days.includes(kw));
      });
      if (dayFiltered.length >= 2) {
        filtered = dayFiltered;
      }
    }
  }

  // Filter by duration preference
  if (duration_preference && duration_preference !== 'any') {
    const durationRanges: Record<string, [number, number]> = {
      quick: [0, 45],      // 0-45 minutes
      standard: [45, 90],  // 45-90 minutes
      extended: [90, 480]  // 90+ minutes
    };
    const range = durationRanges[duration_preference];
    if (range) {
      const durationFiltered = filtered.filter(item => {
        const duration = parseInt(item.duration) || 0;
        if (duration === 0) return true;
        return duration >= range[0] && duration <= range[1];
      });
      if (durationFiltered.length >= 2) {
        filtered = durationFiltered;
      }
    }
  }

  return filtered;
}

/**
 * Parse time string to hour (0-23)
 */
function parseTimeToHour(timeStr: string): number | null {
  if (!timeStr) return null;
  // Handle HH:MM or H:MM format
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    let hour = parseInt(match[1]);
    // Handle AM/PM if present
    if (timeStr.toLowerCase().includes('pm') && hour < 12) {
      hour += 12;
    }
    if (timeStr.toLowerCase().includes('am') && hour === 12) {
      hour = 0;
    }
    return hour;
  }
  return null;
}

/**
 * Semantic matching specifically for recommendations with preference context
 */
async function semanticMatchRecommendations(
  goal: string,
  items: any[],
  apiKey: string,
  preferences: {
    experience_level?: string;
    budget?: string;
    time_preference?: string;
  }
): Promise<Array<{ item: any; score: number; reasoning: string }>> {
  if (!goal || items.length === 0) {
    return items.map(item => ({
      item,
      score: 50,
      reasoning: 'Default match'
    }));
  }

  // Build item descriptions for LLM
  const itemDescriptions = items.map((item, index) => {
    const name = item._name || item.serviceName || item.name || 'Unknown';
    const type = item._type || 'offering';
    const category = item.category || 'General';
    const price = item.price ? `$${item.price}` : 'N/A';
    const tags = item.tags || '';
    const description = item.description || '';
    return `${index}. [${type.toUpperCase()}] "${name}" - Category: ${category}, Price: ${price}, Tags: ${tags}, Description: ${description}`;
  }).join('\n');

  // Build preference context for LLM
  let preferenceContext = '';
  if (preferences.experience_level && preferences.experience_level !== 'any') {
    preferenceContext += `\nUser experience level: ${preferences.experience_level}`;
  }
  if (preferences.budget && preferences.budget !== 'any') {
    preferenceContext += `\nBudget preference: ${preferences.budget}`;
  }
  if (preferences.time_preference && preferences.time_preference !== 'any') {
    preferenceContext += `\nTime preference: ${preferences.time_preference}`;
  }

  const prompt = `You are a recommendation engine. Match the user's goal to the most relevant offerings.

USER'S GOAL: "${goal}"
${preferenceContext ? `\nUSER PREFERENCES:${preferenceContext}` : ''}

AVAILABLE OFFERINGS:
${itemDescriptions}

MATCHING GUIDELINES:
- Focus on semantic relevance to the user's goal
- Consider user preferences when ranking
- A "beginner" looking for pottery should rank beginner classes higher
- Consider synonyms and related concepts
- Price sensitivity: if budget is "low", prefer affordable options
- Return higher scores (80-100) for strong matches, lower (30-60) for weak matches

Return a JSON object with scores and brief reasoning for top matches:
{
  "matches": [
    {"index": 0, "score": 95, "reason": "Perfect match for beginner pottery"},
    {"index": 3, "score": 82, "reason": "Related ceramics class, good for beginners"},
    ...
  ]
}

Only include items with score >= 40. Sort by score descending.
Return JSON only, no markdown:`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-haiku',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.3,
        // Disable reasoning to save tokens and time
        reasoning: { enabled: false },
      })
    });

    if (!response.ok) {
      console.error('[semanticMatchRecommendations] LLM call failed');
      // Fallback: return items with default scores
      return items.slice(0, 5).map(item => ({
        item,
        score: 70,
        reasoning: 'Matches your criteria'
      }));
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content || '';

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const cleanJson = jsonMatch[0]
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');

      const parsed = JSON.parse(cleanJson);
      const matches = parsed.matches || [];

      return matches
        .filter((m: any) => m.index < items.length)
        .map((m: any) => ({
          item: items[m.index],
          score: m.score || 70,
          reasoning: m.reason || 'Matches your preferences'
        }));
    }

    // Fallback
    return items.slice(0, 5).map(item => ({
      item,
      score: 70,
      reasoning: 'Matches your criteria'
    }));
  } catch (error) {
    console.error('[semanticMatchRecommendations] Error:', error);
    return items.slice(0, 5).map(item => ({
      item,
      score: 70,
      reasoning: 'Matches your criteria'
    }));
  }
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
  if (!detectedSchema || typeof detectedSchema !== 'object') {
    console.warn('[findActualTabName] Invalid or missing detectedSchema:', detectedSchema);
    return null;
  }
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
