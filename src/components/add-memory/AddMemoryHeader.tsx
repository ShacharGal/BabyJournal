import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ChevronDown } from "lucide-react";

interface Baby {
  id: string;
  name: string;
}

interface AddMemoryHeaderProps {
  babies: Baby[] | undefined;
  selectedBabyId: string;
  onSelectBaby: (id: string) => void;
  date: string;
  onDateChange: (date: string) => void;
}

function formatCasualDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toLowerCase();
}

export function AddMemoryHeader({ babies, selectedBabyId, onSelectBaby, date, onDateChange }: AddMemoryHeaderProps) {
  const [babyOpen, setBabyOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const selectedBaby = babies?.find((b) => b.id === selectedBabyId);

  const handleDateSelect = (day: Date | undefined) => {
    if (day) {
      const yyyy = day.getFullYear();
      const mm = String(day.getMonth() + 1).padStart(2, "0");
      const dd = String(day.getDate()).padStart(2, "0");
      onDateChange(`${yyyy}-${mm}-${dd}`);
      setDateOpen(false);
    }
  };

  const selectedDate = new Date(date + "T00:00:00");

  return (
    <div className="flex items-center justify-between px-4 py-2">
      {/* Baby picker */}
      <Popover open={babyOpen} onOpenChange={setBabyOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="text-sm bg-muted">
                {selectedBaby?.name?.[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">{selectedBaby?.name ?? "Select child"}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="start">
          {Array.isArray(babies) && babies.map((baby) => (
            <button
              key={baby.id}
              type="button"
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors ${
                baby.id === selectedBabyId ? "bg-accent" : ""
              }`}
              onClick={() => {
                onSelectBaby(baby.id);
                setBabyOpen(false);
              }}
            >
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">{baby.name[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              {baby.name}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Date picker */}
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {formatCasualDate(date)}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            defaultMonth={selectedDate}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
