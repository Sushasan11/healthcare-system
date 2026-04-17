"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, FileText, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NotificationOut } from "@/types/notification";

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getNotificationIcon(type: string, isRead: boolean) {
  const colorClass = isRead ? "text-[#64748B]" : "text-[#0EA5E9]";
  if (type === "consultation_reopened") {
    return <RefreshCw className={cn("size-4", colorClass)} />;
  }
  // Default: prescription_issued and others
  return <FileText className={cn("size-4", colorClass)} />;
}

function getBadgeLabel(count: number): string {
  if (count <= 0) return "";
  if (count > 9) return "9+";
  return String(count);
}

export function NotificationPanel() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationOut[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchNotifications() {
      setIsLoading(true);
      try {
        const res = await apiFetch("/notifications?limit=20");
        if (res.ok) {
          const data: NotificationOut[] = await res.json();
          setNotifications(data);
          setUnreadCount(data.filter((n) => !n.is_read).length);
        }
      } catch {
        // Silent failure — panel shows empty state
      } finally {
        setIsLoading(false);
      }
    }
    fetchNotifications();
  }, []);

  async function handleNotificationClick(notif: NotificationOut) {
    // Mark as read
    if (!notif.is_read) {
      try {
        await apiFetch("/notifications/" + notif.id + "/read", {
          method: "PATCH",
        });
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notif.id ? { ...n, is_read: true } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Ignore mark-read errors
      }
    }

    // Navigate if link present
    if (notif.link) {
      router.push(notif.link);
    }
  }

  const badgeLabel = getBadgeLabel(unreadCount);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "relative flex items-center justify-center rounded-md transition-colors",
          "min-w-[44px] min-h-[44px] text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A]"
        )}
        aria-label="Notifications"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#EF4444] text-white text-xs font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {badgeLabel}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="end"
        className="max-h-[320px] overflow-y-auto w-80"
      >
        {isLoading ? (
          <div className="px-3 py-4 text-sm text-[#64748B] text-center animate-pulse">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-3 py-4 text-sm text-[#64748B] text-center">
            No notifications yet
          </div>
        ) : (
          notifications.map((notif) => (
            <DropdownMenuItem
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={cn(
                "flex items-start gap-2 px-3 py-2 cursor-pointer",
                notif.is_read ? "bg-white" : "bg-[#F8FAFC]"
              )}
            >
              <span className="mt-0.5 shrink-0">
                {getNotificationIcon(notif.type, notif.is_read)}
              </span>
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm truncate",
                    notif.is_read ? "font-normal" : "font-semibold"
                  )}
                >
                  {notif.title}
                </p>
                <p className="text-xs text-[#64748B] truncate">{notif.body}</p>
                <p className="text-xs text-[#64748B]">
                  {getRelativeTime(notif.created_at)}
                </p>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
