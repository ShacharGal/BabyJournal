import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, Users, Eye, PenLine, Shield, Bell, BellOff, AtSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isPushSupported, subscribeToPush, unsubscribeFromPush, getCurrentPushSubscription } from "@/lib/pushNotifications";

interface ManagedUser {
  id: string;
  nickname: string;
  permission: string;
  notification_pref: string;
  created_at: string;
}

export function UserManagement() {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [permission, setPermission] = useState("view_only");
  const [notificationPref, setNotificationPref] = useState("all");
  const [pushSubscribed, setPushSubscribed] = useState(false);

  // Check current push subscription status
  useEffect(() => {
    getCurrentPushSubscription().then((sub) => setPushSubscribed(!!sub));
  }, []);

  const callApi = useCallback(
    async (body: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { ...body, callerId: user?.id },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    [user?.id]
  );

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await callApi({ action: "list" });
      setUsers(data.users);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [callApi, toast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openCreate = () => {
    setEditingUser(null);
    setNickname("");
    setPassword("");
    setPermission("view_only");
    setNotificationPref("all");
    setDialogOpen(true);
  };

  const openEdit = (u: ManagedUser) => {
    setEditingUser(u);
    setNickname(u.nickname);
    setPassword("");
    setPermission(u.permission);
    setNotificationPref(u.notification_pref || "all");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!nickname.trim()) {
      toast({ title: "Nickname is required", variant: "destructive" });
      return;
    }
    if (!editingUser && !password.trim()) {
      toast({ title: "Password is required for new users", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      if (editingUser) {
        await callApi({
          action: "update",
          userId: editingUser.id,
          nickname: nickname.trim(),
          ...(password.trim() ? { password: password.trim() } : {}),
          permission,
          notification_pref: notificationPref,
        });
        toast({ title: "User updated" });
      } else {
        await callApi({
          action: "create",
          nickname: nickname.trim(),
          password: password.trim(),
          permission,
          notification_pref: notificationPref,
        });
        toast({ title: "User created" });
      }
      setDialogOpen(false);
      loadUsers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setSaving(true);
      await callApi({ action: "delete", userId: deleteTarget.id });
      toast({ title: "User deleted" });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      loadUsers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const permissionIcon = (p: string) => {
    if (p === "full") return <Shield className="h-3 w-3" />;
    if (p === "add") return <PenLine className="h-3 w-3" />;
    return <Eye className="h-3 w-3" />;
  };

  const permissionVariant = (p: string): "default" | "secondary" | "outline" => {
    if (p === "full") return "default";
    if (p === "add") return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Users</h3>
        </div>
        <Button size="sm" variant="outline" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{u.nickname}</span>
                <Badge variant={permissionVariant(u.permission)} className="gap-1 text-xs">
                  {permissionIcon(u.permission)}
                  {u.permission === "view_only" ? "View only" : u.permission === "add" ? "Can add" : "Full"}
                </Badge>
                <span className="text-muted-foreground" title={`Notifications: ${u.notification_pref || "all"}`}>
                  {u.notification_pref === "none" ? <BellOff className="h-3 w-3" /> :
                   u.notification_pref === "mentioned" ? <AtSign className="h-3 w-3" /> :
                   <Bell className="h-3 w-3" />}
                </span>
                {u.id === user?.id && (
                  <span className="text-xs text-muted-foreground">(you)</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(u)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {u.id !== user?.id && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => { setDeleteTarget(u); setDeleteDialogOpen(true); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add User"}</DialogTitle>
            <DialogDescription>
              {editingUser ? "Update user details. Leave password empty to keep current." : "Create a new user account."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname</Label>
              <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Enter nickname" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editingUser ? "Leave empty to keep current" : "Enter password"}
              />
            </div>
            <div className="space-y-2">
              <Label>Permission</Label>
              <Select value={permission} onValueChange={setPermission}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full access</SelectItem>
                  <SelectItem value="add">Can add</SelectItem>
                  <SelectItem value="view_only">View only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notifications</Label>
              <Select value={notificationPref} onValueChange={setNotificationPref}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All new memories</SelectItem>
                  <SelectItem value="mentioned">Only when @mentioned</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editingUser?.id === user?.id && isPushSupported() && notificationPref !== "none" && (
              <div className="space-y-2">
                <Label>Push on this device</Label>
                <Button
                  variant={pushSubscribed ? "outline" : "default"}
                  size="sm"
                  className="w-full"
                  onClick={async () => {
                    if (pushSubscribed) {
                      const ok = await unsubscribeFromPush(user!.id);
                      if (ok) { setPushSubscribed(false); toast({ title: "Push disabled on this device" }); }
                    } else {
                      const ok = await subscribeToPush(user!.id);
                      if (ok) { setPushSubscribed(true); toast({ title: "Push enabled!" }); }
                      else toast({ title: "Could not enable push", description: "Check browser permissions", variant: "destructive" });
                    }
                  }}
                >
                  {pushSubscribed ? <><BellOff className="h-4 w-4 mr-2" />Disable push</> : <><Bell className="h-4 w-4 mr-2" />Enable push notifications</>}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingUser ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.nickname}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
