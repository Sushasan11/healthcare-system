"use client";

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "default") {
    const result = await Notification.requestPermission();
    return result === "granted";
  }
  return false;
}

export function notifyNewMessage(senderName: string): void {
  if (typeof window === "undefined") return;
  if (document.hasFocus()) return; // Tab is focused, no notification needed

  // Browser notification
  if (Notification.permission === "granted") {
    new Notification(`New message from ${senderName}`, {
      icon: "/favicon.ico",
      tag: "consultation-message", // replaces previous notification
    });
  }

  // Soft chime sound
  try {
    const audio = new Audio("/sounds/message-chime.mp3");
    audio.volume = 0.3;
    audio.play().catch(() => {}); // ignore autoplay block
  } catch {
    // Audio not available
  }
}
