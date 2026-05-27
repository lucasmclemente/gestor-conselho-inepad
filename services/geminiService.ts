import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const analyzeMinutes = async (minutesText: string) => {
  if (!minutesText || minutesText.length < 20) return null;

  try {
    const { data, error } = await supabase.functions.invoke('analyze-minutes', {
      body: { minutesText },
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Erro ao analisar ata com Gemini:", error);
    return null;
  }
};
