import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

export const GetStoreInfoSchema = z.object({
  info_type: z.enum(['hours', 'services', 'products', 'all']).optional().default('all')
});

export const GetServicesSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional()
});

export const GetProductsSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional()
});

export const SubmitLeadSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional()
  // Additional fields will be dynamic based on leads sheet headers
});

export const GetMiscDataSchema = z.object({
  tab_name: z.string().min(1, "Tab name is required"),
  query: z.string().optional()
});

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function validateParams<T>(
  schema: z.ZodSchema<T>,
  params: any
): { valid: true; data: T } | { valid: false; errors: string[] } {
  try {
    const data = schema.parse(params);
    return { valid: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      };
    }
    return {
      valid: false,
      errors: [error.message || 'Validation failed']
    };
  }
}
