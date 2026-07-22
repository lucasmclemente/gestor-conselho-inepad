import { createClient } from '@supabase/supabase-js';

// Cliente Supabase único da aplicação (compartilhado entre App.tsx e os componentes).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// flowType 'implicit': o link de recuperação/confirmação chega com os tokens no
// hash (#...type=recovery), sem depender de um "code verifier" salvo no mesmo
// navegador — funciona entre dispositivos e casa com a detecção do app.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    flowType: 'implicit',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});
