"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { ShoppingCart, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { PrescriptionDetail } from "@/components/prescription/PrescriptionDetail";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
        <>
          <PrescriptionDetail prescription={prescription} role="patient" />

          {prescription.status === "issued" && (
            <div className="mt-6 bg-white border border-[#E2E8F0] rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShoppingCart className="size-5 text-[#0EA5E9]" />
                <div>
                  <p className="text-base font-semibold text-[#0F172A]">Order these medicines</p>
                  <p className="text-sm text-[#64748B]">Get your prescribed medicines delivered.</p>
                </div>
              </div>
              <Link href={`/patient/pharmacy/orders/new?prescription_id=${prescription.id}`}>
                <Button className="bg-[#0EA5E9] text-white hover:bg-[#0284C7] rounded-md px-4 py-2 text-sm font-semibold min-h-[44px]">
                  Order Prescribed Medicines
                </Button>
              </Link>
            </div>
          )}

          {(prescription.status === "ordered" || prescription.status === "dispensed") && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-md px-4 py-2 flex items-center gap-2">
              <AlertCircle className="size-4 text-[#EF4444]" />
              <span className="text-sm text-[#EF4444]">
                This prescription has already been used to place an order.
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
