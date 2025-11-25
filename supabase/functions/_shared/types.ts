// ============================================================================
// HEYSHEETS MVP - SHARED TYPES
// ============================================================================

/**
 * Classification result from intent classifier
 */
export interface Classification {
  intent: 'SERVICE_INQUIRY' | 'PRODUCT_INQUIRY' | 'INFO_REQUEST' | 'BOOKING_REQUEST' | 'LEAD_GENERATION' | 'GREETING' | 'OTHER';
  confidence: number; // 0-100
  needs_clarification: boolean;
  clarification_question?: string;
  function_to_call: string | null;
  extracted_params: Record<string, any>;
  reasoning: string;
}

/**
 * Store data loaded from Google Sheets
 */
export interface StoreData {
  services: ServiceRecord[];
  products: ProductRecord[];
  hours: HoursRecord[];
}

/**
 * Store configuration from database
 */
export interface StoreConfig {
  id: string;
  name: string;
  type: string;
  description?: string;
  sheet_id: string;
  detected_schema?: DetectedSchema;
  system_prompt?: string;
}

/**
 * Detected schema structure from database
 */
export interface DetectedSchema {
  [tabName: string]: {
    columns: string[];
    sample_rows: Record<string, any>[];
  };
}

/**
 * Service record from sheets
 */
export interface ServiceRecord {
  serviceID?: string;
  serviceName: string;
  category?: string;
  price?: number;
  duration?: number;
  capacity?: number;
  description?: string;
  days?: string;
  startTime?: string;
  endTime?: string;
  imageURL?: string;
  tags?: string;
  status?: string;
}

/**
 * Product record from sheets
 */
export interface ProductRecord {
  name: string;
  category?: string;
  price?: number;
  stock?: number;
  description?: string;
  imageURL?: string;
  tags?: string;
  status?: string;
}

/**
 * Hours record from sheets
 */
export interface HoursRecord {
  day: string;
  openTime: string;
  closeTime: string;
  isOpen: string | boolean;
  notes?: string;
}

/**
 * Function execution context
 */
export interface FunctionContext {
  storeId: string;
  userId: string;
  authToken: string;
  store?: StoreConfig;
  requestId?: string; // For correlation across edge functions
}

/**
 * Function result
 */
export interface FunctionResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  needs_clarification?: boolean;
  // Flag indicating we're waiting for user input (e.g., form submission)
  // This is NOT an error - just means we need more info from the user
  awaiting_input?: boolean;
  // Optional UI component payload that frontend can render
  components?: Array<Record<string, any>>;
  // Version of the components payload schema
  componentsVersion?: string;
}

/**
 * Message format
 */
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Chat completion request
 */
export interface ChatCompletionRequest {
  messages: Message[];
  storeId: string;
  model?: string; // optional model override from frontend
}

/**
 * Chat completion response
 */
export interface ChatCompletionResponse {
  text: string;
  intent: string;
  confidence: number;
  functionCalled?: string;
  functionResult?: FunctionResult;
  // Optional debug metadata included in responses (frontend may ignore in production)
  debug?: any;
}
