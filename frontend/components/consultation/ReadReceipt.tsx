"use client";

import { Check, CheckCheck } from "lucide-react";

interface ReadReceiptProps {
  status: "sent" | "delivered" | "read";
}

export function ReadReceipt({ status }: ReadReceiptProps) {
  if (status === "sent") {
    return (
      <Check
        size={14}
        className="text-[#64748B] ml-1 flex-shrink-0"
        aria-label="Sent"
      />
    );
  }

  if (status === "delivered") {
    return (
      <CheckCheck
        size={14}
        className="text-[#64748B] ml-1 flex-shrink-0"
        aria-label="Delivered"
      />
    );
  }

  // read
  return (
    <CheckCheck
      size={14}
      className="text-[#0EA5E9] ml-1 flex-shrink-0"
      aria-label="Read"
    />
  );
}
