import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && !!VAPID_PUBLIC_KEY;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    console.log("[Push] Service worker registered");
    return reg;
  } catch (err) {
    console.error("[Push] SW registration failed:", err);
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!isPushSupported()) {
    console.log("[Push] Not supported in this browser");
    return false;
  }

  try {
    const reg = await registerServiceWorker();
    if (!reg) return false;

    // Request permission
    const permission = await Notification.requestPermission();
    console.log("[Push] Permission:", permission);
    if (permission !== "granted") return false;

    // Subscribe
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    console.log("[Push] Subscribed:", subscription.endpoint);

    const keys = subscription.toJSON().keys!;

    // Save to backend
    const { error } = await supabase.functions.invoke("push-subscribe", {
      body: {
        action: "subscribe",
        userId,
        endpoint: subscription.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });

    if (error) {
      console.error("[Push] Failed to save subscription:", error);
      return false;
    }

    console.log("[Push] Subscription saved");
    return true;
  } catch (err) {
    console.error("[Push] Subscribe error:", err);
    return false;
  }
}

export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return true;

    const subscription = await reg.pushManager.getSubscription();
    if (!subscription) return true;

    // Remove from backend
    await supabase.functions.invoke("push-subscribe", {
      body: {
        action: "unsubscribe",
        userId,
        endpoint: subscription.endpoint,
      },
    });

    // Unsubscribe locally
    await subscription.unsubscribe();
    console.log("[Push] Unsubscribed");
    return true;
  } catch (err) {
    console.error("[Push] Unsubscribe error:", err);
    return false;
  }
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}
