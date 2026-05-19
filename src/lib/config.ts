// =============================================================================
// Lovable-friendly configuration
// When running on Lovable Cloud, Edge Functions may not be available.
// Set VITE_USE_EDGE_FUNCTIONS=true to use Supabase Edge Functions.
// Set to false (default) to use direct client-side API calls instead.
// =============================================================================

export const USE_EDGE_FUNCTIONS =
  import.meta.env.VITE_USE_EDGE_FUNCTIONS === 'true';
