"use client";

import { MessageResponse } from "@/types/consultation";
import { ReadReceipt } from "./ReadReceipt";
import { FileAttachment } from "./FileAttachment";

interface MessageBubbleProps {
  message: MessageResponse;
  isOwn: boolean;
  senderName: string;
}

function getReadStatus(message: MessageResponse): "sent" | "delivered" | "read" {
  if (message.read_at) return "read";
  if (message.delivered_at) return "delivered";
  return "sent";
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ message, isOwn, senderName }: MessageBubbleProps) {
  const readStatus = getReadStatus(message);

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-2`}>
      <div
        className={`max-w-[75%] rounded-lg p-2 ${
          isOwn
            ? "bg-white border border-[#E2E8F0]"
            : "bg-[#F8FAFC]"
        }`}
      >
        {!isOwn && (
          <p className="text-xs font-semibold text-[#0F172A] mb-1">{senderName}</p>
        )}

        {message.file_url && message.file_name && (
          <FileAttachment
            fileUrl={message.file_url}
            fileName={message.file_name}
            isInMessage={true}
          />
        )}

        {message.content && (
          <p className="text-sm text-[#0F172A] leading-relaxed">{message.content}</p>
        )}

        <div className={`flex items-center gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
          <span className="text-[12px] font-normal text-[#64748B] leading-none">
            {formatTimestamp(message.created_at)}
          </span>
          {isOwn && <ReadReceipt status={readStatus} />}
        </div>
      </div>
    </div>
  );
}
