"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Inbox } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  CATEGORY_OPTIONS,
  Medicine,
  MedicineCategory,
  MedicineStatus,
  adjustStock,
  categoryLabel,
  listMedicines,
  medicineStockBadge,
  updateMedicine,
} from "@/lib/inventory";

const STATUS_CHIPS: { value: MedicineStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in_stock", label: "In Stock" },
  { value: "low_stock", label: "Low Stock" },
  { value: "out_of_stock", label: "Out of Stock" },
  { value: "archived", label: "Archived" },
];

function StockBadge({ kind }: { kind: "out" | "low" | "ok" }) {
  if (kind === "ok") return null;
  if (kind === "out") {
    return (
      <span
        className="inline-flex items-center rounded-md border border-red-400 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700"
        aria-label="Out of stock"
      >
        Out of Stock
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded-md border border-amber-400 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700"
      aria-label="Low stock"
    >
      Low Stock
    </span>
  );
}

export default function PharmacistInventoryPage() {
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get("filter");

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [category, setCategory] = useState<MedicineCategory | "">("");
  const [statusFilter, setStatusFilter] = useState<MedicineStatus>(
    initialFilter === "low-stock" ? "low_stock" : "all"
  );

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await listMedicines({
          q: debouncedQ.trim() || undefined,
          category: category || undefined,
          status: statusFilter,
          includeArchived: statusFilter === "archived",
        });
        if (!cancelled) setMedicines(data);
      } catch {
        if (!cancelled)
          setError("Could not load inventory. Please refresh the page.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [debouncedQ, category, statusFilter]);

  async function handleDelta(id: number, delta: number) {
    setMedicines((prev) =>
      prev.map((x) =>
        x.id === id ? { ...x, stock_count: x.stock_count + delta } : x
      )
    );
    try {
      const updated = await adjustStock(id, delta);
      setMedicines((prev) => prev.map((x) => (x.id === id ? updated : x)));
    } catch (e) {
      // revert
      setMedicines((prev) =>
        prev.map((x) =>
          x.id === id ? { ...x, stock_count: x.stock_count - delta } : x
        )
      );
      const code = e instanceof Error ? e.message : "adjust_failed";
      if (code === "stock_underflow") {
        toast.error("Stock cannot go below 0");
      } else {
        toast.error("Failed to update stock");
      }
    }
  }

  async function handleArchiveToggle(m: Medicine) {
    try {
      const updated = await updateMedicine(m.id, { archived: !m.archived });
      setMedicines((prev) => {
        // If the row no longer matches the active filter, drop it from view
        if (statusFilter === "archived" && !updated.archived) {
          return prev.filter((x) => x.id !== m.id);
        }
        if (statusFilter !== "archived" && updated.archived) {
          return prev.filter((x) => x.id !== m.id);
        }
        return prev.map((x) => (x.id === m.id ? updated : x));
      });
      toast.success(updated.archived ? "Medicine archived" : "Medicine restored");
    } catch {
      toast.error("Failed to update medicine");
    }
  }

  const showEmpty = !loading && !error && medicines.length === 0;
  const hasFilters =
    debouncedQ.trim() !== "" || category !== "" || statusFilter !== "all";
  const emptyText = useMemo(
    () =>
      hasFilters
        ? "No medicines match your filters"
        : "No medicines yet — add one to get started",
    [hasFilters]
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-[#0F172A]">Inventory</h1>
        <Link
          href="/pharmacist/inventory/new"
          className="inline-flex items-center justify-center rounded-md bg-[#0EA5E9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0284C7] min-h-[40px]"
        >
          + Add Medicine
        </Link>
      </div>

      {/* Filter bar */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name…"
            aria-label="Search medicines by name"
            className="flex-1 rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
          />
          <select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as MedicineCategory | "")
            }
            aria-label="Filter by category"
            className="rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
          >
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_CHIPS.map((chip) => {
            const active = statusFilter === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => setStatusFilter(chip.value)}
                aria-pressed={active}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors min-h-[32px]",
                  active
                    ? "bg-[#0EA5E9] text-white"
                    : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}

      {showEmpty && (
        <div className="py-16 flex flex-col items-center text-center">
          <Inbox className="size-8 text-[#E2E8F0]" />
          <p className="text-sm font-semibold text-[#0F172A] mt-3">
            {emptyText}
          </p>
          <p className="text-sm text-[#64748B] mt-1">
            Use the Add Medicine button to create your first record.
          </p>
        </div>
      )}

      {!loading && !error && medicines.length > 0 && (
        <div>
          <div className="grid grid-cols-[2fr_1fr_100px_140px_80px_60px_220px] gap-4 border-b border-[#E2E8F0] pb-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            <span>Name</span>
            <span>Category</span>
            <span>Price</span>
            <span>Stock</span>
            <span>Threshold</span>
            <span>Rx</span>
            <span className="text-right">Actions</span>
          </div>
          {medicines.map((m) => {
            const badge = medicineStockBadge(m);
            const subtitleParts = [m.generic_name, m.dosage].filter(
              (p) => p && p.trim() !== ""
            );
            return (
              <div
                key={m.id}
                className="grid grid-cols-[2fr_1fr_100px_140px_80px_60px_220px] gap-4 border-b border-[#E2E8F0] py-3 min-h-[56px] items-center hover:bg-[#F8FAFC]"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0F172A] truncate">
                    {m.name}
                  </p>
                  {subtitleParts.length > 0 && (
                    <p className="text-xs text-[#64748B] truncate">
                      {subtitleParts.join(" · ")}
                    </p>
                  )}
                </div>
                <span className="text-sm text-[#0F172A]">
                  {categoryLabel(m.category)}
                </span>
                <span className="text-sm text-[#0F172A]">
                  ${Number(m.price).toFixed(2)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#0F172A]">
                    {m.stock_count}
                  </span>
                  <StockBadge kind={badge} />
                </div>
                <span className="text-sm text-[#64748B]">
                  {m.low_stock_threshold}
                </span>
                <span className="text-sm text-[#64748B]">
                  {m.rx_required ? "Rx" : "—"}
                </span>
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => handleDelta(m.id, -1)}
                    disabled={m.stock_count === 0}
                    aria-label={`Decrease stock for ${m.name}`}
                    className="inline-flex items-center justify-center rounded-md border border-[#E2E8F0] bg-white text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-40 disabled:cursor-not-allowed min-h-[32px] min-w-[32px]"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelta(m.id, +1)}
                    aria-label={`Increase stock for ${m.name}`}
                    className="inline-flex items-center justify-center rounded-md border border-[#E2E8F0] bg-white text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC] min-h-[32px] min-w-[32px]"
                  >
                    +
                  </button>
                  <Link
                    href={`/pharmacist/inventory/${m.id}/edit`}
                    className="text-xs font-semibold text-[#0EA5E9] hover:underline px-2"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleArchiveToggle(m)}
                    className="text-xs font-semibold text-[#64748B] hover:text-[#0F172A] px-2"
                  >
                    {m.archived ? "Unarchive" : "Archive"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
