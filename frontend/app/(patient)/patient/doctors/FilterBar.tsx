"use client";

import { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SPECIALTIES = [
  "Cardiology",
  "Dermatology",
  "Endocrinology",
  "Gastroenterology",
  "General Practice",
  "Neurology",
  "Obstetrics & Gynecology",
  "Ophthalmology",
  "Orthopedics",
  "Pediatrics",
  "Psychiatry",
  "Pulmonology",
  "Urology",
];

interface FilterBarProps {
  specialty: string;
  name: string;
  onSpecialtyChange: (v: string) => void;
  onNameChange: (v: string) => void;
}

export default function FilterBar({
  specialty,
  name,
  onSpecialtyChange,
  onNameChange,
}: FilterBarProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleNameInput(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onNameChange(value);
    }, 300);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col sm:flex-row gap-4 bg-[#F8FAFC] py-4 px-6 rounded-lg">
      {/* Specialty Select */}
      <Select value={specialty} onValueChange={(v) => onSpecialtyChange(v ?? "")}>
        <SelectTrigger className="w-full sm:w-52">
          <SelectValue placeholder="All Specialties" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All Specialties</SelectItem>
          {SPECIALTIES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Name Search */}
      <div className="relative flex-1 min-w-[240px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-[#64748B] pointer-events-none" />
        <Input
          type="text"
          placeholder="Search by doctor name..."
          defaultValue={name}
          onChange={handleNameInput}
          className="pl-8"
        />
      </div>
    </div>
  );
}
