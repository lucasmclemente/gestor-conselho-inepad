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
    // Desligado de propósito: o supabase-js processava e LIMPAVA o hash de
    // recuperação (#access_token...type=recovery) antes do app conseguir lê-lo,
    // caindo no login. O App.tsx passa a tratar esse hash manualmente.
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
  },
});
