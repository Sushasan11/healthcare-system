"use client";

import { formatTime } from "@/hooks/useCallTimer";

interface ReconnectingBannerProps {
  name: string;
  secondsRemaining: number;
  isVisible: boolean;
}

export function ReconnectingBanner({
  name,
  secondsRemaining,
  isVisible,
}: ReconnectingBannerProps) {
  if (!isVisible) return null;

  const formatted = formatTime(secondsRemaining);

  return (
    <div
      className="w-full flex items-center justify-center px-4"
      style={{
        height: "40px",
        backgroundColor: "#FFFBEB",
      }}
    >
      <span className="text-sm font-normal text-[#64748B]">
        {name} disconnected. Waiting to reconnect ({formatted} remaining)...
      </span>
    </div>
  );
}
