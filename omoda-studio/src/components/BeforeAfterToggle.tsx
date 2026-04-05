import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface BeforeAfterToggleProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export const BeforeAfterToggle: React.FC<BeforeAfterToggleProps> = ({
  beforeImage,
  afterImage,
  beforeLabel = 'Original',
  afterLabel = 'Try-On',
}) => {
  const [showAfter, setShowAfter] = useState(true);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-1 p-1 bg-muted rounded-lg w-fit mx-auto">
        <button
          onClick={() => setShowAfter(false)}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-md transition-all',
            !showAfter 
              ? 'bg-background shadow-sm text-foreground' 
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {beforeLabel}
        </button>
        <button
          onClick={() => setShowAfter(true)}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-md transition-all',
            showAfter 
              ? 'bg-background shadow-sm text-foreground' 
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {afterLabel}
        </button>
      </div>

      <div className="relative aspect-[3/4] max-w-md mx-auto overflow-hidden rounded-xl shadow-elevated">
        <img
          src={showAfter ? afterImage : beforeImage}
          alt={showAfter ? afterLabel : beforeLabel}
          className="w-full h-full object-cover transition-opacity duration-300"
        />
        <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-foreground/80 text-background text-sm font-medium rounded-md">
          {showAfter ? afterLabel : beforeLabel}
        </div>
      </div>
    </div>
  );
};
