"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

interface ProfileData {
  id: number;
  email: string;
  full_name: string;
  role: string;
  account_status: string;
  date_of_birth?: string | null;
  gender?: string | null;
  phone?: string | null;
  allergies?: string | null;
  current_medications?: string | null;
  chronic_conditions?: string | null;
  blood_type?: string | null;
}

export default function PatientProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Edit form state
  const [allergies, setAllergies] = useState("");
  const [medications, setMedications] = useState("");
  const [conditions, setConditions] = useState("");
  const [bloodType, setBloodType] = useState("");

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await apiFetch("/me");
        if (res.ok) {
          const data: ProfileData = await res.json();
          setProfile(data);
          setAllergies(data.allergies ?? "");
          setMedications(data.current_medications ?? "");
          setConditions(data.chronic_conditions ?? "");
          setBloodType(data.blood_type ?? "");
        }
      } catch {
        setErrorMsg("Failed to load profile. Please refresh.");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  async function handleSave() {
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await apiFetch("/me/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allergies: allergies || null,
          current_medications: medications || null,
          chronic_conditions: conditions || null,
          blood_type: bloodType || null,
        }),
      });
      if (res.ok) {
        const updated: ProfileData = await res.json();
        setProfile(updated);
        setEditMode(false);
        setSuccessMsg("Profile updated successfully.");
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.detail ?? "Something went wrong. Please try again.");
      }
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setAllergies(profile?.allergies ?? "");
    setMedications(profile?.current_medications ?? "");
    setConditions(profile?.chronic_conditions ?? "");
    setBloodType(profile?.blood_type ?? "");
    setEditMode(false);
    setErrorMsg(null);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#0F172A] mb-6">
        Your Profile
      </h1>

      {successMsg && (
        <Alert className="mb-4 border-green-500 bg-green-50">
          <AlertDescription className="text-green-800">{successMsg}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Personal info (read-only) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[#0F172A]">
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#64748B]">
                Full Name
              </label>
              <p className="mt-0.5 text-sm text-[#0F172A]">
                {profile?.full_name ?? user?.full_name ?? "—"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-[#64748B]">
                Email
              </label>
              <p className="mt-0.5 text-sm text-[#0F172A]">
                {profile?.email ?? user?.email ?? "—"}
              </p>
            </div>
            {profile?.date_of_birth && (
              <div>
                <label className="text-sm font-medium text-[#64748B]">
                  Date of Birth
                </label>
                <p className="mt-0.5 text-sm text-[#0F172A]">
                  {profile.date_of_birth}
                </p>
              </div>
            )}
            {profile?.gender && (
              <div>
                <label className="text-sm font-medium text-[#64748B]">
                  Gender
                </label>
                <p className="mt-0.5 text-sm text-[#0F172A] capitalize">
                  {profile.gender}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Medical info (editable) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base font-semibold text-[#0F172A]">
                  Medical Information
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  PHI — Encrypted
                </Badge>
              </div>
              {!editMode && (
                <button
                  onClick={() => setEditMode(true)}
                  aria-label="Edit medical information"
                  className="text-[#64748B] hover:text-[#0F172A] transition-colors p-1 rounded"
                >
                  <Pencil className="size-4" />
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMsg && (
              <Alert variant="destructive">
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            {/* Allergies */}
            <div>
              <label
                htmlFor="allergies"
                className="text-sm font-medium text-[#64748B]"
              >
                Allergies
              </label>
              {editMode ? (
                <textarea
                  id="allergies"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="e.g. Penicillin, peanuts"
                  className="mt-1 w-full rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:ring-offset-1 resize-none"
                  rows={2}
                />
              ) : (
                <p className="mt-0.5 text-sm text-[#0F172A]">
                  {profile?.allergies ?? <span className="text-[#64748B]">Not specified</span>}
                </p>
              )}
            </div>

            {/* Current medications */}
            <div>
              <label
                htmlFor="current_medications"
                className="text-sm font-medium text-[#64748B]"
              >
                Current Medications
              </label>
              {editMode ? (
                <textarea
                  id="current_medications"
                  value={medications}
                  onChange={(e) => setMedications(e.target.value)}
                  placeholder="e.g. Metformin 500mg, Lisinopril 10mg"
                  className="mt-1 w-full rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:ring-offset-1 resize-none"
                  rows={2}
                />
              ) : (
                <p className="mt-0.5 text-sm text-[#0F172A]">
                  {profile?.current_medications ?? <span className="text-[#64748B]">Not specified</span>}
                </p>
              )}
            </div>

            {/* Chronic conditions */}
            <div>
              <label
                htmlFor="chronic_conditions"
                className="text-sm font-medium text-[#64748B]"
              >
                Chronic Conditions
              </label>
              {editMode ? (
                <textarea
                  id="chronic_conditions"
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                  placeholder="e.g. Type 2 Diabetes, Hypertension"
                  className="mt-1 w-full rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:ring-offset-1 resize-none"
                  rows={2}
                />
              ) : (
                <p className="mt-0.5 text-sm text-[#0F172A]">
                  {profile?.chronic_conditions ?? <span className="text-[#64748B]">Not specified</span>}
                </p>
              )}
            </div>

            {/* Blood type */}
            <div>
              <label
                htmlFor="blood_type"
                className="text-sm font-medium text-[#64748B]"
              >
                Blood Type
              </label>
              {editMode ? (
                <select
                  id="blood_type"
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:ring-offset-1"
                >
                  <option value="">Select blood type</option>
                  {BLOOD_TYPES.map((bt) => (
                    <option key={bt} value={bt}>
                      {bt}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-0.5 text-sm text-[#0F172A]">
                  {profile?.blood_type ?? <span className="text-[#64748B]">Not specified</span>}
                </p>
              )}
            </div>

            {/* Edit mode actions */}
            {editMode && (
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-[#0EA5E9] text-white hover:bg-[#0284C7]"
                >
                  {saving ? "Saving..." : "Save changes"}
                </Button>
                <Button variant="outline" onClick={handleCancel} disabled={saving}>
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
