"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { PrescriptionCard } from "@/components/prescription/PrescriptionCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { PrescriptionOut } from "@/types/prescription";

export default function PatientPrescriptionsPage() {
  const router = useRouter();
  const [prescriptions, setPrescriptions] = useState<PrescriptionOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch("/prescriptions");
        if (!res.ok) throw new Error();
        setPrescriptions(await res.json());
      } catch {
        setError("Could not load prescriptions. Please refresh the page.");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold text-[#0F172A]">My Prescriptions</h1>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-[#EF4444]">{error}</p>
      )}

      {!isLoading && !error && prescriptions.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm font-semibold text-[#0F172A]">No prescriptions yet</p>
          <p className="text-sm text-[#64748B] mt-1">Prescriptions from your consultations will appear here.</p>
        </div>
      )}

      {!isLoading && !error && prescriptions.length > 0 && (
        <div className="space-y-3">
          {prescriptions.map((rx) => (
            <PrescriptionCard
              key={rx.id}
              prescription={rx}
              role="patient"
              onClick={() => router.push(`/patient/prescriptions/${rx.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
