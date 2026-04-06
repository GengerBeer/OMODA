import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ClipboardPaste, ImagePlus, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface GarmentUploadItem {
  id: string;
  previewUrl: string;
  name: string;
}

interface GarmentUploadProps {
  onUpload: (files: File[]) => void;
  items: GarmentUploadItem[];
  onClear: (id?: string) => void;
  maxFiles?: number;
}

function extractImageFiles(list: ArrayLike<File>) {
  return Array.from(list).filter((file) => file.type.startsWith('image/'));
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
}

export const GarmentUpload: React.FC<GarmentUploadProps> = ({
  onUpload,
  items,
  onClear,
  maxFiles = 3,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const inputId = 'garment-upload-input';

  const handleFiles = useCallback((files: File[]) => {
    const imageFiles = extractImageFiles(files);
    if (imageFiles.length === 0) {
      return;
    }

    const hasSmallFile = imageFiles.some((file) => file.size / 1024 < 100);
    setWarning(hasSmallFile ? 'For best results: use clean references, 1200px+ when possible.' : null);
    onUpload(imageFiles);
  }, [onUpload]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      const clipboardItems = Array.from(event.clipboardData?.items ?? []);
      const imageFiles = clipboardItems
        .filter((item) => item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => !!file);

      if (imageFiles.length === 0) {
        return;
      }

      event.preventDefault();
      handleFiles(imageFiles);
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [handleFiles]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(Array.from(event.dataTransfer.files));
  }, [handleFiles]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    handleFiles(files);
    event.target.value = '';
  }, [handleFiles]);

  const remainingSlots = Math.max(0, maxFiles - items.length);
  const hasItems = items.length > 0;
  const galleryGridClass = items.length === 1
    ? 'grid-cols-1'
    : items.length === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3';

  return (
    <div className="space-y-4">
      <div className={cn('grid gap-4 xl:items-stretch', hasItems ? 'xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.38fr)]' : 'grid-cols-1')}>
        <div className={cn(
          hasItems ? `grid gap-3 ${galleryGridClass}` : 'hidden',
        )}>
          {items.map((item, index) => (
            <div
              key={item.id}
              className="group relative h-full overflow-hidden rounded-[1.75rem] border border-border/80 bg-card shadow-soft transition-transform duration-300 hover:-translate-y-1"
            >
              <div className="aspect-[4/5] bg-muted">
                <img
                  src={item.previewUrl}
                  alt={item.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <button
                type="button"
                onClick={() => onClear(item.id)}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-foreground/90 text-background opacity-90 transition hover:scale-105 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium tracking-[0.08em] uppercase text-foreground/80">
                    Reference {index + 1}
                  </p>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-secondary-foreground">
                    {index + 1}/{maxFiles}
                  </span>
                </div>
                <p className="truncate text-sm text-muted-foreground">{item.name}</p>
              </div>
            </div>
          ))}
        </div>

        {remainingSlots > 0 ? (
          <label
            htmlFor={inputId}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={cn(
              'upload-zone flex flex-col justify-between rounded-[1.9rem] border border-dashed border-border/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(244,241,235,0.92))] p-6',
              hasItems ? 'min-h-[22rem] h-full xl:min-h-full' : 'min-h-[20rem]',
              isDragging && 'active',
            )}
          >
            <input
              id={inputId}
              type="file"
              accept="image/*"
              multiple
              onChange={handleInputChange}
              className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0"
            />
            <div className="pointer-events-none space-y-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background shadow-soft">
                <ImagePlus className="h-6 w-6" />
              </div>
              <div className="space-y-3">
                <p className="text-lg font-semibold">Drop, browse, or paste outfit references</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {hasItems
                    ? `Add up to ${remainingSlots} more reference${remainingSlots > 1 ? 's' : ''}. The upload panel stays pinned so the flow feels calm and easy.`
                    : 'Start with one strong garment photo, then add extra references for layers, styling, or a person already wearing the outfit.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border/80 bg-background/70 px-3 py-1.5">Single garment</span>
                <span className="rounded-full border border-border/80 bg-background/70 px-3 py-1.5">Layered look</span>
                <span className="rounded-full border border-border/80 bg-background/70 px-3 py-1.5">Worn on person</span>
              </div>
            </div>
            <div className="pointer-events-none space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" className="pointer-events-none rounded-full bg-background/85 px-4">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Images
                </Button>
                <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/75 px-3 py-1.5 text-xs text-muted-foreground">
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  Ctrl+V paste enabled
                </span>
              </div>

              {hasItems && (
                <div className="rounded-2xl bg-background/70 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">Look builder</span>
                    <span className="text-xs text-muted-foreground">{items.length}/{maxFiles}</span>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    Keep adding pieces on the right, or replace any reference card from the gallery.
                  </p>
                </div>
              )}
            </div>
          </label>
        ) : (
          <div className="rounded-[1.9rem] border border-dashed border-border/80 bg-card/70 p-6 text-center">
            <p className="text-sm font-medium tracking-[0.12em] uppercase text-foreground/80">Look complete</p>
            <p className="mt-2 text-base font-medium">Three outfit references loaded</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Remove any image if you want to swap part of the look.
            </p>
            <Button variant="outline" size="sm" className="mt-5 rounded-full" onClick={() => onClear()}>
              Clear All References
            </Button>
          </div>
        )}
      </div>

      {warning && (
        <div className="flex items-center gap-2 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-warning" />
          <span>{warning}</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Build a look from up to three references. The app can also use a photo of someone already wearing the target outfit.
      </p>
    </div>
  );
};
