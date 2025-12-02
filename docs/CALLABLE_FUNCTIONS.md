# HeySheets Callable Functions Documentation

This document provides comprehensive documentation of ALL functions/tools that the chat system can call. This is intended for implementing native tool calling.

---

## Section 1: All Functions

### Function: get_store_info

**File Path:** `supabase/functions/tools/index.ts`
**Line Numbers:** 64-184

**Description:**
Retrieves store information from Google Sheets. Loads data from requested tabs (store_info, hours, services, products). Uses detected_schema to find actual tab names via fuzzy matching.

**Parameters:**
| Parameter | Type | Required? | Description |
|-----------|------|-----------|-------------|
| info_type | enum | No | 'hours' \| 'services' \| 'products' \| 'all' (default: 'all') |

**Returns:**
```typescript
{
  success: boolean;
  data: {
    store_name: string;
    info_type: string;
    store_info?: any[];
    hours?: any[];
    services?: any[];
    products?: any[];
  };
  message: string;
  components?: Array<{ id: string; type: 'HoursList'; props: { hours: any[] } }>;
  componentsVersion: '1';
}
```

**Needs Real-Time Data?** No - Uses cached schema, loads from Google Sheets

**Zod Schema:**
```typescript
export const GetStoreInfoSchema = z.object({
  info_type: z.enum(['hours', 'services', 'products', 'all']).optional().default('all')
});
```

---

### Function: get_services

**File Path:** `supabase/functions/tools/index.ts`
**Line Numbers:** 190-277

**Description:**
Retrieves and searches services from Google Sheets. Applies semantic matching if query provided (uses OpenRouter API). Filters by category if specified. Returns UI components for service display.

**Parameters:**
| Parameter | Type | Required? | Description |
|-----------|------|-----------|-------------|
| query | string | No | Search term or description (e.g., "sake", "beginner pottery") |
| category | string | No | Specific category name to filter by |

**Returns:**
```typescript
{
  success: boolean;
  data: {
    services: ServiceRecord[];
    count: number;
    query: string | null;
    category: string | null;
  };
  message: string;
  components?: Array<{ id: string; type: 'services'; props: { services: any[] } }>;
  componentsVersion: '1';
}
```

**Needs Real-Time Data?** No - Uses cached data with optional semantic matching

**Zod Schema:**
```typescript
export const GetServicesSchema = z.object({
  query: z.string().optional().nullable().transform((val) => val ?? undefined),
  category: z.string().optional().nullable().transform((val) => val ?? undefined)
});
```

---

### Function: get_products

**File Path:** `supabase/functions/tools/index.ts`
**Line Numbers:** 283-369

**Description:**
Retrieves and searches products from Google Sheets. Applies semantic matching if query provided. Filters by category if specified. Returns UI components for product display.

**Parameters:**
| Parameter | Type | Required? | Description |
|-----------|------|-----------|-------------|
| query | string | No | Search term or description for products |
| category | string | No | Specific category to filter by |

**Returns:**
```typescript
{
  success: boolean;
  data: {
    products: ProductRecord[];
    count: number;
    query: string | null;
    category: string | null;
  };
  message: string;
  components?: Array<{ id: string; type: 'products'; props: { products: any[] } }>;
  componentsVersion: '1';
}
```

**Needs Real-Time Data?** No - Uses cached data with optional semantic matching

**Zod Schema:**
```typescript
export const GetProductsSchema = z.object({
  query: z.string().optional().nullable().transform((val) => val ?? undefined),
  category: z.string().optional().nullable().transform((val) => val ?? undefined)
});
```

---

### Function: submit_lead

**File Path:** `supabase/functions/tools/index.ts`
**Line Numbers:** 400-572

**Description:**
Captures user contact information for lead generation. Dynamically generates form fields based on sheet columns. If required fields are missing, returns LeadForm UI component. Validates required fields (first 2 columns, typically name/email). Appends lead data to Google Sheets.

**Parameters:**
| Parameter | Type | Required? | Description |
|-----------|------|-----------|-------------|
| name | string | Yes | User's full name (minimum 2 characters) |
| email | string | Yes | Valid email address |
| phone | string | No | Phone number |
| *dynamic* | any | Varies | Additional fields based on Leads sheet columns |

