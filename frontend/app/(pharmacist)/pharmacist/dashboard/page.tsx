"use client";

import {
  ShoppingCart,
  Package,
  FileText,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const PLACEHOLDER_CARDS = [
  {
    icon: ShoppingCart,
    title: "Orders",
    description: "Available in a later phase",
  },
  {
    icon: Package,
    title: "Inventory",
    description: "Available in a later phase",
  },
  {
    icon: FileText,
    title: "Prescriptions",
    description: "Available in a later phase",
  },
  {
    icon: BarChart3,
    title: "Reports",
    description: "Available in a later phase",
  },
];

export default function PharmacistDashboard() {
  const { user } = useAuth();
  const firstName = user?.full_name?.split(" ")[0] ?? "there";

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#0F172A]">
        {getGreeting()}, {firstName}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {PLACEHOLDER_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardHeader>
                <Icon className="size-5 text-[#64748B]" />
                <CardTitle className="text-base font-semibold text-[#0F172A]">
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm text-[#64748B]">
                  {card.description}
                </CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
