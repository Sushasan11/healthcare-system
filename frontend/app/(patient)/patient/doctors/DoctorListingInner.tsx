"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import DoctorCard from "./DoctorCard";
import FilterBar from "./FilterBar";
import DoctorListingSkeleton from "./DoctorListingSkeleton";
import type { DoctorListItem, DoctorListResponse } from "./types";

export default function DoctorListingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const specialty = searchParams.get("specialty") ?? "";
  const name = searchParams.get("name") ?? "";
  const page = Number(searchParams.get("page") ?? "1");

  const [doctors, setDoctors] = useState<DoctorListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const PAGE_SIZE = 12;

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    // Reset to page 1 when filters change
    if (!updates.page) params.set("page", "1");
    router.push(`?${params.toString()}`);
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchDoctors() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (specialty) params.set("specialty", specialty);
        if (name) params.set("name", name);
        params.set("page", String(page));
        params.set("page_size", String(PAGE_SIZE));

        const res = await apiFetch(`/doctors?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`Failed to load doctors (${res.status})`);
        }
        const data: DoctorListResponse = await res.json();
        if (!cancelled) {
          setDoctors(data.items);
          setTotal(data.total);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Something went wrong");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDoctors();
    return () => {
      cancelled = true;
    };
  }, [specialty, name, page]);

  if (loading) return <DoctorListingSkeleton />;

  if (error) {
    return (
      <Alert className="border-destructive">
        <AlertDescription className="flex items-center justify-between gap-4">
          <span>{error}</span>
          <button
            onClick={() => updateParams({})}
            className="text-sm font-semibold text-[#0EA5E9] hover:underline shrink-0"
          >
            Retry
          </button>
        </AlertDescription>
      </Alert>
    );
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#0F172A] mb-6">
        Find a Doctor
      </h1>

      <FilterBar
        specialty={specialty}
        name={name}
        onSpecialtyChange={(v) => updateParams({ specialty: v })}
        onNameChange={(v) => updateParams({ name: v })}
      />

      {doctors.length === 0 ? (
        <div className="flex flex-col items-center justify-center mt-12 gap-3">
          <Search className="size-12 text-[#64748B]" />
          <p className="text-base font-semibold text-[#0F172A]">
            No doctors found
          </p>
          <p className="text-sm text-[#64748B] text-center max-w-sm">
            Try a different specialty or clear your filters to browse all
            available doctors.
          </p>
          <button
            onClick={() => router.push("?")}
            className="text-sm font-semibold text-[#0EA5E9] hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {doctors.map((doctor) => (
              <DoctorCard key={doctor.id} doctor={doctor} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                const isActive = pageNum === page;
                return (
                  <Button
                    key={pageNum}
                    variant={isActive ? "default" : "outline"}
                    size="icon"
                    onClick={() =>
                      updateParams({ page: String(pageNum) })
                    }
                    aria-current={isActive ? "page" : undefined}
                    className="size-8"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
