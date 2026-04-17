"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DollarSign, TrendingDown, Wallet } from "lucide-react";

interface LedgerEntry {
  id: number;
  created_at: string;
  patient_name: string;
  transaction_type: string;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
}

interface EarningsSummary {
  total_gross: number;
  total_commission: number;
  total_net: number;
  total_count: number;
  transactions: LedgerEntry[];
  page: number;
  page_size: number;
  total_pages: number;
}

interface EarningsDashboardProps {
  role: "doctor" | "pharmacist";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toNumber(v: number | string | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : parseFloat(v) || 0;
}

export default function EarningsDashboard({ role }: EarningsDashboardProps) {
  const [period, setPeriod] = useState<string>("all_time");
  const [page, setPage] = useState<number>(1);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEarnings() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(
          `/payments/earnings?period=${period}&page=${page}&page_size=10`
        );
        if (res.ok) {
          const data = await res.json();
          setEarnings({
            total_gross: toNumber(data.total_gross),
            total_commission: toNumber(data.total_commission),
            total_net: toNumber(data.total_net),
            total_count: data.total_count ?? 0,
            transactions: (data.transactions ?? []).map((t: LedgerEntry) => ({
              ...t,
              gross_amount: toNumber(t.gross_amount),
              commission_amount: toNumber(t.commission_amount),
              net_amount: toNumber(t.net_amount),
            })),
            page: data.page ?? 1,
            page_size: data.page_size ?? 10,
            total_pages: data.total_pages ?? 1,
          });
        } else {
          setError("Could not load your earnings. Refresh the page to try again.");
        }
      } catch {
        setError("Could not load your earnings. Refresh the page to try again.");
      } finally {
        setLoading(false);
      }
    }
    fetchEarnings();
  }, [period, page]);

  const emptyBody =
    role === "doctor"
      ? "Your earnings will appear here once patients have booked and paid for consultations."
      : "Your earnings will appear here once prescription orders have been fulfilled and paid.";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#0F172A]">Earnings</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[#0F172A]">Period</span>
          <select
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-[#E2E8F0] px-3 py-1.5 text-sm bg-white"
          >
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="all_time">All Time</option>
          </select>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-[#64748B]">
              Total Earned
            </CardTitle>
            <DollarSign className="h-5 w-5 text-[#0EA5E9]" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              <p className="text-3xl font-semibold text-[#0EA5E9]">
                ${(earnings?.total_gross ?? 0).toFixed(2)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-[#64748B]">
              Commission Deducted
            </CardTitle>
            <TrendingDown className="h-5 w-5 text-[#64748B]" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              <p className="text-3xl font-semibold text-[#0F172A]">
                ${(earnings?.total_commission ?? 0).toFixed(2)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-[#64748B]">
              Net Payable
            </CardTitle>
            <Wallet className="h-5 w-5 text-[#0EA5E9]" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              <p className="text-3xl font-semibold text-[#0EA5E9]">
                ${(earnings?.total_net ?? 0).toFixed(2)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transaction table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : !error && earnings && earnings.total_count === 0 ? (
        <div className="rounded-lg border border-[#E2E8F0] bg-white text-center py-12">
          <p className="text-base font-semibold text-[#0F172A]">
            No transactions yet
          </p>
          <p className="text-sm text-[#64748B] mt-1 max-w-md mx-auto">
            {emptyBody}
          </p>
        </div>
      ) : !error && earnings ? (
        <>
          <div className="rounded-lg border border-[#E2E8F0] overflow-hidden bg-white">
            <div className="hidden md:grid grid-cols-[140px_1fr_160px_120px_140px_140px] gap-4 px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs font-semibold text-[#64748B] uppercase tracking-wide">
              <span>Date</span>
              <span>Patient</span>
              <span>Type</span>
              <span>Gross</span>
              <span>Commission</span>
              <span>Net</span>
            </div>
            {earnings.transactions.map((t, index) => (
              <div
                key={t.id}
                className={`flex flex-col md:grid md:grid-cols-[140px_1fr_160px_120px_140px_140px] gap-2 md:gap-4 px-4 py-4 items-start md:items-center ${
                  index < earnings.transactions.length - 1
                    ? "border-b border-[#E2E8F0]"
                    : ""
                }`}
              >
                <p className="text-sm text-[#0F172A]">{formatDate(t.created_at)}</p>
                <p className="text-sm text-[#0F172A]">{t.patient_name}</p>
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
              </div>
            ))}
          </div>

          {earnings.total_pages > 1 && (
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
                Page {earnings.page} of {earnings.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= earnings.total_pages}
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