**Returns:**
```typescript
// If missing required fields:
{
  success: true;
  awaiting_input: true;
  data: {
    missing_fields: string[];
    fields: Array<{ name: string; label: string; type: string; required: boolean; placeholder: string }>;
  };
  message: string;
  components?: Array<{ id: string; type: 'LeadForm'; props: { fields: any[]; defaultValues: Record<string, string> } }>;
  componentsVersion: '1';
}

// If all fields present:
{
  success: true;
  data: {
    message: string;
    lead_id: string;
  };
}
```

**Needs Real-Time Data?** Yes - Writes to Google Sheets

**Zod Schema:**
```typescript
export const SubmitLeadSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional()
});
```

---

### Function: get_misc_data

**File Path:** `supabase/functions/tools/index.ts`
**Line Numbers:** 578-651

**Description:**
Accesses custom tabs not in standard tabs (Services, Products, Hours). Useful for FAQ, Policies, Testimonials, or other custom data. Applies simple text filtering if query provided.

**Parameters:**
| Parameter | Type | Required? | Description |
|-----------|------|-----------|-------------|
| tab_name | string | Yes | Custom tab name (e.g., 'FAQ', 'Policies', 'Testimonials') |
| query | string | No | Search term to filter rows |

**Returns:**
```typescript
{
  success: boolean;
  data: {
    tab_name: string;
    data: any[];
    count: number;
    query: string | null;
  };
  error?: string;
}
```

**Needs Real-Time Data?** No - Reads from Google Sheets

**Zod Schema:**
```typescript
export const GetMiscDataSchema = z.object({
  tab_name: z.string().min(1, "Tab name is required"),
  query: z.string().optional()
});
```

---

### Function: check_availability

**File Path:** `supabase/functions/tools/calendar-booking.ts`
**Line Numbers:** 126-335

**Description:**
Checks if a service is available at a specific date/time. Queries Google Calendar for availability events. Checks booking capacity (current bookings vs. capacity). Validates requested time falls within availability window.

**Parameters:**
| Parameter | Type | Required? | Description |
|-----------|------|-----------|-------------|
| service_name | string | Yes* | Name of the service to check |
| date | string | Yes* | Date in YYYY-MM-DD format |
| time | string | Yes* | Time in HH:MM format |

*All three are required for the function to work; returns needs_clarification if missing.

**Returns:**
```typescript
{
  success: boolean;
  available: boolean;
  service?: string;
  date?: string;
  time?: string;
  capacity?: number;
  booked?: number;
  available_spots?: number;
  price?: string;
  duration?: number;
  message: string;
  error?: string;
  needs_clarification?: boolean;
}
```

**Needs Real-Time Data?** Yes - Queries Google Calendar API

**Zod Schema:**
```typescript
export const CheckAvailabilitySchema = z.object({
  service_name: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional()
});
```

---

### Function: get_booking_slots

**File Path:** `supabase/functions/tools/calendar-booking.ts`
**Line Numbers:** 341-719

**Description:**
Displays available booking slots for a service. Shows visual calendar picker (BookingCalendar component). Generates time slots based on availability windows and service duration. Checks booking capacity for each slot. Handles unavailable dates/times with deterministic responses (skipResponder flag).

**Parameters:**
| Parameter | Type | Required? | Description |
|-----------|------|-----------|-------------|
| service_name | string | Yes | Name of service to get slots for |
| start_date | string | No | Start date in YYYY-MM-DD format (default: today) |
| end_date | string | No | End date in YYYY-MM-DD format (default: today + 14 days) |
| prefill_date | string | No | Pre-selected date for the booking form |
| prefill_time | string | No | Pre-selected time for the booking form |
| prefill_name | string | No | Pre-filled customer name |
| prefill_email | string | No | Pre-filled customer email |
| prefill_phone | string | No | Pre-filled customer phone |

**Returns:**
```typescript
{
  success: boolean;
  service: {
    id: string;
    name: string;
    duration: string;
    price: string;
  };
  slots: Array<{
    date: string;
    time: string;
    endTime: string;
    spotsLeft: number;
  }>;
  unavailableDates: string[];
  availableDates: string[];
  prefill: {
    date?: string;
    time?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  requestedDateAvailable?: boolean;
  requestedTimeAvailable?: boolean;
  message: string;
  components: Array<{ type: 'BookingCalendar'; props: any }>;
  componentsVersion: '1';
  skipResponder?: boolean;  // Deterministic response flag
}
```

**Needs Real-Time Data?** Yes - Queries Google Calendar API

