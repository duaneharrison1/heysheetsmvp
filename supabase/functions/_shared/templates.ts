/**
 * TEMPLATE RESPONSES
 * ==================
 *
 * Deterministic response templates for direct function calls.
 * No AI needed - just string interpolation.
 *
 * Extends the existing skipResponder pattern from calendar-booking.ts
 */

type TemplateFunction = (result: any, params: any) => string | null;

const TEMPLATES: Record<string, TemplateFunction> = {

  // Booking confirmed
  'create_booking': (result, params) => {
    if (!result.success) {
      if (result.error === 'fully_booked') {
        return `Sorry, **${params.service_name}** is fully booked on ${params.date} at ${params.time}. Would you like to try another time?`;
      }
      if (result.error === 'no_class_scheduled') {
        return `Sorry, **${params.service_name}** doesn't have any classes scheduled on ${params.date} at ${params.time}. Would you like to try a different date?`;
      }
      return `Sorry, we couldn't complete your booking. ${result.message || 'Please try again.'}`;
    }
    return `Booking confirmed!\n\n` +
      `**${result.service}**\n` +
      `${result.date} at ${result.time}\n` +
      `${result.customer_name}\n\n` +
      `A confirmation has been saved. See you there!`;
  },

  // Booking slots available
  'get_booking_slots': (result, params) => {
    if (!result.success || !result.slots?.length) {
      return `Sorry, no available slots found for ${params.service_name || 'this service'}. Would you like to try a different date?`;
    }
    // Let the component show the calendar, just provide intro text
    return `Here are the available times for **${result.service?.name || params.service_name}**. Select a slot to continue:`;
  },

  // Products list
  'get_products': (result, params) => {
    const products = result.data?.products || result.products;
    if (!products?.length) {
      return `Sorry, no products found${params.query ? ` matching "${params.query}"` : ''}. Would you like to see all our products?`;
    }
    const count = products.length;
    return `Here ${count === 1 ? 'is' : 'are'} ${count} product${count === 1 ? '' : 's'}${params.query ? ` matching "${params.query}"` : ''}:`;
  },

  // Services list
  'get_services': (result, params) => {
    const services = result.data?.services || result.services;
    if (!services?.length) {
      return `Sorry, no services found${params.query ? ` matching "${params.query}"` : ''}. Would you like to see all our services?`;
    }
    const count = services.length;
    return `Here ${count === 1 ? 'is' : 'are'} ${count} service${count === 1 ? '' : 's'}${params.query ? ` matching "${params.query}"` : ''}:`;
  },

  // Lead form submitted
  'submit_lead': (result, params) => {
    if (!result.success) {
      return `Sorry, there was a problem submitting your information. Please try again.`;
    }
    if (result.awaiting_input) {
      return `Please fill in your details below:`;
    }
    const name = params.customer_name || params.name || 'there';
    return `Thanks for reaching out, ${name}! We've received your information and will get back to you soon.`;
  },

  // Recommendations
  'get_recommendations': (result, params) => {
    const recommendations = result.data?.recommendations || result.recommendations;
    if (!recommendations?.length) {
      return `I couldn't find specific recommendations based on your preferences. Would you like to tell me more about what you're looking for?`;
    }
    return `Based on what you've shared, here are my top recommendations for you:`;
  },

  // Check availability
  'check_availability': (result, params) => {
    if (result.available) {
      return `**${params.service_name}** is available on ${params.date}${params.time ? ` at ${params.time}` : ''}! Would you like to book it?`;
    }
    return `Sorry, **${params.service_name}** is not available on ${params.date}${params.time ? ` at ${params.time}` : ''}. Would you like to check another date?`;
  },

  // Store info
  'get_store_info': (result, params) => {
    if (!result.success) {
      return `Sorry, I couldn't retrieve the store information. Please try again.`;
    }
    return `Here's what you need to know:`;
  },
};

/**
 * Get template response for a function result.
 * Returns null if no template exists (fall back to AI responder).
 */
export function getTemplateResponse(
  functionName: string,
  result: any,
  params: any
): string | null {
  const template = TEMPLATES[functionName];
  if (!template) return null;

  try {
    return template(result, params);
  } catch (error) {
    console.error(`[templates] Error generating template for ${functionName}:`, error);
    return null;
  }
}

/**
 * Check if a function has a template response available.
 */
export function hasTemplate(functionName: string): boolean {
  return functionName in TEMPLATES;
}
