import { useState } from "react";
import { AppNavBar } from "@/components/AppNavBar";
import { MemoryFeed } from "@/components/MemoryFeed";
import { AddMemoryDialog } from "@/components/AddMemoryDialog";
import { useAuthContext } from "@/contexts/AuthContext";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [selectedBabyId, setSelectedBabyId] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const { canEdit } = useAuthContext();

  return (
    <div className="min-h-screen bg-background">
      <AppNavBar
        selectedBabyId={selectedBabyId}
        onSelectBaby={setSelectedBabyId}
        search={search}
        onSearchChange={setSearch}
      />

      <main className="mx-auto max-w-[600px] px-4 py-6 pb-24">
        <MemoryFeed babyId={selectedBabyId} search={search} />
      </main>

      {/* Floating Add Button */}
      {canEdit && (
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
        onOpenChange={setAddDialogOpen}
        preSelectedBabyId={selectedBabyId}
      />
    </div>
  );
};

export default Index;
