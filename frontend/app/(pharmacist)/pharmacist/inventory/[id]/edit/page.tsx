"use client";

import { use, useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CATEGORY_OPTIONS,
  MedicineCategory,
  getMedicine,
  updateMedicine,
} from "@/lib/inventory";

interface FormState {
  name: string;
  generic_name: string;
  form: string;
  dosage: string;
  category: MedicineCategory;
  description: string;
  price: string;
  stock_count: string;
  low_stock_threshold: string;
  rx_required: boolean;
  archived: boolean;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

function validate(state: FormState): FieldErrors {
  const errs: FieldErrors = {};
  if (!state.name.trim()) errs.name = "Name is required";
  const price = Number(state.price);
  if (!Number.isFinite(price) || price < 0) errs.price = "Price must be ≥ 0";
  const stock = Number(state.stock_count);
  if (!Number.isInteger(stock) || stock < 0)
    errs.stock_count = "Stock must be an integer ≥ 0";
  const thr = Number(state.low_stock_threshold);
  if (!Number.isInteger(thr) || thr < 0)
    errs.low_stock_threshold = "Threshold must be an integer ≥ 0";
  return errs;
}

const labelClass = "block text-sm font-semibold text-[#0F172A] mb-1";
const inputClass =
  "w-full rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]";
const errClass = "text-red-600 text-xs mt-1";

export default function EditMedicinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const medicineId = parseInt(id, 10);

  const [state, setState] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const m = await getMedicine(medicineId);
        if (cancelled) return;
        setState({
          name: m.name,
          generic_name: m.generic_name ?? "",
          form: m.form ?? "",
          dosage: m.dosage ?? "",
          category: m.category,
          description: m.description ?? "",
          price: String(m.price),
          stock_count: String(m.stock_count),
          low_stock_threshold: String(m.low_stock_threshold),
          rx_required: m.rx_required,
          archived: m.archived,
        });
      } catch {
        if (!cancelled) setLoadError("Could not load this medicine.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [medicineId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!state) return;
    const v = validate(state);
    setErrors(v);
    if (Object.keys(v).length > 0) return;
    setSubmitting(true);
    try {
      await updateMedicine(medicineId, {
        name: state.name.trim(),
        generic_name: state.generic_name.trim() || null,
        form: state.form.trim() || null,
        dosage: state.dosage.trim() || null,
        category: state.category,
        description: state.description.trim() || null,
        price: String(Number(state.price).toFixed(2)),
        stock_count: Number(state.stock_count),
        low_stock_threshold: Number(state.low_stock_threshold),
        rx_required: state.rx_required,
        archived: state.archived,
      });
      toast.success("Medicine updated");
      router.push("/pharmacist/inventory");
    } catch {
      toast.error("Failed to update medicine");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 max-w-2xl space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (loadError || !state) {
    return (
      <div className="p-4 max-w-2xl space-y-4">
        <Link
          href="/pharmacist/inventory"
          className="inline-flex items-center gap-1 text-sm text-[#0EA5E9] hover:underline"
        >
          <ArrowLeft className="size-4" /> Back to inventory
        </Link>
        <Alert variant="destructive">
          <AlertDescription>{loadError ?? "Not found"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl space-y-4">
      <Link
        href="/pharmacist/inventory"
        className="inline-flex items-center gap-1 text-sm text-[#0EA5E9] hover:underline"
      >
        <ArrowLeft className="size-4" /> Back to inventory
      </Link>

      <h1 className="text-xl font-semibold text-[#0F172A]">Edit Medicine</h1>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="name" className={labelClass}>
            Name *
          </label>
          <input
            id="name"
            type="text"
            value={state.name}
            onChange={(e) => update("name", e.target.value)}
            className={inputClass}
            required
          />
          {errors.name && <p className={errClass}>{errors.name}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="generic_name" className={labelClass}>
              Generic name
            </label>
            <input
              id="generic_name"
              type="text"
              value={state.generic_name}
              onChange={(e) => update("generic_name", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="form" className={labelClass}>
              Form
            </label>
            <input
              id="form"
              type="text"
              value={state.form}
              onChange={(e) => update("form", e.target.value)}
              placeholder="tablet / capsule / syrup"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="dosage" className={labelClass}>
              Dosage
            </label>
            <input
              id="dosage"
              type="text"
              value={state.dosage}
              onChange={(e) => update("dosage", e.target.value)}
              placeholder="500mg / 10ml"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="category" className={labelClass}>
              Category *
            </label>
            <select
              id="category"
              value={state.category}
              onChange={(e) =>
                update("category", e.target.value as MedicineCategory)
              }
              className={inputClass}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="description" className={labelClass}>
            Description
          </label>
          <textarea
            id="description"
            value={state.description}
            onChange={(e) => update("description", e.target.value)}
            rows={3}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="price" className={labelClass}>
              Price *
            </label>
            <input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={state.price}
              onChange={(e) => update("price", e.target.value)}
              className={inputClass}
              required
            />
            {errors.price && <p className={errClass}>{errors.price}</p>}
          </div>
          <div>
            <label htmlFor="stock_count" className={labelClass}>
              Stock count *
            </label>
            <input
              id="stock_count"
              type="number"
              step="1"
              min="0"
              value={state.stock_count}
              onChange={(e) => update("stock_count", e.target.value)}
              className={inputClass}
              required
            />
            {errors.stock_count && (
              <p className={errClass}>{errors.stock_count}</p>
            )}
          </div>
          <div>
            <label htmlFor="low_stock_threshold" className={labelClass}>
              Low stock threshold *
            </label>
            <input
              id="low_stock_threshold"
              type="number"
              step="1"
              min="0"
              value={state.low_stock_threshold}
              onChange={(e) => update("low_stock_threshold", e.target.value)}
              className={inputClass}
              required
            />
            {errors.low_stock_threshold && (
              <p className={errClass}>{errors.low_stock_threshold}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="rx_required"
            type="checkbox"
            checked={state.rx_required}
            onChange={(e) => update("rx_required", e.target.checked)}
            className="size-4 rounded border-[#E2E8F0] text-[#0EA5E9] focus:ring-[#0EA5E9]"
          />
          <label htmlFor="rx_required" className="text-sm text-[#0F172A]">
            Prescription required (Rx)
          </label>
        </div>

        <div className="flex items-center gap-2 border-t border-[#E2E8F0] pt-4">
          <input
            id="archived"
            type="checkbox"
            checked={state.archived}
            onChange={(e) => update("archived", e.target.checked)}
            className="size-4 rounded border-[#E2E8F0] text-[#0EA5E9] focus:ring-[#0EA5E9]"
          />
          <label htmlFor="archived" className="text-sm text-[#0F172A]">
            Archived (hide from store and default list)
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => router.push("/pharmacist/inventory")}
            className="rounded-md border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC] min-h-[40px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-[#0EA5E9] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0284C7] disabled:opacity-60 min-h-[40px]"
          >
            {submitting ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
