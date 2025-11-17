import { FunctionContext, FunctionResult, StoreConfig } from '../types.ts';
import {
  validateParams,
  GetStoreInfoSchema,
  GetServicesSchema,
  GetProductsSchema,
  SubmitLeadSchema,
  GetMiscDataSchema
} from './validators.ts';
import { semanticMatch } from './semantic-matcher.ts';

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

  const { info_type } = validation.data;
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
    const actualTab = findActualTabName(expectedTab, detectedSchema);
    if (actualTab) {
      tabMapping[expectedTab] = actualTab;
    }
  }

  // Load data from tabs
  const data: Record<string, any> = {};

  for (const [expectedTab, actualTab] of Object.entries(tabMapping)) {
    try {
      const tabData = await loadTabData(storeId, actualTab, authToken);
      data[expectedTab] = tabData;
    } catch (error) {
      console.error(`[getStoreInfo] Error loading ${actualTab}:`, error);
      data[expectedTab] = [];
    }
  }

  return {
    success: true,
    data: {
      store_name: store?.name || 'Unknown',
      info_type,
      ...data
    }
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

  const { query, category } = validation.data;
  const { storeId, authToken, store } = context;

  // Find services tab
  const detectedSchema = store?.detected_schema || {};
  const servicesTab = findActualTabName('services', detectedSchema);

  if (!servicesTab) {
    return {
      success: false,
      error: 'Services data not available. Please ensure your sheet has a services tab.'
    };
  }

  // Load all services
  let services = await loadTabData(storeId, servicesTab, authToken);

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

  return {
    success: true,
    data: {
      services,
      count: services.length,
      query: query || null,
      category: category || null
    }
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

  const { query, category } = validation.data;
  const { storeId, authToken, store } = context;

  // Find products tab
  const detectedSchema = store?.detected_schema || {};
  const productsTab = findActualTabName('products', detectedSchema);

  if (!productsTab) {
    return {
      success: false,
      error: 'Products data not available. Please ensure your sheet has a products tab.'
    };
  }

  // Load all products
  let products = await loadTabData(storeId, productsTab, authToken);

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

  return {
    success: true,
    data: {
      products,
      count: products.length,
      query: query || null,
      category: category || null
    }
  };
}

// ============================================================================
// FUNCTION: submit_lead
// ============================================================================

async function submitLead(
  params: any,
  context: FunctionContext
): Promise<FunctionResult> {
  // Validate base params
  const validation = validateParams(SubmitLeadSchema, params);
  if (!validation.valid) {
    return {
      success: false,
      error: `Invalid parameters: ${validation.errors.join(', ')}`
    };
  }

  const { storeId, authToken, store } = context;

  // Find leads tab
  const detectedSchema = store?.detected_schema || {};
  const leadsTab = findActualTabName('leads', detectedSchema);

  if (!leadsTab) {
    return {
      success: false,
      error: 'Lead capture not available. Please ensure your sheet has a leads tab.'
    };
  }

  // Get leads tab schema to know what columns exist
  const leadsSchema = detectedSchema[leadsTab];
  const columns = leadsSchema?.columns || ['Date', 'Name', 'Email', 'Phone', 'Status'];

  // Build data object matching sheet columns
  const leadData: Record<string, any> = {
    Date: new Date().toISOString(),
    Name: params.name,
    Email: params.email,
    Phone: params.phone || '',
    Status: 'new'
  };

  // Add any additional fields from params that match column names
  for (const col of columns) {
    if (col !== 'Date' && col !== 'Status' && params[col] !== undefined) {
      leadData[col] = params[col];
    }
  }

  // Append to sheet
  try {
    await appendToSheet(storeId, leadsTab, leadData, authToken);

    return {
      success: true,
      data: {
        message: "Thank you! We've received your information and will get back to you soon.",
        lead_id: new Date().toISOString()
      }
    };
  } catch (error) {
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

  const { tab_name, query } = validation.data;
  const { storeId, authToken, store } = context;

  // Find the requested tab
  const detectedSchema = store?.detected_schema || {};
  const actualTab = findActualTabName(tab_name, detectedSchema);

  if (!actualTab) {
    return {
      success: false,
      error: `Tab "${tab_name}" not found. Available tabs: ${Object.keys(detectedSchema).join(', ')}`
    };
  }

  // Load data from tab
  let data = await loadTabData(storeId, actualTab, authToken);

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
  authToken: string
): Promise<any[]> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

  const response = await fetch(`${SUPABASE_URL}/functions/v1/google-sheet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      operation: 'read',
      storeId,
      tabName
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${tabName}: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data || [];
}

/**
 * Append data to a sheet tab via google-sheet function
 */
async function appendToSheet(
  storeId: string,
  tabName: string,
  data: Record<string, any>,
  authToken: string
): Promise<void> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

  const response = await fetch(`${SUPABASE_URL}/functions/v1/google-sheet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
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
