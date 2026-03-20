"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PrescriptionOut } from "@/types/prescription";

interface PrescriptionCardProps {
  prescription: PrescriptionOut;
  role: "patient" | "doctor";
  onClick?: () => void;
}

export function PrescriptionCard({
  prescription,
  role,
  onClick,
}: PrescriptionCardProps) {
  const displayName =
    role === "patient" ? prescription.doctor_name : prescription.patient_name;

  const formattedDate = new Date(prescription.issued_at).toLocaleDateString(
    "en-GB",
    { day: "2-digit", month: "short", year: "numeric" }
  );

  const diagnosisSnippet = prescription.diagnosis_snippet
    ? prescription.diagnosis_snippet.slice(0, 80)
    : null;

  const medicineLabel =
    prescription.item_count === 1
      ? "1 medicine"
      : `${prescription.item_count} medicines`;

  return (
    <Card
      className={cn(
        "cursor-pointer hover:bg-[#F8FAFC] transition-colors",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <CardContent className="py-4 px-4 space-y-1">
        {/* Row 1: Name + Date */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-[#0F172A]">
            {displayName ?? "Unknown"}
          </span>
          <span className="text-xs text-[#64748B]">{formattedDate}</span>
        </div>

        {/* Row 2: Diagnosis snippet */}
        {diagnosisSnippet && (
          <p className="text-sm text-[#64748B] truncate">{diagnosisSnippet}</p>
        )}

        {/* Row 3: Medicine count + Status badges */}
        <div className="flex items-center gap-2">
          <Badge variant="outline">{medicineLabel}</Badge>
          <Badge variant="secondary">Issued</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
