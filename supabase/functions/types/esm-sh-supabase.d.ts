declare module "https://esm.sh/@supabase/supabase-js@2" {
  // Re-export types from the locally installed package so the TS server can resolve imports
  export * from "@supabase/supabase-js";
  import Supabase from "@supabase/supabase-js";
  export default Supabase;
}
