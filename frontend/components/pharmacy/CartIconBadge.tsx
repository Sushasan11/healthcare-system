"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ShoppingCart } from "lucide-react";
import { useCart, useCartCount } from "@/lib/stores/cart";

export function CartIconBadge({ userId }: { userId: number | null }) {
  const setUser = useCart((s) => s.setUser);
  const hydrated = useCart((s) => s.hydrated);
  const count = useCartCount();

  useEffect(() => {
    setUser(userId);
  }, [userId, setUser]);

  return (
    <Link
      href="/patient/pharmacy/cart"
      aria-label="Cart"
      className="relative inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A]"
    >
      <ShoppingCart className="size-5" />
      {hydrated && count > 0 && (
        <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 rounded-full bg-blue-600 text-white text-[10px] leading-4 text-center font-medium">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
