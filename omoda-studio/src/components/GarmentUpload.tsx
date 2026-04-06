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

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => (
            <div key={item.id} className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
              <div className="aspect-square bg-muted">
                <img
                  src={item.previewUrl}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => onClear(item.id)}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background opacity-90 transition-opacity hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="space-y-1 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium">Reference {index + 1}</p>
                  <span className="rounded-full bg-secondary px-2 py-1 text-[11px] text-secondary-foreground">
                    {index + 1}/{maxFiles}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{item.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {remainingSlots > 0 ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn('upload-zone space-y-4', isDragging && 'active')}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleInputChange}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ImagePlus className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <p className="font-medium">Drop, browse, or paste outfit references</p>
              <p className="text-sm text-muted-foreground">
                Add up to {remainingSlots} more image{remainingSlots > 1 ? 's' : ''}. You can paste directly with Ctrl+V.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-secondary px-3 py-1">Single garment</span>
              <span className="rounded-full bg-secondary px-3 py-1">Full look</span>
              <span className="rounded-full bg-secondary px-3 py-1">Person wearing the outfit</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" size="sm" className="pointer-events-none">
                <Upload className="mr-2 h-4 w-4" />
                Upload Images
              </Button>
              <span className="inline-flex items-center gap-2 rounded-full border border-border/80 px-3 py-1 text-xs text-muted-foreground">
                <ClipboardPaste className="h-3.5 w-3.5" />
                Ctrl+V paste enabled
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card/70 p-4 text-center">
          <p className="text-sm font-medium">Three outfit references loaded</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Remove any image if you want to swap part of the look.
          </p>
          <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={() => onClear()}>
            Clear All References
          </Button>
        </div>
      )}

      {warning && (
        <div className="flex items-center gap-2 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{warning}</span>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Build a look from up to three references. The app can also use a photo of someone already wearing the target outfit.
      </p>
    </div>
  );
};
