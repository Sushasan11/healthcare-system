"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { apiFetch } from "@/lib/api";
import { PrescriptionDetail } from "@/components/prescription/PrescriptionDetail";
import { Skeleton } from "@/components/ui/skeleton";
import type { PrescriptionDetailOut } from "@/types/prescription";

export default function PatientPrescriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [prescription, setPrescription] = useState<PrescriptionDetailOut | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch(`/prescriptions/${id}`);
        if (!res.ok) throw new Error();
        setPrescription(await res.json());
      } catch {
        setError("Could not load this prescription. Please go back and try again.");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id]);

  return (
    <div className="p-6">
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}
      {error && <p className="text-sm text-[#EF4444]">{error}</p>}
      {!isLoading && !error && prescription && (
        <PrescriptionDetail prescription={prescription} role="patient" />
      )}
    </div>
  );
}
