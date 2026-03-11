import { Button } from "@/components/ui/button";
import { Square } from "lucide-react";
import { formatDuration } from "./useAddMemoryForm";

interface InlineRecorderProps {
  duration: number;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export function InlineRecorder({ duration, isPaused, onPause, onResume, onStop }: InlineRecorderProps) {
  return (
    <div className="mx-4 mb-2">
      <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 p-3">
        <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
        <span className="text-sm font-mono flex-1">{formatDuration(duration)}</span>
        {isPaused ? (
          <Button type="button" variant="outline" size="sm" onClick={onResume}>
            Resume
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={onPause}>
            Pause
          </Button>
        )}
        <Button type="button" variant="default" size="sm" onClick={onStop}>
          <Square className="h-3 w-3 mr-1 fill-current" />
          Stop
        </Button>
      </div>
    </div>
  );
}
