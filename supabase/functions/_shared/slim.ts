/**
 * SLIM FUNCTION RESULTS
 * =====================
 *
 * Strips unnecessary fields from function results before sending to responder.
 * UI gets full data via components array. Responder only needs text-relevant fields.
 *
 * Token savings: ~60% reduction in function result size
 *
 * Fields removed for responder:
 * - imageURL (UI only - for rendering images)
 * - tags (never used in text responses)
 * - quantity (redundant with inStock)
 * - days/startTime/endTime/capacity (scheduling details for UI)
 */

export function slimForResponder(functionName: string, data: any): any {
  if (!data) return data;

  switch (functionName) {
    case 'get_products':
    case 'search_products':
      return slimProducts(data);
    case 'get_services':
    case 'search_services':
      return slimServices(data);
    case 'get_booking_slots':
      return slimBookingSlots(data);
    case 'get_recommendations':
      return slimRecommendations(data);
    case 'get_store_info':
      return slimStoreInfo(data);
    default:
      return data;
  }
}

function slimProducts(data: any): any {
  const products = data.products || data.data?.products;
  if (!products) return data;

  const slimmed = products.map((p: any) => ({
    name: p.name,
    price: p.price,
    category: p.category,
    description: p.description?.substring(0, 100), // Truncate long descriptions
    inStock: p.inStock ?? (parseInt(p.quantity) > 0),
    // REMOVED: imageURL, tags, quantity
  }));

  if (data.data?.products) {
    return {
      ...data,
      data: {
        ...data.data,
        products: slimmed
      }
    };
  }
  return { ...data, products: slimmed };
}

function slimServices(data: any): any {
  const services = data.services || data.data?.services;
  if (!services) return data;

  const slimmed = services.map((s: any) => ({
    serviceName: s.serviceName,
    price: s.price,
    duration: s.duration,
    category: s.category,
    description: s.description?.substring(0, 100), // Truncate long descriptions
    // REMOVED: imageURL, tags, days, startTime, endTime, capacity
  }));

  if (data.data?.services) {
    return {
      ...data,
      data: {
        ...data.data,
        services: slimmed
      }
    };
  }
  return { ...data, services: slimmed };
}

function slimBookingSlots(data: any): any {
  // Keep slots minimal - UI shows the calendar
  if (!data.slots) return data;

  return {
    success: data.success,
    service: data.service ? {
      name: data.service.name,
      duration: data.service.duration,
      price: data.service.price,
    } : undefined,
    slotsCount: data.slots.length,
    dateRange: data.slots.length > 0 ? {
      from: data.slots[0].date,
      to: data.slots[data.slots.length - 1].date,
    } : undefined,
    message: data.message,
    // REMOVED: full slots array, unavailableDates, availableDates (UI has via components)
  };
}

function slimRecommendations(data: any): any {
  const recommendations = data.recommendations || data.data?.recommendations;
  if (!recommendations) return data;

  const slimmed = recommendations.map((r: any) => ({
    name: r.name || r.serviceName,
    price: r.price,
    category: r.category,
    matchReason: r.matchReason || r.reason,
    // REMOVED: imageURL, tags, full description
  }));

  if (data.data?.recommendations) {
    return {
      ...data,
      data: {
        ...data.data,
        recommendations: slimmed
      }
    };
  }
  return { ...data, recommendations: slimmed };
}

function slimStoreInfo(data: any): any {
  // Handle both cases: data is the inner object OR data.data exists
  // When called from native tool calling: slimForResponder(name, functionResult.data)
  // functionResult.data = { store_name, info_type, services: [...], ... }
  // So we receive the inner object directly, NOT a wrapper with .data property
  
  const innerData = data.data || data;
  const hasWrapper = !!data.data;
  
  // Keep store info relatively complete but trim arrays
  const slimmedData: any = {};
  
  // Preserve essential scalar fields
  if (innerData.store_name) slimmedData.store_name = innerData.store_name;
  if (innerData.info_type) slimmedData.info_type = innerData.info_type;

  // Slim store_info array - extract only essential fields
  if (innerData.store_info && Array.isArray(innerData.store_info)) {
    const storeInfo = innerData.store_info[0];
    if (storeInfo) {
      slimmedData.storeDetails = {
        name: storeInfo.name || storeInfo.storeName,
        address: storeInfo.address,
        phone: storeInfo.phone,
        email: storeInfo.email,
        website: storeInfo.website,
        description: storeInfo.description?.substring(0, 200),
        // REMOVED: large social media objects, images, full HTML, etc.
      };
    }
  }

  // Slim hours - keep minimal fields
  if (innerData.hours && Array.isArray(innerData.hours)) {
    slimmedData.hours = innerData.hours.slice(0, 7).map((h: any) => ({
      day: h.day,
      openTime: h.openTime || h.open,
      closeTime: h.closeTime || h.close,
      isOpen: h.isOpen,
    }));
  }

  if (innerData.services) {
    slimmedData.services = innerData.services.slice(0, 5).map((s: any) => ({
      serviceName: s.serviceName,
      price: s.price,
      category: s.category,
    }));
    slimmedData.servicesCount = innerData.services.length;
  }

  if (innerData.products) {
    slimmedData.products = innerData.products.slice(0, 5).map((p: any) => ({
      name: p.name,
      price: p.price,
      category: p.category,
    }));
    slimmedData.productsCount = innerData.products.length;
  }

  // Return in same structure as received
  if (hasWrapper) {
    return { ...data, data: slimmedData };
  }
  return slimmedData;
}
