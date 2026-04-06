import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ModelPreset } from '@/types/api';

interface SupabasePreset {
  id: string;
  file_name: string;
  file_url: string;
  title: string | null;
  description: string | null;
  category: string | null;
  order_index: number;
}

export function usePresets() {
  const [presets, setPresets] = useState<ModelPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPresets();
  }, []);

  async function loadPresets() {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('clothing_presets')
        .select('*')
        .order('order_index', { ascending: true });

      if (fetchError) throw fetchError;

      if (data) {
        // Преобразуем данные из Supabase в формат ModelPreset
        const mappedPresets: ModelPreset[] = data.map((preset: SupabasePreset, index: number) => {
          // Извлекаем пол и стиль из category (формат: "female_casual")
          const parts = (preset.category || '').split('_');
          const gender = (parts[0] === 'male' || parts[0] === 'female') ? parts[0] as 'male' | 'female' : 'female';
          const style = (parts[1] === 'casual' || parts[1] === 'elegant' || parts[1] === 'street') 
            ? parts[1] as 'casual' | 'elegant' | 'street' 
            : 'casual';

          return {
            id: preset.id,
            name: preset.title || `Model ${index + 1}`,
            gender,
            style,
            thumbnail: preset.file_url,
          };
        }).filter((preset) => preset.name.trim().toLowerCase() !== 'jake');

        setPresets(mappedPresets);
      }
    } catch (err: unknown) {
      console.error('Error loading presets:', err);
      setError(err instanceof Error ? err.message : 'Failed to load presets');
    } finally {
      setLoading(false);
    }
  }

  return { presets, loading, error, reload: loadPresets };
}
