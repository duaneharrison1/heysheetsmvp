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
