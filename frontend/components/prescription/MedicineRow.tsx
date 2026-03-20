"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DrugAutocomplete } from "./DrugAutocomplete";
import type { PrescriptionItemCreate } from "@/types/prescription";

interface MedicineRowProps {
  index: number;
  item: PrescriptionItemCreate;
  onChange: (
    index: number,
    field: keyof PrescriptionItemCreate,
    value: string
  ) => void;
  onRemove: (index: number) => void;
  showRemove: boolean;
  errors?: Record<string, string>;
}

const DOSAGE_UNITS = ["mg", "ml", "g", "mcg", "IU", "tablet", "capsule"];
const FREQUENCIES = [
  "Once daily",
  "Twice daily",
  "Three times daily",
  "Four times daily",
  "As needed",
];

export function MedicineRow({
  index,
  item,
  onChange,
  onRemove,
  showRemove,
  errors = {},
}: MedicineRowProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-start py-2 border-b border-[#E2E8F0] last:border-0">
      {/* Medicine name — spans 2 cols on desktop */}
      <div className="md:col-span-2">
        <DrugAutocomplete
          value={item.medicine_name}
          onChange={(val) => onChange(index, "medicine_name", val)}
          placeholder="Medicine name"
        />
        {errors["medicine_name"] && (
          <p className="text-xs text-[#EF4444] mt-1">{errors["medicine_name"]}</p>
        )}
      </div>

      {/* Dosage amount */}
      <div className="md:col-span-1">
        <Input
          type="text"
          placeholder="Amount"
          value={item.dosage_amount}
          onChange={(e) => onChange(index, "dosage_amount", e.target.value)}
        />
        {errors["dosage_amount"] && (
          <p className="text-xs text-[#EF4444] mt-1">{errors["dosage_amount"]}</p>
        )}
      </div>

      {/* Dosage unit */}
      <div className="md:col-span-1">
        <Select
          value={item.dosage_unit || ""}
          onValueChange={(val) =>
            onChange(index, "dosage_unit", val ?? "")
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Unit" />
          </SelectTrigger>
          <SelectContent>
            {DOSAGE_UNITS.map((unit) => (
              <SelectItem key={unit} value={unit}>
                {unit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors["dosage_unit"] && (
          <p className="text-xs text-[#EF4444] mt-1">{errors["dosage_unit"]}</p>
        )}
      </div>

      {/* Frequency */}
      <div className="md:col-span-1">
        <Select
          value={item.frequency || ""}
          onValueChange={(val) =>
            onChange(index, "frequency", val ?? "")
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Frequency" />
          </SelectTrigger>
          <SelectContent>
            {FREQUENCIES.map((freq) => (
              <SelectItem key={freq} value={freq}>
                {freq}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors["frequency"] && (
          <p className="text-xs text-[#EF4444] mt-1">{errors["frequency"]}</p>
        )}
      </div>

      {/* Duration + Instructions + Remove in last col on desktop */}
      <div className="md:col-span-1 flex flex-col gap-2">
        <Input
          type="text"
          placeholder="e.g. 7 days"
          value={item.duration}
          onChange={(e) => onChange(index, "duration", e.target.value)}
        />
        {errors["duration"] && (
          <p className="text-xs text-[#EF4444] mt-1">{errors["duration"]}</p>
        )}
        <Input
          type="text"
          placeholder="e.g. Take after meals"
          value={item.instructions}
          onChange={(e) => onChange(index, "instructions", e.target.value)}
        />
        {errors["instructions"] && (
          <p className="text-xs text-[#EF4444] mt-1">{errors["instructions"]}</p>
        )}
        {showRemove && (
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label="Remove medicine row"
            className="text-[#EF4444] hover:bg-red-50 min-h-[44px] min-w-[44px]"
            onClick={() => onRemove(index)}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
