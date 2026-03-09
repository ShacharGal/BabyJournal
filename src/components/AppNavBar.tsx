import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  X,
  Heart,
  SlidersHorizontal,
  PenLine,
} from "lucide-react";
import { GoogleDriveConnect } from "@/components/GoogleDriveConnect";
import { AddChildForm } from "@/components/AddChildForm";
import { UserManagement } from "@/components/UserManagement";
import { SearchFilters, type Filters } from "@/components/SearchFilters";
import { useGoogleConnection } from "@/hooks/useGoogleDrive";

interface AppNavBarProps {
  selectedBabyId?: string;
  onSelectBaby: (babyId: string | undefined) => void;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

export function AppNavBar({
  selectedBabyId,
  onSelectBaby,
  filters,
  onFiltersChange,
}: AppNavBarProps) {
  const { data: babies } = useBabies();
  const { user, canEdit, logout } = useAuthContext();
  const { data: googleConnection } = useGoogleConnection();
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isDriveConnected = !!googleConnection?.refresh_token;

  const selectedBaby = babies?.find((b) => b.id === selectedBabyId);
  const childLabel = selectedBaby?.name ?? "All Children";

  const activeFilterCount =
    (filters.text ? 1 : 0) +
    filters.tagIds.length +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0);

  const permissionLabel = user?.permission === "full"
    ? null
    : user?.permission === "add"
    ? "Can add"
    : "View only";

  return (
    <>
      <nav className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-[600px] px-4">
          <div className="flex h-14 items-center justify-between gap-2">
            <div className="flex items-center gap-2 shrink-0">
              <Heart className="h-5 w-5 text-primary" />
              <span className="font-semibold text-base hidden sm:inline">Family Journal</span>
            </div>

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

            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 relative"
                onClick={() => setSearchOpen(!searchOpen)}
              >
                {searchOpen ? (
                  <X className="h-4 w-4" />
                ) : (
                  <>
                    <SlidersHorizontal className="h-4 w-4" />
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 relative"
                onClick={() => setSettingsOpen(true)}
              >
                <Menu className="h-4 w-4" />
                {canEdit && (
                  <span
                    className={`absolute top-1 right-1 h-2 w-2 rounded-full ${isDriveConnected ? "bg-green-500" : "bg-red-500"}`}
                    title={isDriveConnected ? "Google Drive connected" : "Google Drive disconnected"}
                  />
                )}
              </Button>
            </div>
          </div>

          {searchOpen && (
            <div className="pb-3">
              <SearchFilters filters={filters} onChange={onFiltersChange} />
            </div>
          )}
        </div>
      </nav>

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Settings</SheetTitle>
            <SheetDescription>Manage your account and connections</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{user?.nickname}</span>
                {permissionLabel && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    {user?.permission === "add" ? (
                      <PenLine className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                    {permissionLabel}
                  </Badge>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>

            {canEdit && <GoogleDriveConnect />}
            {canEdit && <AddChildForm />}
            {canEdit && <UserManagement />}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
