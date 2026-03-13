import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, BellOff, AtSign, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isPushSupported, subscribeToPush, unsubscribeFromPush, getCurrentPushSubscription } from "@/lib/pushNotifications";

export function NotificationSettings() {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [notificationPref, setNotificationPref] = useState("all");
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPref = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase.functions.invoke("manage-users", {
        body: { action: "get-my-pref", callerId: user.id },
      });
      if (data?.notification_pref) setNotificationPref(data.notification_pref);
    } catch {
      // fall back to default
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadPref();
    getCurrentPushSubscription().then((sub) => setPushSubscribed(!!sub));
  }, [loadPref]);

  const savePref = async (pref: string) => {
    setNotificationPref(pref);
    if (!user?.id) return;
    try {
      setSaving(true);
      await supabase.functions.invoke("manage-users", {
        body: { action: "update-my-pref", callerId: user.id, notification_pref: pref },
      });
      toast({ title: `Notifications: ${pref === "all" ? "all memories" : pref === "mentioned" ? "only @mentions" : "off"}` });
    } catch {
      toast({ title: "Could not save preference", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Notifications</h3>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Notify me about</Label>
        <Select value={notificationPref} onValueChange={savePref} disabled={saving}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All new memories</SelectItem>
            <SelectItem value="mentioned">Only when @mentioned</SelectItem>
            <SelectItem value="none">None</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isPushSupported() && notificationPref !== "none" && (
        <Button
          variant={pushSubscribed ? "outline" : "default"}
          size="sm"
          className="w-full h-8 text-xs"
          onClick={async () => {
            if (pushSubscribed) {
              const ok = await unsubscribeFromPush(user!.id);
              if (ok) { setPushSubscribed(false); toast({ title: "Push disabled on this device" }); }
            } else {
              const ok = await subscribeToPush(user!.id);
              if (ok) { setPushSubscribed(true); toast({ title: "Push notifications enabled!" }); }
              else toast({ title: "Could not enable push", description: "Check browser permissions", variant: "destructive" });
            }
          }}
        >
          {pushSubscribed ? <><BellOff className="h-3.5 w-3.5 mr-1.5" />Disable push on this device</> : <><Bell className="h-3.5 w-3.5 mr-1.5" />Enable push notifications</>}
        </Button>
      )}
    </div>
  );
}
