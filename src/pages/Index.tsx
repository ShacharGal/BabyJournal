import { useState } from "react";
import { AppNavBar } from "@/components/AppNavBar";
import { MemoryFeed } from "@/components/MemoryFeed";
import { AddMemoryDialog } from "@/components/AddMemoryDialog";
import { useAuthContext } from "@/contexts/AuthContext";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EntryWithTags } from "@/hooks/useEntries";
import type { Filters } from "@/components/SearchFilters";

const Index = () => {
  const [selectedBabyId, setSelectedBabyId] = useState<string | undefined>(undefined);
  const [filters, setFilters] = useState<Filters>({ text: "", tagIds: [], dateFrom: "", dateTo: "" });
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<EntryWithTags | null>(null);
  const { canAdd } = useAuthContext();

  const handleEdit = (entry: EntryWithTags) => {
    setEditEntry(entry);
    setAddDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setAddDialogOpen(open);
    if (!open) setEditEntry(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppNavBar
        selectedBabyId={selectedBabyId}
        onSelectBaby={setSelectedBabyId}
        filters={filters}
        onFiltersChange={setFilters}
      />

      <main className="mx-auto max-w-[600px] px-4 py-6 pb-24">
        <MemoryFeed babyId={selectedBabyId} filters={filters} onEditEntry={handleEdit} />
      </main>

      {canAdd && (
        <Button
          onClick={() => setAddDialogOpen(true)}
          size="icon"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 h-14 w-14 rounded-full shadow-lg z-40"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      <AddMemoryDialog
        open={addDialogOpen}
        onOpenChange={handleDialogClose}
        preSelectedBabyId={selectedBabyId}
        editEntry={editEntry}
      />
    </div>
  );
};

export default Index;
