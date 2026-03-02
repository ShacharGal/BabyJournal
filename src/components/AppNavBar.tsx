import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useBabies } from "@/hooks/useBabies";
import { useAuthContext } from "@/contexts/AuthContext";
import {
  Search,
  Menu,
  ChevronDown,
  Users,
  Eye,
  LogOut,
  Cloud,
  UserPlus,
  X,
  Heart,
} from "lucide-react";
import { GoogleDriveConnect } from "@/components/GoogleDriveConnect";
import { AddChildForm } from "@/components/AddChildForm";

interface AppNavBarProps {
  selectedBabyId?: string;
  onSelectBaby: (babyId: string | undefined) => void;
  search: string;
  onSearchChange: (value: string) => void;
}

export function AppNavBar({
  selectedBabyId,
  onSelectBaby,
  search,
  onSearchChange,
}: AppNavBarProps) {
  const { data: babies } = useBabies();
  const { user, canEdit, logout } = useAuthContext();
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const selectedBaby = babies?.find((b) => b.id === selectedBabyId);
  const childLabel = selectedBaby?.name ?? "All Children";

  return (
    <>
      <nav className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-[600px] px-4">
          {/* Main row */}
          <div className="flex h-14 items-center justify-between gap-2">
            {/* Left: App name */}
            <div className="flex items-center gap-2 shrink-0">
              <Heart className="h-5 w-5 text-primary" />
              <span className="font-semibold text-base hidden sm:inline">Family Journal</span>
            </div>

            {/* Center: Child selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 font-medium">
                  {childLabel}
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-48">
                <DropdownMenuItem
                  onClick={() => onSelectBaby(undefined)}
                  className={!selectedBabyId ? "bg-accent" : ""}
                >
                  <Users className="h-4 w-4 mr-2" />
                  All Children
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {babies?.map((baby) => (
                  <DropdownMenuItem
                    key={baby.id}
                    onClick={() => onSelectBaby(baby.id)}
                    className={selectedBabyId === baby.id ? "bg-accent" : ""}
                  >
                    {baby.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Right: Search + Settings */}
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setSearchOpen(!searchOpen)}
              >
                {searchOpen ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setSettingsOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Search bar (expandable) */}
          {searchOpen && (
            <div className="pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search memories..."
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Settings sheet */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Settings</SheetTitle>
            <SheetDescription>
              Manage your account and connections
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* User info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{user?.nickname}</span>
                {!canEdit && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Eye className="h-3 w-3" />
                    View only
                  </Badge>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>

            {/* Google Drive */}
            {canEdit && <GoogleDriveConnect />}

            {/* Add child */}
            {canEdit && <AddChildForm />}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
