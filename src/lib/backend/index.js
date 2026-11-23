// Picks the backend: Supabase when keys are configured, otherwise demo mode.
import { createSupabaseBackend } from './supabase.js';
import { createDemoBackend } from './demo.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const forceDemo = import.meta.env.VITE_DEMO === '1' || import.meta.env.VITE_DEMO === 'true';

export const backend = url && key && !forceDemo ? createSupabaseBackend(url, key) : createDemoBackend();
