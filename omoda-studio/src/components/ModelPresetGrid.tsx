import React, { useMemo, useState } from 'react';
import { ModelPreset, GenderFilter, StyleFilter } from '@/types/api';
import { usePresets } from '@/hooks/usePresets';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Users, Loader2 } from 'lucide-react';

type ModelMode = 'presets' | 'custom';

interface ModelPresetGridProps {
  selectedPreset: string;
  onSelect: (presetId: string) => void;
  customPrompt?: string;
  onCustomPromptChange?: (prompt: string) => void;
}

export const ModelPresetGrid: React.FC<ModelPresetGridProps> = ({
  selectedPreset,
  onSelect,
  customPrompt = '',
  onCustomPromptChange,
}) => {
  const [mode, setMode] = useState<ModelMode>('presets');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [styleFilter, setStyleFilter] = useState<StyleFilter>('all');
  
  // Загружаем пресеты из Supabase
  const { presets: supabasePresets, loading, error } = usePresets();

  const filteredPresets = useMemo(() => {
    return supabasePresets.filter(preset => {
      if (genderFilter !== 'all' && preset.gender !== genderFilter) return false;
      if (styleFilter !== 'all' && preset.style !== styleFilter) return false;
      return true;
    });
  }, [supabasePresets, genderFilter, styleFilter]);

  const handleModeChange = (newMode: ModelMode) => {
    setMode(newMode);
    // Clear preset selection when switching to custom mode
    if (newMode === 'custom') {
      onSelect('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode Tabs */}
      <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => handleModeChange('presets')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            mode === 'presets'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Users className="w-4 h-4" />
          Presets
        </button>
        <button
          onClick={() => handleModeChange('custom')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            mode === 'custom'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Sparkles className="w-4 h-4" />
          Custom
        </button>
      </div>

      {mode === 'presets' ? (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Gender:</span>
              <div className="flex gap-1">
                {(['all', 'female', 'male'] as GenderFilter[]).map(gender => (
                  <Button
                    key={gender}
                    variant={genderFilter === gender ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setGenderFilter(gender)}
                    className="capitalize"
                  >
                    {gender}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Style:</span>
              <div className="flex gap-1">
                {(['all', 'casual', 'elegant', 'street'] as StyleFilter[]).map(style => (
                  <Button
                    key={style}
                    variant={styleFilter === style ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStyleFilter(style)}
                    className="capitalize"
                  >
                    {style}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
              Error loading presets: {error}
            </div>
          )}

          {/* Grid */}
          {!loading && !error && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {filteredPresets.map(preset => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  isSelected={selectedPreset === preset.id}
                  onSelect={() => onSelect(preset.id)}
                />
              ))}
            </div>
          )}

          {!loading && !error && filteredPresets.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No presets match the selected filters
            </p>
          )}
        </>
      ) : (
        /* Custom Mode */
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 border border-border">
            <label className="block text-sm font-medium mb-2">
              Describe your model
            </label>
            <Textarea
              placeholder="Describe the model you want to generate, e.g.: 'Young woman with long brown hair, professional business look, standing pose' or 'Athletic man, mid-30s, casual streetwear style'"
              value={customPrompt}
              onChange={(e) => onCustomPromptChange?.(e.target.value)}
              className="min-h-[120px] resize-none"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Be specific about appearance, age, style, and pose for best results.
            </p>
          </div>

          {/* Quick Examples */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Quick examples:</p>
            <div className="flex flex-wrap gap-2">
              {[
                'Young woman, elegant evening look',
                'Professional businessman, formal suit',
                'Casual streetwear, young adult',
                'Athletic woman, sporty outfit',
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => onCustomPromptChange?.(example)}
                  className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface PresetCardProps {
  preset: ModelPreset;
  isSelected: boolean;
  onSelect: () => void;
}

const PresetCard: React.FC<PresetCardProps> = ({ preset, isSelected, onSelect }) => {
  return (
    <button
      onClick={onSelect}
      className={cn('preset-card group', isSelected && 'selected')}
    >
      <div className="aspect-[3/4] overflow-hidden">
        <img
          src={preset.thumbnail}
          alt={preset.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="p-2 text-left">
        <p className="text-sm font-medium truncate">{preset.name}</p>
        <p className="text-xs text-muted-foreground capitalize">
          {preset.gender} / {preset.style}
        </p>
      </div>
    </button>
  );
};
