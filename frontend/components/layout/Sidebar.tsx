"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  User,
  ClipboardCheck,
  Users,
  ChevronLeft,
  ChevronRight,
  Menu,
  Search,
  Calendar,
  Clock,
  MessageSquare,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

type Role = "patient" | "doctor" | "pharmacist" | "admin";

interface MenuItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MENU_ITEMS: Record<Role, MenuItem[]> = {
  patient: [
    { label: "Dashboard", href: "/patient/dashboard", icon: LayoutDashboard },
    { label: "Find Doctors", href: "/patient/doctors", icon: Search },
    { label: "My Appointments", href: "/patient/appointments", icon: Calendar },
    { label: "Consultations", href: "/patient/consultations", icon: MessageSquare },
    { label: "My Prescriptions", href: "/patient/prescriptions", icon: FileText },
    { label: "Profile", href: "/patient/profile", icon: User },
  ],
  doctor: [
    { label: "Dashboard", href: "/doctor/dashboard", icon: LayoutDashboard },
    { label: "Appointments", href: "/doctor/appointments", icon: Calendar },
    { label: "Consultations", href: "/doctor/consultations", icon: MessageSquare },
    { label: "Prescriptions", href: "/doctor/prescriptions", icon: FileText },
    { label: "My Schedule", href: "/doctor/schedule", icon: Clock },
    { label: "Profile", href: "/doctor/profile", icon: User },
  ],
  pharmacist: [
    {
      label: "Dashboard",
      href: "/pharmacist/dashboard",
      icon: LayoutDashboard,
    },
    { label: "Prescriptions", href: "/pharmacist/prescriptions", icon: FileText },
    { label: "Profile", href: "/pharmacist/profile", icon: User },
  ],
  admin: [
    { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    {
      label: "Pending Applications",
      href: "/admin/applications",
      icon: ClipboardCheck,
    },
    { label: "Users", href: "/admin/users", icon: Users },
  ],
};

interface SidebarProps {
  role: Role;
  isCollapsed: boolean;
  onToggle: () => void;
}

function SidebarNav({
  role,
  isCollapsed,
}: {
  role: Role;
  isCollapsed: boolean;
}) {
  const pathname = usePathname();
  const items = MENU_ITEMS[role];

  return (
    <nav className="flex-1 px-2 py-4 space-y-1">
      {items.map((item) => {
        const isActive = pathname.startsWith(item.href);
        const Icon = item.icon;

        if (isCollapsed) {
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger
                render={
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center justify-center rounded-md transition-colors",
                      "min-w-[44px] min-h-[44px]",
                      isActive
                        ? "border-l-[3px] border-[#0EA5E9] bg-sky-50 text-[#0EA5E9]"
                        : "text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A]"
                    )}
                  />
                }
              >
                <Icon className="size-5" />
                <span className="sr-only">{item.label}</span>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              isActive
                ? "border-l-[3px] border-[#0EA5E9] bg-sky-50 text-[#0EA5E9] font-semibold"
                : "text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A]"
            )}
          >
            <Icon className="size-5 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function DesktopSidebar({ role, isCollapsed, onToggle }: SidebarProps) {
  return (
    <TooltipProvider>
      <aside
        className={cn(
          "hidden md:flex flex-col h-screen sticky top-0 bg-[#F8FAFC] border-r border-[#E2E8F0] transition-all duration-200",
          isCollapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo area */}
        <div
          className={cn(
            "flex items-center h-14 border-b border-[#E2E8F0] px-4",
            isCollapsed ? "justify-center" : "justify-between"
          )}
        >
          {!isCollapsed && (
            <span className="text-sm font-semibold text-[#0F172A]">
              HealthConnect
            </span>
          )}
        </div>

        {/* Navigation */}
        <SidebarNav role={role} isCollapsed={isCollapsed} />

        {/* Collapse toggle */}
        <div className="p-2 border-t border-[#E2E8F0]">
          <button
            onClick={onToggle}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex items-center justify-center rounded-md transition-colors text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A]",
              "min-w-[44px] min-h-[44px] w-full"
            )}
          >
            {isCollapsed ? (
              <ChevronRight className="size-5" />
            ) : (
              <ChevronLeft className="size-5" />
            )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}

function MobileSidebar({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            aria-label="Open sidebar"
            className="md:hidden flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A]"
          />
        }
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-60 p-0 bg-[#F8FAFC]">
        <div className="flex flex-col h-full">
          <div className="flex items-center h-14 border-b border-[#E2E8F0] px-4">
            <span className="text-sm font-semibold text-[#0F172A]">
              HealthConnect
            </span>
          </div>
          <TooltipProvider>
            <SidebarNav role={role} isCollapsed={false} />
          </TooltipProvider>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function Sidebar({ role, isCollapsed, onToggle }: SidebarProps) {
  return (
    <>
      <DesktopSidebar role={role} isCollapsed={isCollapsed} onToggle={onToggle} />
      <MobileSidebar role={role} />
    </>
  );
}
