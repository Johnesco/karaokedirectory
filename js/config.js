/**
 * Application configuration
 * Supabase anon key is public by design — restricted by Row Level Security policies
 */
export const config = {
    supabase: {
        url: 'https://psayzvtyhyvizatgymkh.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzYXl6dnR5aHl2aXphdGd5bWtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNDMxNzUsImV4cCI6MjA4MjkxOTE3NX0.ZMozNPinGDAZFrb5rFn79pewDeT2yc87LY2RPlrXGDQ'
    },
    cache: {
        ttlMs: 30 * 60 * 1000 // 30 minutes
    },
    useSupabase: false // Feature flag — set true to activate Supabase as runtime source. Currently OFF: site reads from js/data.js. See spec §11 and issue #47.
};
