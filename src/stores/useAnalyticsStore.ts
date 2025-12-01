import { create } from 'zustand';

interface AnalyticsCache {
  store: any;
  bookings: any[];
  services: any[];
  timestamp: Date;
}

interface AnalyticsStore {
  cache: Record<string, AnalyticsCache>;
  
  // Get cached data for a store
  getCache: (storeId: string) => AnalyticsCache | null;
  
  // Set cache for a store
  setCache: (storeId: string, data: Omit<AnalyticsCache, 'timestamp'>) => void;
  
  // Check if cache is valid (less than 5 minutes old)
  isCacheValid: (storeId: string) => boolean;
  
  // Clear cache for a store
  clearCache: (storeId: string) => void;
  
  // Clear all cache
  clearAllCache: () => void;
}

export const useAnalyticsStore = create<AnalyticsStore>((set, get) => ({
  cache: {},
  
  getCache: (storeId: string) => {
    return get().cache[storeId] || null;
  },
  
  setCache: (storeId: string, data: Omit<AnalyticsCache, 'timestamp'>) => {
    set((state) => ({
      cache: {
        ...state.cache,
        [storeId]: {
          ...data,
          timestamp: new Date(),
        },
      },
    }));
  },
  
  isCacheValid: (storeId: string) => {
    const cached = get().cache[storeId];
    if (!cached) return false;
    const fiveMinutes = 5 * 60 * 1000;
    return (new Date().getTime() - cached.timestamp.getTime()) < fiveMinutes;
  },
  
  clearCache: (storeId: string) => {
    set((state) => {
      const newCache = { ...state.cache };
      delete newCache[storeId];
      return { cache: newCache };
    });
  },
  
  clearAllCache: () => {
    set({ cache: {} });
  },
}));