**Zod Schema:**
```typescript
export const GetBookingSlotsSchema = z.object({
  service_name: z.string(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  prefill_date: z.string().optional(),
  prefill_time: z.string().optional(),
  prefill_name: z.string().optional(),
  prefill_email: z.string().optional(),
  prefill_phone: z.string().optional()
});
```

---

### Function: create_booking

**File Path:** `supabase/functions/tools/calendar-booking.ts`
**Line Numbers:** 724-981

**Description:**
Creates an actual booking in Google Calendar. Validates all required fields. Checks if availability event exists for the requested date/time. Verifies booking capacity not exceeded. Creates calendar event with extended properties. Stores customer details in event description/properties.

**Parameters:**
| Parameter | Type | Required? | Description |
|-----------|------|-----------|-------------|
| service_name | string | Yes | Service name to book |
| date | string | Yes | Booking date in YYYY-MM-DD format |
| time | string | Yes | Booking time in HH:MM format |
| customer_name | string | Yes | Full name of person making booking |
| customer_email | string | Yes | Email address for confirmation |
| customer_phone | string | No | Phone number for the booking |

**Returns:**
```typescript
{
  success: boolean;
  booking_id?: string;
  service?: string;
  date?: string;
  time?: string;
  duration?: number;
  price?: string;
  customer_name?: string;
  customer_email?: string;
  available_spots_remaining?: number;
  message?: string;
  error?: string;
  needs_clarification?: boolean;
}
```

**Needs Real-Time Data?** Yes - Creates Google Calendar events

**Zod Schema:**
```typescript
export const CreateBookingSchema = z.object({
  service_name: z.string(),
  date: z.string(),
  time: z.string(),
  customer_name: z.string(),
  customer_email: z.string().email(),
  customer_phone: z.string().optional()
});
```

---

## Section 2: Function Categories

### Data Retrieval Functions
| Function | Description |
|----------|-------------|
| get_store_info | Get store details, hours, general info |
| get_services | Search and filter services with semantic matching |
| get_products | Search and filter products with semantic matching |
| get_misc_data | Access custom tabs like FAQ, Policies, etc. |

### Booking Functions
| Function | Description |
|----------|-------------|
| check_availability | Check if a service is available at specific date/time |
| get_booking_slots | Show visual booking calendar with available times |
| create_booking | Create an actual booking with calendar invite |

### Lead Generation Functions
| Function | Description |
|----------|-------------|
| submit_lead | Capture user contact information and interest |

---

## Section 3: Classifier Integration

**File Path:** `supabase/functions/classifier/index.ts`

### Intent to Function Mapping

| Intent | function_to_call | Use Case |
|--------|------------------|----------|
| SERVICE_INQUIRY | get_services | User asking about services/classes |
| PRODUCT_INQUIRY | get_products | User asking about products for sale |
| INFO_REQUEST | get_store_info | User wants general store information |
| BOOKING_REQUEST | get_booking_slots | User wants to book a service |
| LEAD_GENERATION | submit_lead | User wants to be contacted or leave info |
| GREETING | null | Greeting or small talk |
| OTHER | null | Unclear intent |

### Classifier Output Format

```typescript
interface Classification {
  intent: 'SERVICE_INQUIRY' | 'PRODUCT_INQUIRY' | 'INFO_REQUEST' |
          'BOOKING_REQUEST' | 'LEAD_GENERATION' | 'GREETING' | 'OTHER';
  confidence: number; // 0-100
  needs_clarification: boolean;
  clarification_question?: string;
  function_to_call: string | null;
  extracted_params: {
    // Common params
    info_type?: string;
    query?: string;
    category?: string;
    tab_name?: string;

    // Lead params
    name?: string;
    email?: string;
    phone?: string;
    message?: string;

    // Booking params
    service_name?: string;
    date?: string;       // YYYY-MM-DD
    time?: string;       // HH:MM
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;

    // Prefill params for get_booking_slots
    prefill_date?: string;
    prefill_time?: string;
    prefill_name?: string;
    prefill_email?: string;
    prefill_phone?: string;
  };
  reasoning: string;
}
```

### Possible function_to_call Values

```typescript
enum FunctionToCall {
  'get_store_info',
  'get_services',
  'get_products',
  'submit_lead',
  'get_misc_data',
  'check_availability',
  'create_booking',
  'get_booking_slots',
  'null'  // For greetings and unclear intents
}
```

