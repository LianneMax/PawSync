'use client';

import { type ReactNode, useState, useCallback } from 'react';
import { formatBytes, useFileUpload, type FileWithPreview } from '@/hooks/use-file-upload';
import { Alert, AlertContent, AlertDescription, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PawPrint, TriangleAlert, X, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import Cropper, { type Area } from 'react-easy-crop';

interface AvatarUploadProps {
  maxSize?: number;
  className?: string;
  onFileChange?: (file: FileWithPreview | null) => void;
  defaultAvatar?: string;
  children?: ReactNode;
}

// Helper function to create cropped image
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve) => (image.onload = resolve));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas is empty'));
    }, 'image/jpeg', 0.9);
  });
}

export default function AvatarUpload({
  maxSize = 2 * 1024 * 1024, // 2MB
  className,
  onFileChange,
  defaultAvatar,
  children,
}: AvatarUploadProps) {
  // Cropper state
  const [showCropper, setShowCropper] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null);

  const [
    { files, isDragging, errors },
    { removeFile, handleDragEnter, handleDragLeave, handleDragOver, handleDrop, openFileDialog, getInputProps },
  ] = useFileUpload({
    maxFiles: 1,
    maxSize,
    accept: 'image/*',
    multiple: false,
    onFilesChange: (files) => {
      const file = files[0];
      if (file?.preview) {
        // Open cropper when file is selected
        setCropImage(file.preview);
        setShowCropper(true);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
      }
    },
  });

  const currentFile = files[0];
  const previewUrl = croppedPreview || currentFile?.preview || defaultAvatar;

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropConfirm = async () => {
    if (!cropImage || !croppedAreaPixels) return;

    try {
      const croppedBlob = await getCroppedImg(cropImage, croppedAreaPixels);
      const croppedUrl = URL.createObjectURL(croppedBlob);
      setCroppedPreview(croppedUrl);

      // Create a new file from the cropped blob
      const croppedFile = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' });
      const fileWithPreview: FileWithPreview = {
        file: croppedFile,
        id: currentFile?.id || crypto.randomUUID(),
        preview: croppedUrl,
      };

      onFileChange?.(fileWithPreview);
      setShowCropper(false);
    } catch (e) {
      console.error('Error cropping image:', e);
    }
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setCropImage(null);
    if (currentFile) {
      removeFile(currentFile.id);
    }
  };

  const handleRemove = () => {
    if (currentFile) {
      removeFile(currentFile.id);
    }
    setCroppedPreview(null);
    onFileChange?.(null);
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Avatar + optional children in a row */}
      <div className={cn('flex items-start gap-6', !children && 'flex-col items-center')}>
        <div className="flex flex-col items-center gap-4 shrink-0">
          <div className="relative">
            <div
              className={cn(
                'group/avatar relative h-24 w-24 cursor-pointer overflow-hidden rounded-full border border-dashed transition-all duration-200 hover:scale-95 hover:shadow-lg',
                isDragging ? 'border-primary bg-primary/5 scale-95 shadow-lg' : 'border-muted-foreground/25 hover:border-muted-foreground/20',
                previewUrl && 'border-solid',
              )}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={openFileDialog}
            >
              <input {...getInputProps()} className="sr-only" />

              {previewUrl ? (
                <img src={previewUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <PawPrint className="size-6 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Remove Button - only show when file is uploaded */}
            {(currentFile || croppedPreview) && (
              <Button
                size="icon"
                variant="outline"
                onClick={handleRemove}
                className="size-6 absolute end-0 top-0 rounded-full"
                aria-label="Remove avatar"
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>

          {/* Upload Instructions */}
          <div className="text-center space-y-0.5">
            <p className="text-xs text-muted-foreground">PNG, JPG up to {formatBytes(maxSize)}</p>
          </div>
        </div>

        {children}
      </div>

      {/* Error Messages - rendered below at full width */}
      {errors.length > 0 && (
        <Alert variant="destructive" appearance="light">
          <AlertIcon>
            <TriangleAlert />
          </AlertIcon>
          <AlertContent>
            <AlertTitle>File upload error(s)</AlertTitle>
            <AlertDescription>
              {errors.map((error, index) => (
                <p key={index} className="last:mb-0">
                  {error}
                </p>
              ))}
            </AlertDescription>
          </AlertContent>
        </Alert>
      )}

      {/* Cropper Modal */}
      {showCropper && cropImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={handleCropCancel}>
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">Resize Photo</h3>

            {/* Cropper Container */}
            <div className="relative w-full h-64 bg-gray-100 rounded-xl overflow-hidden mb-4">
              <Cropper
                image={cropImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setZoom(Math.max(1, zoom - 0.1))}
                disabled={zoom <= 1}
              >
                <ZoomOut className="size-4" />
              </Button>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-32 h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#5A7C7A]"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                disabled={zoom >= 3}
              >
                <ZoomIn className="size-4" />
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCropCancel}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-[#5A7C7A] hover:bg-[#4a6a68]"
                onClick={handleCropConfirm}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
