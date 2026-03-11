import { Loader2 } from "lucide-react";

interface UploadOverlayProps {
  uploadStatus: string;
  hasVideoOrMultiple: boolean;
}

export function UploadOverlay({ uploadStatus, hasVideoOrMultiple }: UploadOverlayProps) {
  return (
    <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center pointer-events-auto rounded-lg">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm rounded-lg" />
      <div className="relative flex flex-col items-center gap-3 mt-16">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
        <p className="text-sm font-medium text-white">
          {uploadStatus || "Saving..."}
        </p>
        {hasVideoOrMultiple && (
          <p className="text-xs text-white/70">
            This might take a moment...
          </p>
        )}
      </div>
    </div>
  );
}
