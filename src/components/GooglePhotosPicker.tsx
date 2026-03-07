import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useGooglePhotos, downloadGooglePhoto, type GooglePhoto } from "@/hooks/useGooglePhotos";
import { Loader2, X, ImageIcon } from "lucide-react";

interface GooglePhotosPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (file: File, creationTime?: string) => void;
}

export function GooglePhotosPicker({ open, onClose, onSelect }: GooglePhotosPickerProps) {
  const { photos, isLoading, error, fetchPhotos, loadMore, hasMore, reset } = useGooglePhotos();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingPhotoId = useRef<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchPhotos();
    } else {
      reset();
    }
  }, [open, fetchPhotos, reset]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !open) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMore, open]);

  const handlePick = async (photo: GooglePhoto) => {
    loadingPhotoId.current = photo.id;
    try {
      const file = await downloadGooglePhoto(photo);
      onSelect(file, photo.creationTime);
    } catch {
      // toast handled by parent
    } finally {
      loadingPhotoId.current = null;
    }
  };

  if (!open) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Google Photos</p>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5 max-h-52 overflow-y-auto rounded-lg">
          {photos
            .filter((p) => p.mimeType.startsWith("image/"))
            .map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => handlePick(photo)}
                className="aspect-square rounded-md overflow-hidden hover:ring-2 ring-primary focus:outline-none focus:ring-2 transition-shadow"
              >
                <img
                  src={`${photo.baseUrl}=w200-h200-c`}
                  alt={photo.filename}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          <div ref={sentinelRef} className="col-span-4 h-1" />
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && photos.length === 0 && !error && (
        <div className="text-center py-6 text-muted-foreground">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No photos found</p>
        </div>
      )}
    </div>
  );
}
