import Link from "next/link";
import {
  Pill,
  ShieldPlus,
  Heart,
  Baby,
  Sun,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { serverFetch } from "@/lib/serverFetch";
import { ProductCard } from "@/components/pharmacy/ProductCard";

type CategoryCount = { category: string; label: string; count: number };
type CategoryList = { categories: CategoryCount[] };
type CatalogItem = {
  id: number;
  name: string;
  category: string;
  dosage: string | null;
  price: string;
  stock_count: number;
  low_stock_threshold: number;
};
type CatalogList = {
  items: CatalogItem[];
  total: number;
  page: number;
  page_size: number;
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  pain_relief: Pill,
  cold_and_flu: Sun,
  digestive_health: Heart,
  first_aid: ShieldPlus,
  skin_care: Baby,
  vitamins_and_supplements: Stethoscope,
};

export default async function PharmacyLandingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: qParam } = await searchParams;
  const q = qParam ?? "";

  let cats: CategoryList = { categories: [] };
  let recent: CatalogList = { items: [], total: 0, page: 1, page_size: 6 };
  let loadError: string | null = null;

  try {
    [cats, recent] = await Promise.all([
      serverFetch<CategoryList>("/pharmacy/catalog/categories"),
      serverFetch<CatalogList>(
        `/pharmacy/catalog?page=1&page_size=6${
          q ? `&q=${encodeURIComponent(q)}` : ""
        }`,
      ),
    ]);
  } catch (err) {
    loadError =
      err instanceof Error ? err.message : "Failed to load pharmacy catalog";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#0F172A]">Pharmacy</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Browse over-the-counter medicines. No prescription required.
        </p>
      </div>

      <form method="GET" className="max-w-2xl">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search medicines by name"
          className="w-full px-4 py-2 border border-[#E2E8F0] rounded-md text-sm focus:outline-none focus:border-[#0EA5E9]"
        />
      </form>

      {loadError && (
        <div className="p-4 border border-red-200 bg-red-50 text-red-700 rounded-md text-sm">
          Couldn&apos;t reach the pharmacy catalog. Please try again in a
          moment.
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-[#0F172A] mb-3">
          Browse by category
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {cats.categories.map((c) => {
            const Icon = CATEGORY_ICONS[c.category] ?? Pill;
            return (
              <Link
                key={c.category}
                href={`/patient/pharmacy/category/${c.category}`}
                className="p-4 border border-[#E2E8F0] rounded-md hover:bg-[#F8FAFC] transition flex items-center gap-3"
              >
                <Icon className="size-5 text-[#64748B]" />
                <div>
                  <div className="text-sm font-medium text-[#0F172A]">
                    {c.label}
                  </div>
                  <div className="text-xs text-[#64748B]">{c.count} items</div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-[#0F172A] mb-3">
          {q ? `Results for "${q}"` : "Recently added"}
        </h2>
        {recent.items.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#64748B] border border-[#E2E8F0] rounded-md">
            {q
              ? `No medicines found for '${q}'`
              : "The pharmacy isn't stocked yet — check back soon."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recent.items.map((it) => (
              <ProductCard
                key={it.id}
                id={it.id}
                name={it.name}
                category={it.category}
                dosage={it.dosage}
                price={it.price}
                stockCount={it.stock_count}
                lowStockThreshold={it.low_stock_threshold}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
