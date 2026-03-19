"use client";

import {
  Calendar,
  Video,
  Users,
  FileText,
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
    icon: Calendar,
    title: "Appointments",
    description: "Available in a later phase",
  },
  {
    icon: Video,
    title: "Consultations",
    description: "Available in a later phase",
  },
  {
    icon: Users,
    title: "Patients",
    description: "Available in a later phase",
  },
  {
    icon: FileText,
    title: "Prescriptions",
    description: "Available in a later phase",
  },
];

export default function DoctorDashboard() {
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