---

## Section 4: Function Execution Flow

**Main Executor:** `supabase/functions/tools/index.ts:19-58`

```typescript
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
```

### FunctionContext Type

```typescript
interface FunctionContext {
  storeId: string;
  userId: string;
  authToken: string;
  store?: StoreConfig;
  requestId?: string;       // For correlation across edge functions
  lastUserMessage?: string; // For parsing form data from messages
}
```

### Execution Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Message                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              chat-completion/index.ts                            │
│  1. Load store config                                            │
│  2. Pre-load store data (services, products, hours)              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  classifier/index.ts                             │
│  - Classify intent                                               │
│  - Extract parameters                                            │
│  - Determine function_to_call                                    │
│  Returns: { classification, usage }                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    tools/index.ts                                │
│  executeFunction(function_to_call, extracted_params, context)    │
│  Returns: FunctionResult                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   skipResponder: true    │     │   skipResponder: false   │
│   (Deterministic)        │     │   (LLM Response)         │
│                          │     │                          │
│   Use functionResult     │     │   responder/index.ts     │
│   .message directly      │     │   generateResponse()     │
└─────────────────────────┘     └─────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 ChatCompletionResponse                           │
│  { text, intent, confidence, functionCalled, functionResult,    │
│    suggestions, debug }                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Section 5: Response Patterns

### Standard Response Pattern

```typescript
interface FunctionResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  skipResponder?: boolean;    // Bypass LLM responder
  needs_clarification?: boolean;
  awaiting_input?: boolean;   // Waiting for user input (form)
  components?: Array<Record<string, any>>;
  componentsVersion?: string;
}
```

### Rich Content Pattern

Functions can return UI components that the frontend renders:

```typescript
// HoursList component
{
  id: 'hours-store-123',
  type: 'HoursList',
  props: {
    hours: [
      { day: 'Monday', openTime: '09:00', closeTime: '18:00', isOpen: true }
    ]
  }
}

// Services component
{
  id: 'services-store-123',
  type: 'services',
  props: {
    services: [
      { serviceName: 'Pottery Class', price: 50, duration: 120 }
    ]
  }
}

// Products component
{
  id: 'products-store-123',
  type: 'products',
  props: {
    products: [
      { name: 'Ceramic Mug', price: 25, category: 'Mugs' }
    ]
  }
}

// LeadForm component
{
  id: 'lead-form-store-123-1234567890',
  type: 'LeadForm',
  props: {
    fields: [
      { name: 'Name', label: 'Name', type: 'text', required: true, placeholder: 'Your full name' },
      { name: 'Email', label: 'Email', type: 'email', required: true, placeholder: 'you@example.com' }
    ],
    defaultValues: { Name: 'John' }
  }
}

// BookingCalendar component
{
  id: 'booking-calendar-store-123-1234567890',
  type: 'BookingCalendar',
  props: {
    service: { id: 'S001', name: 'Pottery Class', duration: '120 min', price: '50' },
    slots: [
      { date: '2025-12-03', time: '10:00', endTime: '12:00', spotsLeft: 5 }
    ],
    unavailableDates: ['2025-12-01', '2025-12-02'],
    prefill: { name: 'John', email: 'john@example.com' }
  }
}
```

### skipResponder Pattern

Used for deterministic responses (bypasses LLM):

```typescript
// In get_booking_slots when date is unavailable
return {
  success: true,
  service: { id: 'S001', name: 'Pottery Class', ... },
  slots: [...],
  message: `I'd love to help you book Pottery Class! Unfortunately, 2025-12-01 isn't available...`,
  skipResponder: true  // This message is used directly, no LLM call
};
```

---

## Section 6: Complete Function List

| Function Name | Category | File Path | Parameters | Uses Cache? | Has Rich Content? | Can Skip Responder? |
|---------------|----------|-----------|------------|-------------|-------------------|---------------------|
| get_store_info | Data Retrieval | tools/index.ts:64 | info_type | No | Yes (HoursList) | No |
| get_services | Data Retrieval | tools/index.ts:190 | query, category | No | Yes (services) | No |
| get_products | Data Retrieval | tools/index.ts:283 | query, category | No | Yes (products) | No |
| submit_lead | Lead Gen | tools/index.ts:400 | name, email, phone, * | No | Yes (LeadForm) | No |
| get_misc_data | Data Retrieval | tools/index.ts:578 | tab_name, query | No | No | No |
| check_availability | Booking | calendar-booking.ts:126 | service_name, date, time | No | No | No |
| get_booking_slots | Booking | calendar-booking.ts:341 | service_name, dates, prefill_* | No | Yes (BookingCalendar) | Yes |
| create_booking | Booking | calendar-booking.ts:724 | service_name, date, time, customer_* | No | No | No |

