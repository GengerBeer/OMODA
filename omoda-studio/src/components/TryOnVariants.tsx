import React from 'react';
import { TryOnVariant } from '@/types/api';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface TryOnVariantsProps {
  variants: TryOnVariant[];
  selectedId: string | null;
  onSelect: (variantId: string) => void;
  isSelecting: boolean;
}

export const TryOnVariants: React.FC<TryOnVariantsProps> = ({
  variants,
  selectedId,
  onSelect,
  isSelecting,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
      {variants.map((variant) => {
        const isSelected = selectedId === variant.id;
        
        return (
          <button
            key={variant.id}
            onClick={() => !isSelecting && onSelect(variant.id)}
            disabled={isSelecting}
            className={cn(
              'variant-card animate-fade-in',
              isSelected && 'selected'
            )}
          >
            <div className="aspect-[3/4] overflow-hidden">
              <img
                src={variant.url}
                alt={`Try-on variant ${variant.id}`}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-4 flex items-center justify-between">
              <span className="font-medium">Option {variant.id}</span>
              {isSelected ? (
                <div className="flex items-center gap-1 text-success">
                  <Check className="w-4 h-4" />
                  <span className="text-sm">Selected</span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Select</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export const TryOnVariantsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="variant-card">
          <div className="aspect-[3/4] skeleton-shimmer" />
          <div className="p-4">
            <div className="h-5 w-24 skeleton-shimmer rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};
