"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MedicineRow } from "./MedicineRow";
import type { PrescriptionItemCreate } from "@/types/prescription";

interface PrescriptionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultationId: number;
  onSuccess?: () => void;
}

function emptyItem(): PrescriptionItemCreate {
  return {
    medicine_name: "",
    dosage_amount: "",
    dosage_unit: "",
    frequency: "",
    duration: "",
    instructions: "",
  };
}

export function PrescriptionForm({
  open,
  onOpenChange,
  consultationId,
  onSuccess,
}: PrescriptionFormProps) {
  const [diagnosis, setDiagnosis] = useState("");
  const [items, setItems] = useState<PrescriptionItemCreate[]>([emptyItem()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [itemErrors, setItemErrors] = useState<
    Record<number, Record<string, string>>
  >({});

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
    setItemErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }

  function updateItem(
    index: number,
    field: keyof PrescriptionItemCreate,
    value: string
  ) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    const newItemErrors: Record<number, Record<string, string>> = {};

    if (diagnosis.trim().length < 10) {
      newErrors["diagnosis"] =
        "Diagnosis must be at least 10 characters.";
    }

    items.forEach((item, index) => {
      const rowErrors: Record<string, string> = {};
      if (!item.medicine_name.trim()) {
        rowErrors["medicine_name"] = "Medicine name is required.";
      }
      if (!item.dosage_amount.trim()) {
        rowErrors["dosage_amount"] = "Dosage amount is required.";
      }
      if (!item.dosage_unit.trim()) {
        rowErrors["dosage_unit"] = "Dosage unit is required.";
      }
      if (!item.frequency.trim()) {
        rowErrors["frequency"] = "Frequency is required.";
      }
      if (!item.duration.trim()) {
        rowErrors["duration"] = "Duration is required.";
      }
      if (Object.keys(rowErrors).length > 0) {
        newItemErrors[index] = rowErrors;
      }
    });

    setErrors(newErrors);
    setItemErrors(newItemErrors);

    return (
      Object.keys(newErrors).length === 0 &&
      Object.keys(newItemErrors).length === 0
    );
  }

  async function handleSubmit() {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const res = await apiFetch("/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultation_id: consultationId,
          diagnosis,
          items,
        }),
      });

      if (res.ok) {
        onOpenChange(false);
        onSuccess?.();
        toast.success("Prescription issued successfully.");
        // Reset form
        setDiagnosis("");
        setItems([emptyItem()]);
        setErrors({});
        setItemErrors({});
      } else {
        toast.error("Could not issue prescription. Please try again.");
      }
    } catch {
      toast.error("Could not issue prescription. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDiscard() {
    onOpenChange(false);
    setDiagnosis("");
    setItems([emptyItem()]);
    setErrors({});
    setItemErrors({});
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px] overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Write Prescription</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Diagnosis */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="diagnosis">Diagnosis / Clinical Notes</Label>
            <Textarea
              id="diagnosis"
              placeholder="Enter diagnosis and clinical notes..."
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              rows={3}
            />
            {errors["diagnosis"] && (
              <p className="text-xs text-[#EF4444]">{errors["diagnosis"]}</p>
            )}
          </div>

          {/* Medicines */}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-[#0F172A]">Medicines</h3>
            <div className="flex flex-col">
              {items.map((item, index) => (
                <MedicineRow
                  key={index}
                  index={index}
                  item={item}
                  onChange={updateItem}
                  onRemove={removeItem}
                  showRemove={items.length > 1}
                  errors={itemErrors[index]}
                />
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={addItem}
              className="self-start"
            >
              <Plus className="size-4" />
              Add Medicine
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
          <Button
            type="button"
            variant="ghost"
            onClick={handleDiscard}
            disabled={isSubmitting}
          >
            Discard Prescription
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin size-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Issuing...
              </span>
            ) : (
              "Issue Prescription"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
