declare module 'https://esm.sh/@supabase/supabase-js@2' {
  /** Minimal declaration to satisfy TypeScript in this Deno function. */
  export function createClient(url: string, key?: string): any;
  const _supabase: {
    createClient: typeof createClient;
  };
  export default _supabase;
}
