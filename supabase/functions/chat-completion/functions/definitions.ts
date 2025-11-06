// Function definitions for the AI to call

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export const FUNCTION_DEFINITIONS: FunctionDefinition[] = [
  {
    name: 'get_store_info',
    description: 'Get information about the store (hours, location, services, products)',
    parameters: {
      type: 'object',
      properties: {
        info_type: {
          type: 'string',
          enum: ['hours', 'location', 'services', 'products', 'all'],
          description: 'Type of information to retrieve'
        }
      },
      required: ['info_type']
    }
  },

  {
    name: 'check_availability',
    description: 'Check available time slots for a specific service on a given date',
    parameters: {
      type: 'object',
      properties: {
        service_name: {
          type: 'string',
          description: 'Exact name of the service to check'
        },
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format'
        }
      },
      required: ['service_name', 'date']
    }
  },

  {
    name: 'create_booking',
    description: 'Create a confirmed booking. Only call when ALL required information is collected.',
    parameters: {
      type: 'object',
      properties: {
        service_name: {
          type: 'string',
          description: 'Name of the service'
        },
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format'
        },
        time: {
          type: 'string',
          description: 'Time in HH:MM format (24-hour)'
        },
        customer_name: {
          type: 'string',
          description: 'Customer full name'
        },
        email: {
          type: 'string',
          description: 'Customer email address'
        },
        phone: {
          type: 'string',
          description: 'Customer phone number'
        }
      },
      required: ['service_name', 'date', 'time', 'customer_name', 'email']
    }
  },

  {
    name: 'get_products',
    description: 'Get product catalog, optionally filtered by category',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Product category to filter by (optional)'
        }
      },
      required: []
    }
  }
];
