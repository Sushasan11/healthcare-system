"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Receipt } from "lucide-react";
import { toast } from "sonner";

interface AdminStats {
  total_users: number;
  by_role: Record<string, number>;
  pending_applications: number;
  commission_rate: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [rateInput, setRateInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await apiFetch("/admin/stats");
        if (res.ok) {
          const data: AdminStats = await res.json();
          setStats(data);
          setRateInput(String(data.commission_rate));
        }
      } catch {
        // Silent fail — show empty state
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  async function handleSaveCommission() {
    setSaving(true);
    try {
      const res = await apiFetch("/admin/settings/commission", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commission_rate: parseFloat(rateInput) }),
      });
      if (res.ok) {
        const data = await res.json();
        setStats(prev =>
          prev ? { ...prev, commission_rate: data.commission_rate } : prev
        );
        setEditMode(false);
        toast.success("Commission rate updated.");
      } else {
        toast.error("Failed to update commission rate. Please try again.");
      }
    } catch {
      toast.error("Failed to update commission rate. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#0F172A] mb-6">
        Admin Dashboard
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Users */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[#0F172A]">
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <p className="text-3xl font-semibold text-[#0EA5E9]">
                {stats?.total_users ?? 0}
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => router.push("/admin/users")}
            >
              View All Users
            </Button>
          </CardContent>
        </Card>

        {/* Card 2: Patients */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[#0F172A]">
              Patients
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <p className="text-3xl font-semibold text-[#0F172A]">
                {stats?.by_role?.patient ?? 0}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Doctors */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[#0F172A]">
              Doctors
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <p className="text-3xl font-semibold text-[#0F172A]">
                {stats?.by_role?.doctor ?? 0}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Card 4: Pharmacists */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[#0F172A]">
              Pharmacists
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <p className="text-3xl font-semibold text-[#0F172A]">
                {stats?.by_role?.pharmacist ?? 0}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Card 5: Pending Applications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[#0F172A]">
              Pending Applications
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <p className="text-3xl font-semibold text-[#0EA5E9]">
                {stats?.pending_applications ?? 0}
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => router.push("/admin/applications")}
            >
              Review Applications
            </Button>
          </CardContent>
        </Card>

        {/* Card: Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[#0F172A]">
              Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Receipt className="h-6 w-6 text-[#0EA5E9]" />
            <p className="text-sm text-[#64748B] mt-2">
              Platform payment ledger with commission totals.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => router.push("/admin/transactions")}
            >
              View Transactions
            </Button>
          </CardContent>
        </Card>

        {/* Card 6: Platform Settings (Commission) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[#0F172A]">
              Platform Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : !editMode ? (
              <>
                <p className="text-3xl font-semibold text-[#0EA5E9]">
                  {stats?.commission_rate ?? 0}%
                </p>
                <p className="text-sm text-[#64748B] mt-1">
                  {stats?.commission_rate ?? 0}% platform commission
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => setEditMode(true)}
                >
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
              </>
            ) : (
              <>
                <Label htmlFor="commission-rate">Commission Rate (%)</Label>
                <Input
                  id="commission-rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={rateInput}
                  onChange={e => setRateInput(e.target.value)}
                  className="mt-1"
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    className="bg-[#0EA5E9] text-white hover:bg-[#0284C7]"
                    disabled={saving}
                    onClick={handleSaveCommission}
                  >
                    {saving ? "Saving..." : "Save Rate"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRateInput(String(stats?.commission_rate ?? 0));
                      setEditMode(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
