"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api";
import { clearAccessToken, clearAuthSessionCookie } from "@/lib/auth";

interface TopBarProps {
  userName: string;
  userRole: string;
  onToggleSidebar: () => void;
  onLogout?: () => void | Promise<void>;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function TopBar({ userName, userRole, onToggleSidebar, onLogout }: TopBarProps) {
  const router = useRouter();

  async function handleSignOut() {
    if (onLogout) {
      await onLogout();
      return;
    }
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // Best-effort logout — clear local state regardless
    }
    clearAccessToken();
    clearAuthSessionCookie();
    router.push("/login");
  }

  return (
    <header className="h-14 flex items-center px-4 bg-[#F8FAFC] border-b border-[#E2E8F0] gap-3">
      {/* Sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        aria-label="Collapse sidebar"
        className={cn(
          "hidden md:flex items-center justify-center rounded-md transition-colors",
          "min-w-[44px] min-h-[44px] text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A]"
        )}
      >
        <Menu className="size-5" />
      </button>

      {/* Wordmark (hidden on mobile — mobile sidebar trigger is in Sidebar component) */}
      <span className="hidden md:block text-sm font-semibold text-[#0F172A]">
        HealthConnect
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Notification bell — placeholder */}
      <button
        aria-label="Notifications (coming soon)"
        className={cn(
          "flex items-center justify-center rounded-md transition-colors",
          "min-w-[44px] min-h-[44px] text-[#64748B]"
        )}
      >
        <Bell className="size-5" />
      </button>

      {/* User dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1 transition-colors",
            "text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A] min-h-[44px]"
          )}
        >
          <Avatar>
            <AvatarFallback>{getInitials(userName || "U")}</AvatarFallback>
          </Avatar>
          <span className="hidden sm:block text-sm text-[#0F172A]">
            {userName}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end">
          <DropdownMenuItem>
            <Link href={`/${userRole}/profile`} className="w-full">
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={handleSignOut}
          >
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
