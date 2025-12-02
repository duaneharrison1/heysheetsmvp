// ============================================================================
// HEYSHEETS MVP - SHARED TYPES
// ============================================================================

/**
 * Classification result from intent classifier
 */
export interface Classification {
  intent: 'SERVICE_INQUIRY' | 'PRODUCT_INQUIRY' | 'INFO_REQUEST' | 'BOOKING_REQUEST' | 'LEAD_GENERATION' | 'RECOMMENDATION_REQUEST' | 'GREETING' | 'OTHER';
  confidence: number; // 0-100
  needs_clarification: boolean;
  clarification_question?: string;
  function_to_call: string | null;
  extracted_params: Record<string, any>;
  reasoning: string;
  user_language?: string; // Detected language of user input (e.g., 'en', 'es', 'fr', 'ja')
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
  lastUserMessage?: string; // For parsing form data from messages
  storeData?: {  // Pre-loaded data from cache to avoid refetching in handlers
    services?: any[];
    products?: any[];
    hours?: any[];
  };
}

/**
 * Function result
 */
export interface FunctionResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  // If true, the orchestrator should bypass the LLM responder and
  // use `message` as a deterministic response (e.g., for critical actions).
  skipResponder?: boolean;
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
  // Optional runtime/debug flag to perform a raw LLM call and bypass
  // the orchestrator's chatbot logic. Useful for QA or simple queries.
  simpleMode?: boolean;
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
  // Dynamic suggestions for follow-up prompts
  suggestions?: string[];
  // Optional debug metadata included in responses (frontend may ignore in production)
  debug?: any;
}

// ============================================================================
// MAILJET TYPES
// ============================================================================

/**
 * Mailjet contact
 */
export interface MailjetContact {
  email: string;
  name?: string;
  isExcludedFromCampaigns?: boolean;
}

/**
 * Mailjet contact list
 */
export interface MailjetContactList {
  id: number;
  name: string;
  subscriberCount: number;
  createdAt: string;
}

/**
 * Mailjet add contact request
 */
export interface MailjetAddContactRequest {
  operation: 'add_contact';
  email: string;
  name?: string;
  listId?: number;
}

/**
 * Mailjet list contacts request
 */
export interface MailjetListContactsRequest {
  operation: 'list_contacts';
  listId?: number;
  limit?: number;
  offset?: number;
}

/**
 * Mailjet send email request
 */
export interface MailjetSendEmailRequest {
  operation: 'send_email';
  to: Array<{ email: string; name?: string }>;
  subject: string;
  htmlContent: string;
  textContent?: string;
  templateId?: number;
  variables?: Record<string, string>;
}

/**
 * Mailjet send campaign request
 */
export interface MailjetSendCampaignRequest {
  operation: 'send_campaign';
  listId: number;
  subject: string;
  htmlContent: string;
  textContent?: string;
  senderEmail?: string;
  senderName?: string;
}

/**
 * Mailjet get lists request
 */
export interface MailjetGetListsRequest {
  operation: 'get_lists';
}

/**
 * Mailjet create list request
 */
export interface MailjetCreateListRequest {
  operation: 'create_list';
  name: string;
}

/**
 * Mailjet sync users request
 */
export interface MailjetSyncUsersRequest {
  operation: 'sync_users';
  listId?: number;
}

/**
 * Mailjet get stats request
 */
export interface MailjetGetStatsRequest {
  operation: 'get_stats';
  listId?: number;
}

/**
 * Union type for all Mailjet requests
 */
export type MailjetRequest =
  | MailjetAddContactRequest
  | MailjetListContactsRequest
  | MailjetSendEmailRequest
  | MailjetSendCampaignRequest
  | MailjetGetListsRequest
  | MailjetCreateListRequest
  | MailjetSyncUsersRequest
  | MailjetGetStatsRequest;
