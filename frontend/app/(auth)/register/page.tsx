"use client";

import Link from "next/link";
import { Heart, Activity, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const roles = [
  {
    id: "patient",
    icon: Heart,
    title: "Patient",
    description: "Book appointments and consult with doctors",
    href: "/register/patient",
    label: "Register as Patient",
  },
  {
    id: "doctor",
    icon: Activity,
    title: "Doctor",
    description: "Manage your practice and see patients",
    href: "/register/doctor",
    label: "Register as Doctor",
  },
  {
    id: "pharmacist",
    icon: Package,
    title: "Pharmacist",
    description: "Manage prescriptions and inventory",
    href: "/register/pharmacist",
    label: "Register as Pharmacist",
  },
];

export default function RegisterPage() {
  return (
    <div className="w-full max-w-[860px] px-4">
      {/* Logo */}
      <div className="text-center mb-8">
        <span className="text-xl font-semibold text-[#0F172A]">
          HealthConnect
        </span>
      </div>

      <div className="text-center mb-8">
        <h1 className="text-[28px] font-semibold leading-[1.1] text-[#0F172A]">
          Create your account
        </h1>
        <p className="text-[14px] text-[#64748B] mt-2">
          Choose your role to get started
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[800px] mx-auto">
        {roles.map((role) => {
          const Icon = role.icon;
          return (
            <Card
              key={role.id}
              className="flex flex-col items-center text-center p-6 hover:shadow-md transition-shadow"
            >
              <CardContent className="p-0 flex flex-col items-center gap-4 w-full">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-sky-50">
                  <Icon className="h-6 w-6 text-[#0EA5E9]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[#0F172A]">
                    {role.title}
                  </h2>
                  <p className="text-[13px] text-[#64748B] mt-1">
                    {role.description}
                  </p>
                </div>
                <Link href={role.href} className="w-full">
                  <Button className="w-full bg-[#0EA5E9] hover:bg-sky-600 text-white">
                    {role.label}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 text-center">
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
    </div>
  );
}
