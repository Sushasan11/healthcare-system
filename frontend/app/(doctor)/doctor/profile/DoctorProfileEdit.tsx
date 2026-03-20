"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

interface DoctorProfileData {
  bio: string | null;
  qualifications: string | null;
  consultation_fee: number | null;
  avatar_url: string | null;
}

export default function DoctorProfileEdit() {
  const { user } = useAuth();

  const [bio, setBio] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [consultationFee, setConsultationFee] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function loadProfile() {
      try {
        const res = await apiFetch(`/doctors/${user!.id}`);
        if (res.ok) {
          const data = await res.json();
          const p: DoctorProfileData | null = data.profile ?? null;
          if (p) {
            setBio(p.bio ?? "");
            setQualifications(p.qualifications ?? "");
            setConsultationFee(
              p.consultation_fee != null ? String(p.consultation_fee) : ""
            );
            setAvatarUrl(p.avatar_url ?? "");
          }
        }
      } catch {
        // Leave form empty for first-time setup
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, string | number | null> = {
        bio: bio || null,
        qualifications: qualifications || null,
        consultation_fee: consultationFee ? Number(consultationFee) : null,
        avatar_url: avatarUrl || null,
      };

      const res = await apiFetch("/doctors/me/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success("Profile saved successfully");
      } else {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        toast.error(err.detail ?? "Failed to save profile. Please try again.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-lg">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <div>
        <h1 className="text-xl font-semibold text-[#0F172A] mb-6">
          Edit Profile
        </h1>
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[#0F172A]">
              Professional Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-5">
              {/* Bio */}
              <div className="space-y-1.5">
                <Label htmlFor="bio" className="text-sm font-medium text-[#64748B]">
                  Bio
                </Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell patients about yourself..."
                  maxLength={500}
                  rows={4}
                />
                <p className="text-xs text-[#64748B] text-right">
                  {bio.length}/500
                </p>
              </div>

              {/* Qualifications */}
              <div className="space-y-1.5">
                <Label htmlFor="qualifications" className="text-sm font-medium text-[#64748B]">
                  Qualifications
                </Label>
                <Textarea
                  id="qualifications"
                  value={qualifications}
                  onChange={(e) => setQualifications(e.target.value)}
                  placeholder="List your qualifications, certifications..."
                  maxLength={1000}
                  rows={4}
                />
                <p className="text-xs text-[#64748B] text-right">
                  {qualifications.length}/1000
                </p>
              </div>

              {/* Consultation Fee */}
              <div className="space-y-1.5">
                <Label htmlFor="fee" className="text-sm font-medium text-[#64748B]">
                  Consultation Fee
                </Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B] text-sm pointer-events-none">
                    $
                  </span>
                  <Input
                    id="fee"
                    type="number"
                    step="0.01"
                    min="0"
                    value={consultationFee}
                    onChange={(e) => setConsultationFee(e.target.value)}
                    placeholder="0.00"
                    className="pl-6"
                  />
                </div>
              </div>

              {/* Avatar URL */}
              <div className="space-y-1.5">
                <Label htmlFor="avatar" className="text-sm font-medium text-[#64748B]">
                  Avatar URL
                </Label>
                <Input
                  id="avatar"
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/your-photo.jpg"
                />
              </div>

              <Button
                type="submit"
                disabled={saving}
                className="w-full bg-[#0EA5E9] text-white hover:bg-[#0EA5E9]/90"
              >
                {saving ? "Saving..." : "Save Profile"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