---

## Section 7: Tool Definitions for Native Tool Calling

OpenAI-compatible tool definitions ready for implementation:

```typescript
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_store_info',
      description: 'Get store details, hours, services, and products overview. Use when user asks general questions about the store, what they offer, or wants to see everything available.',
      parameters: {
        type: 'object',
        properties: {
          info_type: {
            type: 'string',
            enum: ['hours', 'services', 'products', 'all'],
            description: "Type of info to retrieve. 'all' returns everything."
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_services',
      description: 'Search and retrieve services/classes. Use when user asks about specific services, wants to browse services, or describes what they are looking for. Supports semantic matching for vague queries.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search term or description (e.g., "sake", "beginner pottery", "weekend classes")'
          },
          category: {
            type: 'string',
            description: 'Specific category to filter by if explicitly mentioned'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_products',
      description: 'Search and retrieve products for sale. Use when user asks about specific products, wants to browse products, or describes what they want to buy. Supports semantic matching.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search term or description for products'
          },
          category: {
            type: 'string',
            description: 'Specific category to filter by if explicitly mentioned'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'submit_lead',
      description: 'Capture user contact information. Use when user wants to be contacted, sign up for updates, leave their info, or shows interest in being reached. ALWAYS call this even if info is missing - it will return a form.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: "User's full name"
          },
          email: {
            type: 'string',
            description: "User's email address"
          },
          phone: {
            type: 'string',
            description: "User's phone number (optional)"
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_misc_data',
      description: 'Access custom data tabs like FAQ, Policies, Testimonials, or any other custom tab. Use when user asks about topics not covered by standard tabs.',
      parameters: {
        type: 'object',
        properties: {
          tab_name: {
            type: 'string',
            description: "Name of the custom tab to access (e.g., 'FAQ', 'Policies')"
          },
          query: {
            type: 'string',
            description: 'Optional search term to filter results'
          }
        },
        required: ['tab_name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_availability',
      description: 'Check if a specific service is available at a specific date and time. Use when user asks "is X available on Y at Z?" - just checking, not booking.',
      parameters: {
        type: 'object',
        properties: {
          service_name: {
            type: 'string',
            description: 'Name of the service to check'
          },
          date: {
            type: 'string',
            description: 'Date in YYYY-MM-DD format'
          },
          time: {
            type: 'string',
            description: 'Time in HH:MM format'
          }
        },
        required: ['service_name', 'date', 'time']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_booking_slots',
      description: 'Show visual booking calendar with available times for a service. ALWAYS use this when user wants to book/schedule/reserve a service, even if they have not specified date/time. Extracts any mentioned details as prefill values.',
      parameters: {
        type: 'object',
        properties: {
          service_name: {
            type: 'string',
            description: 'Name of the service to book'
          },
          start_date: {
            type: 'string',
            description: 'Start of date range in YYYY-MM-DD format (default: today)'
          },
          end_date: {
            type: 'string',
            description: 'End of date range in YYYY-MM-DD format (default: today + 14 days)'
          },
          prefill_date: {
            type: 'string',
            description: 'Pre-selected date if user mentioned one (YYYY-MM-DD)'
          },
          prefill_time: {
            type: 'string',
            description: 'Pre-selected time if user mentioned one (HH:MM)'
          },
          prefill_name: {
            type: 'string',
            description: "User's name if mentioned"
          },
          prefill_email: {
            type: 'string',
            description: "User's email if mentioned"
          },
          prefill_phone: {
            type: 'string',
            description: "User's phone if mentioned"
          }
        },
        required: ['service_name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_booking',
      description: 'Create an actual booking with calendar invite. ONLY call this when you have ALL required info: service_name, date, time, customer_name, AND customer_email. Usually called from booking calendar UI.',
      parameters: {
        type: 'object',
        properties: {
          service_name: {
            type: 'string',
            description: 'Name of the service to book'
          },
          date: {
            type: 'string',
            description: 'Booking date in YYYY-MM-DD format'
          },
          time: {
            type: 'string',
            description: 'Booking time in HH:MM format'
          },
          customer_name: {
            type: 'string',
            description: 'Full name of person making booking'
          },
          customer_email: {
            type: 'string',
            description: 'Email address for confirmation'
          },
          customer_phone: {
            type: 'string',
            description: 'Phone number (optional)'
          }
        },
        required: ['service_name', 'date', 'time', 'customer_name', 'customer_email']
      }
    }
  }
];
```

