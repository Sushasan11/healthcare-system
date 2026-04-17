"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DoctorListItem } from "./types";

interface DoctorCardProps {
  doctor: DoctorListItem;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function StarRating({
  rating,
  reviewCount,
}: {
  rating: number | null;
  reviewCount: number;
}) {
  const filled = Math.round(rating ?? 0);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={
            i < filled
              ? "size-4 fill-yellow-400 text-yellow-400"
              : "size-4 text-gray-300"
          }
        />
      ))}
      <span className="text-sm text-[#64748B] ml-1">({reviewCount} reviews)</span>
    </div>
  );
}

export default function DoctorCard({ doctor }: DoctorCardProps) {
  const fee = doctor.profile?.consultation_fee;
  const rating = doctor.profile?.rating ?? null;
  const reviewCount = doctor.profile?.review_count ?? 0;

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-col gap-3 pt-4 flex-1">
        {/* Avatar + Name row */}
        <div className="flex items-start gap-3">
          <Avatar className="size-16 shrink-0">
            {doctor.profile?.avatar_url ? (
              <AvatarImage
                src={doctor.profile.avatar_url}
                alt={doctor.full_name}
              />
            ) : null}
            <AvatarFallback className="text-base font-semibold">
              {getInitials(doctor.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1 min-w-0">
            <p className="text-base font-semibold text-[#0F172A] truncate">
              {doctor.full_name}
            </p>
            {doctor.specialty && (
              <Badge variant="secondary">{doctor.specialty}</Badge>
            )}
          </div>
        </div>

        {/* Star rating */}
        <StarRating rating={rating} reviewCount={reviewCount} />

        {/* Availability indicator */}
        <div className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-full bg-[#10B981] inline-block"
            aria-hidden="true"
          />
          <span className="text-sm text-[#64748B]">Available</span>
        </div>

        {/* Consultation fee */}
        {fee != null && (
          <p className="text-lg font-semibold text-[#0F172A]">
            ${Number(fee).toFixed(2)}
            <span className="text-sm font-normal text-[#64748B] ml-1">
              per consultation
            </span>
          </p>
        )}

        {/* Book Now button */}
        <Link href={`/patient/doctors/${doctor.id}`} className="mt-auto block">
          <Button className="w-full bg-[#0EA5E9] hover:bg-[#0EA5E9]/90 text-white">
            Book Now
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
