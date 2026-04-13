"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package,
  ClipboardList,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { getLowStockCount } from "@/lib/inventory";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

interface NavCard {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
}

const NAV_CARDS: NavCard[] = [
  {
    icon: ClipboardList,
    title: "Orders",
    description: "View order queue",
    href: "/pharmacist/orders",
  },
  {
    icon: Package,
    title: "Inventory",
    description: "Manage medicine catalog",
    href: "/pharmacist/inventory",
  },
  {
    icon: BarChart3,
    title: "Earnings",
    description: "View your earnings",
    href: "/pharmacist/earnings",
  },
];

function LowStockCard() {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getLowStockCount()
      .then((n) => {
        if (!cancelled) setCount(n);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link
      href="/pharmacist/inventory?filter=low-stock"
      data-testid="low-stock-count"
      className="block rounded-lg border border-[#E2E8F0] bg-white p-4 hover:border-[#0EA5E9] hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-5 text-[#F59E0B]" />
        <span className="text-base font-semibold text-[#0F172A]">
          Low Stock
        </span>
      </div>
      <div className="mt-3">
        {error ? (
          <p className="text-sm text-red-600">Failed to load</p>
        ) : count === null ? (
          <Skeleton className="h-8 w-16" />
        ) : count === 0 ? (
          <p className="text-sm font-semibold text-green-600">
            All medicines in stock
          </p>
        ) : (
          <>
            <p className="text-3xl font-semibold text-[#0F172A]">{count}</p>
            <p className="text-sm text-[#64748B] mt-1">
              medicine{count === 1 ? "" : "s"} below threshold
            </p>
          </>
        )}
      </div>
    </Link>
  );
}

export default function PharmacistDashboard() {
  const { user } = useAuth();
  const firstName = user?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-semibold text-[#0F172A]">
        {getGreeting()}, {firstName}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LowStockCard />
        {NAV_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              href={card.href}
              className="block rounded-lg border border-[#E2E8F0] bg-white p-4 hover:border-[#0EA5E9] hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-2">
                <Icon className="size-5 text-[#64748B]" />
                <span className="text-base font-semibold text-[#0F172A]">
                  {card.title}
                </span>
              </div>
              <p className="text-sm text-[#64748B] mt-3">{card.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
