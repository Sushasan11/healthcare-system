"use client";

interface PresenceIndicatorProps {
  status: "online" | "offline" | "reconnecting";
  name?: string;
}

export function PresenceIndicator({ status, name }: PresenceIndicatorProps) {
  if (status === "online") {
    return (
      <span className="inline-flex items-center gap-1">
        <span
          className="inline-block w-2 h-2 rounded-full bg-[#0EA5E9]"
          aria-label="Online"
        />
        {name && <span className="text-[12px] text-[#64748B]">{name}</span>}
      </span>
    );
  }

  if (status === "offline") {
    return (
      <span className="inline-flex items-center gap-1">
        <span
          className="inline-block w-2 h-2 rounded-full border-2 border-[#E2E8F0] bg-transparent"
          aria-label="Offline"
        />
        <span className="text-[12px] text-[#64748B]">Offline</span>
      </span>
    );
  }

  // reconnecting
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block w-2 h-2 rounded-full bg-[#F59E0B]"
        aria-label="Reconnecting"
      />
      <span
        className="text-[12px] text-[#64748B]"
        style={{ animation: "pulse 1.5s ease-in-out infinite" }}
      >
        Reconnecting...
      </span>
    </span>
  );
}
