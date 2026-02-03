import { useState } from "react";
import { GoogleDriveConnect } from "@/components/GoogleDriveConnect";
import { AddBabyForm } from "@/components/AddBabyForm";
import { BabyList } from "@/components/BabyList";
import { UploadEntryForm } from "@/components/UploadEntryForm";
import { EntryList } from "@/components/EntryList";
import { Baby } from "lucide-react";

const Index = () => {
  const [selectedBabyId, setSelectedBabyId] = useState<string | undefined>(undefined);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Baby className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Baby Journal</h1>
              <p className="text-sm text-muted-foreground">Capture every precious moment</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Setup & Add */}
          <div className="space-y-6">
            <GoogleDriveConnect />
            <AddBabyForm />
            <BabyList 
              selectedBabyId={selectedBabyId} 
              onSelectBaby={setSelectedBabyId} 
            />
          </div>

          {/* Middle Column - Upload Form */}
          <div>
            <UploadEntryForm />
          </div>

          {/* Right Column - Entries */}
          <div>
            <EntryList babyId={selectedBabyId} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
