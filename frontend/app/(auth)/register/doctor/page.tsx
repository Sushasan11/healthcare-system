"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";

function getPasswordStrength(password: string): number {
  if (password.length === 0) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

const strengthColors = [
  "bg-gray-200",
  "bg-red-500",
  "bg-orange-400",
  "bg-yellow-400",
  "bg-green-500",
];
const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];

function PasswordStrengthBar({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  return (
    <div className="mt-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded transition-colors ${
              password.length > 0 && strength >= i
                ? strengthColors[i]
                : "bg-gray-200"
            }`}
          />
        ))}
      </div>
      {password.length > 0 && (
        <p className="text-xs text-[#64748B] mt-0.5">{strengthLabels[strength]}</p>
      )}
    </div>
  );
}

function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password))
    return "Password must contain at least one uppercase letter.";
  if (!/[a-z]/.test(password))
    return "Password must contain at least one lowercase letter.";
  if (!/[0-9]/.test(password))
    return "Password must contain at least one number.";
  if (!/[^A-Za-z0-9]/.test(password))
    return "Password must contain at least one special character.";
  return null;
}

const SPECIALTIES = [
  "General Practice",
  "Cardiology",
  "Dermatology",
  "Endocrinology",
  "Gastroenterology",
  "Neurology",
  "Obstetrics & Gynecology",
  "Oncology",
  "Ophthalmology",
  "Orthopedics",
  "Pediatrics",
  "Psychiatry",
  "Pulmonology",
  "Radiology",
  "Surgery",
  "Urology",
  "Other",
];

export default function DoctorRegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    specialty: "",
    medical_license_number: "",
    years_of_experience: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === "password" && value) {
      const err = validatePassword(value);
      if (err) setFieldErrors((prev) => ({ ...prev, password: err }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const passwordErr = validatePassword(formData.password);
    if (passwordErr) {
      setFieldErrors((prev) => ({ ...prev, password: passwordErr }));
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, string | number> = {
        full_name: formData.full_name,
        email: formData.email,
        password: formData.password,
        specialty: formData.specialty,
        medical_license_number: formData.medical_license_number,
        years_of_experience: Number(formData.years_of_experience),
      };
      if (formData.phone) payload.phone = formData.phone;

      const res = await apiFetch("/auth/register/doctor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 201) {
        router.push(
          `/verify-email?email=${encodeURIComponent(formData.email)}`
        );
        return;
      }

      if (res.status === 409) {
        setFormError(
          "An account with this email already exists. Sign in instead?"
        );
        return;
      }

      const data = await res.json().catch(() => null);
      if (res.status === 422 && data?.detail) {
        const details = Array.isArray(data.detail)
          ? data.detail.map((d: { msg: string }) => d.msg).join("; ")
          : data.detail;
        setFormError(details);
        return;
      }

      setFormError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[520px]">
      <div className="text-center mb-6">
        <span className="text-xl font-semibold text-[#0F172A]">
          HealthConnect
        </span>
      </div>

      <Card className="w-full p-8">
        <CardContent className="p-0">
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-[28px] font-semibold leading-[1.1] text-[#0F172A]">
              Create your account
            </h1>
            <Badge variant="secondary">Doctor</Badge>
          </div>

          {formError && (
            <Alert variant="destructive" className="mb-4" role="alert">
              <AlertDescription>
                {formError ===
                "An account with this email already exists. Sign in instead?" ? (
                  <>
                    An account with this email already exists.{" "}
                    <Link href="/login" className="underline text-[#0EA5E9]">
                      Sign in instead?
                    </Link>
                  </>
                ) : (
                  formError
                )}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-1">
              <label
                htmlFor="full_name"
                className="text-sm font-medium text-[#0F172A]"
              >
                Full name <span className="text-destructive">*</span>
              </label>
              <Input
                id="full_name"
                name="full_name"
                type="text"
                value={formData.full_name}
                onChange={handleChange}
                required
                className="focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:ring-offset-2"
              />
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label
                htmlFor="email"
                className="text-sm font-medium text-[#0F172A]"
              >
                Email <span className="text-destructive">*</span>
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
                className="focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:ring-offset-2"
              />
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label
                htmlFor="password"
                className="text-sm font-medium text-[#0F172A]"
              >
                Password <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                  autoComplete="new-password"
                  className="pr-10 focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:ring-offset-2"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9] rounded"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <PasswordStrengthBar password={formData.password} />
              {fieldErrors.password && (
                <p className="text-[12px] text-destructive">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <label
                htmlFor="phone"
                className="text-sm font-medium text-[#0F172A]"
              >
                Phone
              </label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                className="focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:ring-offset-2"
              />
            </div>

            {/* Specialty */}
            <div className="space-y-1">
              <label
                htmlFor="specialty"
                className="text-sm font-medium text-[#0F172A]"
              >
                Specialty <span className="text-destructive">*</span>
              </label>
              <select
                id="specialty"
                name="specialty"
                value={formData.specialty}
                onChange={handleChange}
                required
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:ring-offset-2"
              >
                <option value="">Select a specialty</option>
                {SPECIALTIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Medical License Number */}
            <div className="space-y-1">
              <label
                htmlFor="medical_license_number"
                className="text-sm font-medium text-[#0F172A]"
              >
                Medical license number <span className="text-destructive">*</span>
              </label>
              <Input
                id="medical_license_number"
                name="medical_license_number"
                type="text"
                value={formData.medical_license_number}
                onChange={handleChange}
                required
                className="focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:ring-offset-2"
              />
            </div>

            {/* Years of Experience */}
            <div className="space-y-1">
              <label
                htmlFor="years_of_experience"
                className="text-sm font-medium text-[#0F172A]"
              >
                Years of experience <span className="text-destructive">*</span>
              </label>
              <Input
                id="years_of_experience"
                name="years_of_experience"
                type="number"
                min={0}
                value={formData.years_of_experience}
                onChange={handleChange}
                required
                className="focus-visible:ring-2 focus-visible:ring-[#0EA5E9] focus-visible:ring-offset-2"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0EA5E9] hover:bg-sky-600 text-white h-9 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <div className="mt-4 border-t border-[#E2E8F0] pt-4 text-center">
            <span className="text-[14px] text-[#64748B]">
              Already have an account?{" "}
            </span>
            <Link
              href="/login"
              className="text-[14px] text-[#0EA5E9] hover:underline"
            >
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
