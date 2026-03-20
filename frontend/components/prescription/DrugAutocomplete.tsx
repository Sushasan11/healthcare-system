"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DrugOut } from "@/types/prescription";

interface DrugAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function DrugAutocomplete({
  value,
  onChange,
  placeholder = "Search medicine...",
  className,
}: DrugAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<DrugOut[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync query with external value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const fetchDrugs = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setIsOpen(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch(
        "/drugs?q=" + encodeURIComponent(q.trim()) + "&limit=20"
      );
      if (!res.ok) {
        throw new Error("Failed to fetch");
      }
      const data: DrugOut[] = await res.json();
      setResults(data);
      setIsOpen(true);
      setSelectedIndex(-1);
    } catch {
      setError("Could not load medicines. Type to retry.");
      setResults([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    onChange(q);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      fetchDrugs(q);
    }, 300);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  function selectDrug(drug: DrugOut) {
    onChange(drug.name);
    setQuery(drug.name);
    setIsOpen(false);
    setResults([]);
    setSelectedIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && results[selectedIndex]) {
        selectDrug(results[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  }

  // Click-outside handler
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function formatDrugLabel(drug: DrugOut): string {
    let label = drug.name;
    if (drug.form) {
      label += ` (${drug.form})`;
    }
    return label;
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        autoComplete="off"
      />
      {error && (
        <p className="text-sm text-[#EF4444] mt-1">{error}</p>
      )}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E2E8F0] rounded-md shadow-md max-h-48 overflow-y-auto z-50">
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-[#64748B] animate-pulse">
              Loading...
            </div>
          ) : results.length === 0 && query.trim() ? (
            <div className="px-3 py-2 text-sm text-[#64748B]">
              No medicines found
            </div>
          ) : (
            results.map((drug, index) => (
              <div
                key={drug.id}
                className={cn(
                  "px-3 py-2 text-sm cursor-pointer hover:bg-[#F8FAFC]",
                  index === selectedIndex && "bg-[#F8FAFC]"
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectDrug(drug);
                }}
              >
                {formatDrugLabel(drug)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
