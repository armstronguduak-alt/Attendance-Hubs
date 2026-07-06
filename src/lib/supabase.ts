import { createClient } from '@supabase/supabase-js';

// Determine if we are on client or server
const isClient = typeof window !== 'undefined';

const supabaseUrl = isClient
  ? ((import.meta as any).env.VITE_SUPABASE_URL || 'https://qvdbmgzzfkxskuhqhrme.supabase.co')
  : (process.env.SUPABASE_URL || 'https://qvdbmgzzfkxskuhqhrme.supabase.co');

const supabaseAnonKey = isClient
  ? ((import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_TXOh1CNHO9lxoSKuwcjKtA_zVz8tokb')
  : (process.env.SUPABASE_ANON_KEY || 'sb_publishable_TXOh1CNHO9lxoSKuwcjKtA_zVz8tokb');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});

