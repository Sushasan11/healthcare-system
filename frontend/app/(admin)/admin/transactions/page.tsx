"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AdminTransaction {
  id: number;
  date: string;
  patient_name: string;
  provider_name: string;
  transaction_type: string;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
  status: string;
}

interface AdminTransactionList {
  transactions: AdminTransaction[];
  total_commission: number;
  page: number;
  page_size: number;
  total_pages: number;
  total_count: number;
}

function toNumber(v: number | string | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : parseFloat(v) || 0;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "paid" || s === "completed") {
    return "border-blue-400 text-blue-700 bg-blue-50";
  }
  if (s === "pending") {
    return "border-yellow-400 text-yellow-700 bg-yellow-50";
  }
  if (s === "refunded") {
    return "border-green-400 text-green-700 bg-green-50";
  }
  if (s === "failed") {
    return "border-red-400 text-red-700 bg-red-50";
  }
  return "border-slate-400 text-slate-700 bg-slate-50";
}

function formatStatus(status: string): string {
  if (!status) return "";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

export default function AdminTransactionsPage() {
  const [page, setPage] = useState<number>(1);
  const [data, setData] = useState<AdminTransactionList | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTransactions() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(
          `/admin/transactions?page=${page}&page_size=20`
        );
        if (res.ok) {
          const raw = await res.json();
          setData({
            transactions: (raw.transactions ?? []).map((t: AdminTransaction) => ({
              ...t,
              gross_amount: toNumber(t.gross_amount),
              commission_amount: toNumber(t.commission_amount),
              net_amount: toNumber(t.net_amount),
            })),
            total_commission: toNumber(raw.total_commission),
            page: raw.page ?? 1,
            page_size: raw.page_size ?? 20,
            total_pages: raw.total_pages ?? 1,
            total_count: raw.total_count ?? 0,
          });
        } else {
          setError("Could not load transactions. Refresh the page to try again.");
        }
      } catch {
        setError("Could not load transactions. Refresh the page to try again.");
      } finally {
        setLoading(false);
      }
    }
    fetchTransactions();
  }, [page]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#0F172A] mb-6">Transactions</h1>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : !error && data && data.total_count === 0 ? (
        <div className="rounded-lg border border-[#E2E8F0] bg-white text-center py-12">
          <p className="text-base font-semibold text-[#0F172A]">No transactions</p>
          <p className="text-sm text-[#64748B] mt-1 max-w-md mx-auto">
            Transactions will appear here once patients complete a booking or
            order payment.
          </p>
        </div>
      ) : !error && data ? (
        <>
          <div className="rounded-lg border border-[#E2E8F0] overflow-hidden bg-white">
            <div className="hidden md:grid grid-cols-[130px_1fr_1fr_140px_110px_120px_120px_110px] gap-4 px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold text-[#64748B] uppercase tracking-wide">
              <span>Date</span>
              <span>Patient</span>
              <span>Provider</span>
              <span>Type</span>
              <span>Gross</span>
              <span>Commission</span>
              <span>Net</span>
              <span>Status</span>
            </div>
            {data.transactions.map((t, index) => (
              <div
                key={t.id}
                className={`flex flex-col md:grid md:grid-cols-[130px_1fr_1fr_140px_110px_120px_120px_110px] gap-2 md:gap-4 px-4 py-4 items-start md:items-center ${
                  index < data.transactions.length - 1
                    ? "border-b border-[#E2E8F0]"
                    : ""
                }`}
              >
                <p className="text-sm text-[#0F172A]">{formatDate(t.date)}</p>
                <p className="text-sm text-[#0F172A] truncate">{t.patient_name}</p>
                <p className="text-sm text-[#0F172A] truncate">{t.provider_name}</p>
                <p className="text-sm text-[#0F172A]">{t.transaction_type}</p>
                <p className="text-sm text-[#0F172A]">
                  ${t.gross_amount.toFixed(2)}
                </p>
                <p className="text-sm text-[#64748B]">
                  ${t.commission_amount.toFixed(2)}
                </p>
                <p className="text-sm font-semibold text-[#0F172A]">
                  ${t.net_amount.toFixed(2)}
                </p>
                <Badge variant="outline" className={statusBadgeClass(t.status)}>
                  {formatStatus(t.status)}
                </Badge>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end mt-4">
            <p className="text-sm font-semibold text-[#0F172A]">
              Total Commission Collected: ${data.total_commission.toFixed(2)}
            </p>
          </div>

          {data.total_pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-[#64748B]">
                Page {data.page} of {data.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.total_pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