---

## Section 8: Dependencies

| Function | Needs Store Config? | Needs Google Sheets? | Needs Calendar? | Needs Supabase? |
|----------|---------------------|---------------------|-----------------|-----------------|
| get_store_info | Yes | Yes | No | Yes (for store config) |
| get_services | Yes | Yes | No | Yes (for store config) |
| get_products | Yes | Yes | No | Yes (for store config) |
| submit_lead | Yes | Yes (write) | No | Yes (for store config) |
| get_misc_data | Yes | Yes | No | Yes (for store config) |
| check_availability | Yes | Yes | Yes | Yes (for calendar mappings) |
| get_booking_slots | Yes | Yes | Yes | Yes (for calendar mappings) |
| create_booking | Yes | Yes | Yes (write) | Yes (for calendar mappings) |

### External API Dependencies

| Function | OpenRouter API | Google Sheets API | Google Calendar API |
|----------|---------------|-------------------|---------------------|
| get_store_info | No | Read | No |
| get_services | Yes (semantic match) | Read | No |
| get_products | Yes (semantic match) | Read | No |
| submit_lead | No | Read/Write | No |
| get_misc_data | No | Read | No |
| check_availability | No | Read | Read |
| get_booking_slots | No | Read | Read |
| create_booking | No | Read | Read/Write |

---

## Section 9: Edge Cases & Validation

### Pre-Execution Validation

1. **Parameter Validation** - All functions use Zod schemas (see `tools/validators.ts`)
2. **Store Existence** - Store config loaded from Supabase; returns 404 if not found
3. **Tab Existence** - Functions check for tab in detected_schema; returns error if missing
4. **Calendar Setup** - Booking functions check for `invite_calendar_id`; return error if not configured

### Fallback Behaviors

1. **Tab Not Found in Schema** - Functions try direct query with common tab names:
   - Services: `['Services', 'services', 'SERVICES', 'Service']`
   - Products: `['Products', 'products', 'PRODUCTS', 'Product', 'Inventory']`
   - Hours: `['Hours', 'hours', 'HOURS', 'Store Hours', 'Opening Hours']`

2. **Semantic Match Unavailable** - Returns unfiltered results if OpenRouter fails

3. **Missing Required Booking Fields** - Returns `needs_clarification: true` with message

### Error Types

| Error | When It Occurs | Response |
|-------|----------------|----------|
| `Unknown function` | Invalid function_to_call | `{ success: false, error: 'Unknown function: X' }` |
| `Services data not available` | No Services tab found | `{ success: false, error: '...' }` |
| `Products data not available` | No Products tab found | `{ success: false, error: '...' }` |
| `Lead capture not available` | No Leads tab found | `{ success: false, error: '...' }` |
| `Tab "X" not found` | get_misc_data with invalid tab | `{ success: false, error: '...' }` |
| `Calendar booking not set up` | No invite_calendar_id | `{ success: false, error: '...' }` |
| `Service not linked to calendar` | No calendar mapping for service | `{ success: false, error: '...' }` |
| `no_class_scheduled` | Booking on unavailable date/time | `{ success: false, error: 'no_class_scheduled', message: '...' }` |
| `fully_booked` | Capacity reached | `{ success: false, error: 'fully_booked', message: '...' }` |

### Rate Limits & Guards

1. **No explicit rate limits** in function code
2. **Capacity checks** for bookings prevent overbooking
3. **Validation** prevents invalid data from being written

---

## Section 10: Key Code References

### Function Executor Entry Point
`supabase/functions/tools/index.ts:19-58`

### Classifier with Function Mapping
`supabase/functions/classifier/index.ts:1-307`

### Validation Schemas
`supabase/functions/tools/validators.ts:1-86`

### Calendar Booking Functions
`supabase/functions/tools/calendar-booking.ts:1-982`

### Type Definitions
`supabase/functions/_shared/types.ts:1-274`

### Main Orchestrator
`supabase/functions/chat-completion/index.ts:1-537`
