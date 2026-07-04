import { createClient } from '@supabase/supabase-js';

// Cliente Supabase único da aplicação (compartilhado entre App.tsx e os componentes).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
