"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import type { ConsultationResponse } from "@/types/consultation";

type TabValue = "all" | "active" | "completed";

export default function ConsultationListPage() {
  const { user } = useAuth();
  const [consultations, setConsultations] = useState<ConsultationResponse[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabValue>("all");

  const isDoctor = user?.role === "doctor";
  const role = isDoctor ? "doctor" : "patient";
  const heading = isDoctor ? "Consultations" : "My Consultations";

  useEffect(() => {
    let cancelled = false;

    async function fetchConsultations() {
      setLoading(true);
      try {
        const query =
          activeTab !== "all" ? `?status=${activeTab}` : "";
        const res = await apiFetch(`/consultations${query}`);
        if (res.ok) {
          const data: ConsultationResponse[] = await res.json();
          if (!cancelled) setConsultations(data);
        }
      } catch {
        // Silent failure — list shows empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchConsultations();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function renderList(items: ConsultationResponse[]) {
    if (loading) {
      return (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center mt-12 gap-3">
          <MessageSquare className="size-12 text-[#64748B]" />
          <p className="text-base font-semibold text-[#0F172A]">
            No consultations yet
          </p>
          <p className="text-sm text-[#64748B] text-center max-w-sm">
            Your consultation history will appear here after your first
            appointment.
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        {items.map((consultation) => {
          const participantName = isDoctor
            ? consultation.patient_name
            : consultation.doctor_name;
          const isActive = consultation.status === "active";

          return (
            <Card key={consultation.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-[#0F172A]">
                    {participantName ?? "Unknown"}
                  </p>
                  <p className="text-xs text-[#64748B]">
                    Started {formatDate(consultation.started_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={isActive ? "outline" : "secondary"}>
                    {isActive ? "Active" : "Completed"}
                  </Badge>
                  <Link
                    href={`/${role}/consultations/${consultation.id}`}
                    className={
                      isActive
                        ? "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-semibold bg-[#0EA5E9] text-white hover:bg-[#0284C7] transition-colors"
                        : "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    }
                  >
                    {isActive ? "Join Consultation" : "View History"}
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  const filteredConsultations =
    activeTab === "all"
      ? consultations
      : consultations.filter((c) => c.status === activeTab);

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#0F172A] mb-6">{heading}</h1>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          {renderList(filteredConsultations)}
        </TabsContent>

        <TabsContent value="active" className="mt-4">
          {renderList(filteredConsultations)}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {renderList(filteredConsultations)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
