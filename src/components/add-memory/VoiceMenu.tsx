import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Mic, Circle, Paperclip } from "lucide-react";

interface VoiceMenuProps {
  onRecord: () => void;
  onAttachFile: () => void;
  disabled?: boolean;
}

export function VoiceMenu({ onRecord, onAttachFile, disabled }: VoiceMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full" disabled={disabled}>
          <Mic className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="top">
        <DropdownMenuItem onClick={onRecord}>
          <Circle className="h-4 w-4 mr-2 text-red-500 fill-red-500" />
          Record
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAttachFile}>
          <Paperclip className="h-4 w-4 mr-2" />
          Attach file
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
