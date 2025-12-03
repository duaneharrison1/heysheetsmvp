// Allow the Deno remote import to be used at runtime while silencing
// TypeScript's module resolution in this editor environment.
// @ts-ignore: Deno remote import
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

export const GetStoreInfoSchema = z.object({
  info_type: z.enum(['hours', 'services', 'products', 'all']).optional().default('all')
});

export const GetServicesSchema = z.object({
  query: z.string().optional().nullable().transform((val: string | null | undefined) => val ?? undefined),
  category: z.string().optional().nullable().transform((val: string | null | undefined) => val ?? undefined)
});

export const GetProductsSchema = z.object({
  query: z.string().optional().nullable().transform((val: string | null | undefined) => val ?? undefined),
  category: z.string().optional().nullable().transform((val: string | null | undefined) => val ?? undefined)
});

// Search schemas - require query for semantic matching
export const SearchServicesSchema = z.object({
  query: z.string().min(1, "Search query is required")
});

export const SearchProductsSchema = z.object({
  query: z.string().min(1, "Search query is required")
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

export const CheckAvailabilitySchema = z.object({
  service_name: z.string().optional(),
  date: z.string().optional(), // YYYY-MM-DD
  time: z.string().optional()  // HH:MM
});

export const CreateBookingSchema = z.object({
  service_name: z.string(),
  date: z.string(), // YYYY-MM-DD
  time: z.string(), // HH:MM
  customer_name: z.string(),
  customer_email: z.string().email(),
  customer_phone: z.string().optional()
});

export const GetBookingSlotsSchema = z.object({
  service_name: z.string(),
  start_date: z.string().optional(), // YYYY-MM-DD
  end_date: z.string().optional(),   // YYYY-MM-DD
  // Prefill data from user message
  prefill_date: z.string().optional(),
  prefill_time: z.string().optional(),
  prefill_name: z.string().optional(),
  prefill_email: z.string().optional(),
  prefill_phone: z.string().optional()
});

export const GetRecommendationsSchema = z.object({
  // What type of offering to recommend (auto-detected from store data if not specified)
  offering_type: z.enum(['services', 'products', 'both']).optional().default('both'),
  // Generic preference fields (all optional - collect progressively via conversation)
  budget: z.enum(['low', 'medium', 'high']).optional().nullable().transform((val) => val ?? undefined),
  budget_max: z.number().optional().nullable().transform((val) => val ?? undefined), // Specific max price
  experience_level: z.enum(['beginner', 'intermediate', 'advanced', 'any']).optional().nullable().transform((val) => val ?? undefined),
  time_preference: z.enum(['morning', 'afternoon', 'evening', 'any']).optional().nullable().transform((val) => val ?? undefined),
  day_preference: z.enum(['weekday', 'weekend', 'any']).optional().nullable().transform((val) => val ?? undefined),
  duration_preference: z.enum(['quick', 'standard', 'extended', 'any']).optional().nullable().transform((val) => val ?? undefined),
  // Free-text goal/interest for semantic matching (most important field)
  goal: z.string().optional().nullable().transform((val) => val ?? undefined),
  // Category preference if user mentions one
  category: z.string().optional().nullable().transform((val) => val ?? undefined),
  // Number of recommendations to return (1-5)
  limit: z.number().min(1).max(5).optional().default(3)
});

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function validateParams<T>(schema: z.ZodSchema<T>, params: any): { valid: true; data: T } | { valid: false; errors: string[] } {
  try {
    const data = schema.parse(params);
    return { valid: true, data };
  } catch (err: unknown) {
    // Normalize unknown error shapes to a consistent string[] payload.
    const eAny = err as any;

    if (eAny && Array.isArray(eAny.errors)) {
      return {
        valid: false,
        errors: eAny.errors.map((e: any) => `${(e.path || []).join('.')}: ${e.message}`)
      };
    }

    const message = typeof eAny?.message === 'string' ? eAny.message : 'Validation failed';
    return { valid: false, errors: [message] };
  }
}
