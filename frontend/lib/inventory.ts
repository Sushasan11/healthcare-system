import { apiFetch } from "@/lib/api";

export type MedicineCategory =
  | "pain_relief"
  | "cold_and_flu"
  | "digestive"
  | "vitamins_supplements"
  | "first_aid"
  | "skin_care";

export type MedicineStatus =
  | "all"
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "archived";

export interface Medicine {
  id: number;
  name: string;
  generic_name: string | null;
  form: string | null;
  dosage: string | null;
  category: MedicineCategory;
  description: string | null;
  price: string;
  stock_count: number;
  low_stock_threshold: number;
  rx_required: boolean;
  archived: boolean;
}

export const CATEGORY_OPTIONS: { value: MedicineCategory; label: string }[] = [
  { value: "pain_relief", label: "Pain Relief" },
  { value: "cold_and_flu", label: "Cold & Flu" },
  { value: "digestive", label: "Digestive" },
  { value: "vitamins_supplements", label: "Vitamins & Supplements" },
  { value: "first_aid", label: "First Aid" },
  { value: "skin_care", label: "Skin Care" },
];

export function categoryLabel(cat: MedicineCategory): string {
  return CATEGORY_OPTIONS.find((o) => o.value === cat)?.label ?? cat;
}

export function medicineStockBadge(m: Medicine): "out" | "low" | "ok" {
  if (m.stock_count === 0) return "out";
  if (m.stock_count <= m.low_stock_threshold) return "low";
  return "ok";
}

export interface ListMedicinesParams {
  q?: string;
  category?: MedicineCategory | "";
  status?: MedicineStatus;
  includeArchived?: boolean;
}

async function readErrorCode(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    const code = body?.detail?.error;
    if (typeof code === "string") return code;
  } catch {
    // ignore
  }
  return fallback;
}

export async function listMedicines(
  params: ListMedicinesParams
): Promise<Medicine[]> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.category) qs.set("category", params.category);
  if (params.status) qs.set("status", params.status);
  if (params.includeArchived) qs.set("include_archived", "true");
  const res = await apiFetch(`/pharmacy/inventory?${qs.toString()}`);
  if (!res.ok) throw new Error(await readErrorCode(res, "list_failed"));
  return res.json();
}

export async function getMedicine(id: number): Promise<Medicine> {
  const res = await apiFetch(`/pharmacy/inventory/${id}`);
  if (!res.ok) throw new Error(await readErrorCode(res, "get_failed"));
  return res.json();
}

export async function createMedicine(
  body: Partial<Medicine>
): Promise<Medicine> {
  const res = await apiFetch(`/pharmacy/inventory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readErrorCode(res, "create_failed"));
  return res.json();
}

export async function updateMedicine(
  id: number,
  body: Partial<Medicine>
): Promise<Medicine> {
  const res = await apiFetch(`/pharmacy/inventory/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readErrorCode(res, "update_failed"));
  return res.json();
}

export async function adjustStock(
  id: number,
  delta: number
): Promise<Medicine> {
  const res = await apiFetch(`/pharmacy/inventory/${id}/adjust-stock`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delta }),
  });
  if (!res.ok) throw new Error(await readErrorCode(res, "adjust_failed"));
  return res.json();
}

export async function getLowStockCount(): Promise<number> {
  const res = await apiFetch(`/pharmacy/dashboard/low-stock-count`);
  if (!res.ok)
    throw new Error(await readErrorCode(res, "low_stock_count_failed"));
  const data = await res.json();
  return data.count as number;
}
