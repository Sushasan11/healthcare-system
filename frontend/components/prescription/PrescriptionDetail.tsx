"use client";

import { FileText } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PrescriptionDetailOut } from "@/types/prescription";

interface PrescriptionDetailProps {
  prescription: PrescriptionDetailOut;
  role: "patient" | "doctor";
}

export function PrescriptionDetail({
  prescription,
  role,
}: PrescriptionDetailProps) {
  const formattedDate = new Date(prescription.issued_at).toLocaleDateString(
    "en-GB",
    { day: "2-digit", month: "short", year: "numeric" }
  );

  async function handleDownloadPdf() {
    const res = await apiFetch(`/prescriptions/${prescription.id}/pdf`);
    if (!res.ok) {
      toast.error("Could not download PDF. Please try again.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prescription_${prescription.id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-[#0F172A]">Prescription</h1>
          <span className="text-sm text-[#64748B]">{formattedDate}</span>
        </div>
        <Badge variant="secondary">{prescription.status}</Badge>
      </div>

      {/* Doctor info (patient view) */}
      {role === "patient" && (
        <div className="border border-[#E2E8F0] rounded-md p-3 bg-[#F8FAFC]">
          <p className="text-sm font-semibold text-[#0F172A]">
            {prescription.doctor_name ?? "Unknown Doctor"}
          </p>
          {prescription.doctor_specialty && (
            <p className="text-sm text-[#0F172A]">
              {prescription.doctor_specialty}
            </p>
          )}
          {prescription.doctor_license && (
            <p className="text-sm text-[#0F172A]">
              License: {prescription.doctor_license}
            </p>
          )}
        </div>
      )}

      {/* Patient info (doctor view) */}
      {role === "doctor" && (
        <div className="border border-[#E2E8F0] rounded-md p-3 bg-[#F8FAFC]">
          <p className="text-sm font-semibold text-[#0F172A]">
            {prescription.patient_name ?? "Unknown Patient"}
          </p>
        </div>
      )}

      {/* Diagnosis block */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-[#64748B]">Diagnosis / Clinical Notes</span>
        <div className="border border-[#E2E8F0] rounded-md p-3 bg-[#F8FAFC]">
          <p className="text-sm text-[#0F172A] whitespace-pre-wrap">
            {prescription.diagnosis}
          </p>
        </div>
      </div>

      {/* Medicines table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E2E8F0]">
              <th className="text-left font-semibold py-2 pr-3">Medicine</th>
              <th className="text-left font-semibold py-2 pr-3">Dosage</th>
              <th className="text-left font-semibold py-2 pr-3">Frequency</th>
              <th className="text-left font-semibold py-2 pr-3">Duration</th>
              <th className="text-left font-semibold py-2">Instructions</th>
            </tr>
          </thead>
          <tbody>
            {prescription.items.map((item) => (
              <tr key={item.id} className="border-b border-[#E2E8F0] last:border-0">
                <td className="py-2 pr-3">{item.medicine_name}</td>
                <td className="py-2 pr-3">
                  {item.dosage_amount} {item.dosage_unit}
                </td>
                <td className="py-2 pr-3">{item.frequency}</td>
                <td className="py-2 pr-3">{item.duration}</td>
                <td className="py-2">{item.instructions ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions row */}
      <div className="flex justify-end">
        <Button
          onClick={handleDownloadPdf}
          className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
        >
          <FileText className="size-4" />
          Download PDF
        </Button>
      </div>
    </div>
  );
}
