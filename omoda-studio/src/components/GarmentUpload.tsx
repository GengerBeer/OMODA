import React, { useCallback, useState } from 'react';
import { Upload, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface GarmentUploadProps {
  onUpload: (file: File, previewUrl: string) => void;
  previewUrl: string | null;
  onClear: () => void;
}

export const GarmentUpload: React.FC<GarmentUploadProps> = ({
  onUpload,
  previewUrl,
  onClear,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      return;
    }

    // Check file size and show warning if small
    const fileSizeKB = file.size / 1024;
    if (fileSizeKB < 100) {
      setWarning('For best results: packshot on light background, 1200px+');
    } else {
      setWarning(null);
    }

    const url = URL.createObjectURL(file);
    onUpload(file, url);
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  if (previewUrl) {
    return (
      <div className="space-y-3">
        <div className="relative inline-block">
          <img
            src={previewUrl}
            alt="Uploaded garment"
            className="max-h-64 rounded-lg shadow-soft object-contain bg-muted"
          />
          <button
            onClick={onClear}
            className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-80 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {warning && (
          <div className="flex items-center gap-2 text-sm text-warning">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{warning}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn('upload-zone', isDragging && 'active')}
      >
        <input
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Upload className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Drop garment image here</p>
            <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
          </div>
          <Button variant="outline" size="sm" className="pointer-events-none">
            Upload Image
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        For best results: packshot on light background, 1200px+
      </p>
    </div>
  );
};
