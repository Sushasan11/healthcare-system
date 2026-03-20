"use client";

import { formatTime } from "@/hooks/useCallTimer";
import { Button } from "@/components/ui/button";

interface TimerBarProps {
  secondsRemaining: number;
  isWarning: boolean;
  isExpired: boolean;
  isDoctor: boolean;
  onExtend: () => void;
}

export function TimerBar({
  secondsRemaining,
  isWarning,
  isExpired,
  isDoctor,
  onExtend,
}: TimerBarProps) {
  const formatted = formatTime(secondsRemaining);

  if (isExpired) {
    return (
      <div
        className="w-full flex items-center justify-center px-4"
        style={{
          height: "40px",
          backgroundColor: "#FFFBEB",
        }}
      >
        <span className="text-sm font-normal text-[#F59E0B]">
          Session time expired
        </span>
      </div>
    );
  }

  if (isWarning) {
    return (
      <div
        className="w-full flex items-center justify-between px-4"
        style={{
          height: "40px",
          backgroundColor: "#FFFBEB",
        }}
      >
        <span className="text-sm font-normal text-[#F59E0B]">
          {formatted} remaining &mdash; Session ending soon
        </span>
        {isDoctor && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExtend}
            className="text-[#0EA5E9] border-[#0EA5E9] hover:bg-[#0EA5E9]/10 h-7 text-xs"
          >
            Extend 15 min
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className="w-full flex items-center justify-center px-4"
      style={{
        height: "40px",
        backgroundColor: "#F8FAFC",
      }}
    >
      <span className="text-sm font-normal text-[#64748B]">
        {formatted} remaining
      </span>
    </div>
  );
}
