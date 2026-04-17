"use client";

import { Paperclip } from "lucide-react";
import { apiFetch } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif"]);

function getExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

interface FileAttachmentProps {
  fileUrl: string;
  fileName: string;
  isInMessage: boolean;
}

export function FileAttachment({ fileUrl, fileName, isInMessage }: FileAttachmentProps) {
  const ext = getExtension(fileName);
  const isImage = IMAGE_EXTENSIONS.has(ext);
  const fullUrl = `${API_BASE}${fileUrl}`;

  if (isImage) {
    return (
      <div className={isInMessage ? "mt-1" : ""}>
        <img
          src={fullUrl}
          alt={fileName}
          className="max-w-[240px] rounded-md object-cover"
          style={{ maxWidth: "240px" }}
        />
      </div>
    );
  }

  // Document file card
  return (
    <div className="flex items-center gap-2 p-2 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] mt-1">
      <Paperclip size={16} className="text-[#64748B] flex-shrink-0" />
      <span className="text-sm text-[#0F172A] truncate flex-1">{fileName}</span>
      <a
        href={fullUrl}
        download={fileName}
        onClick={async (e) => {
          e.preventDefault();
          try {
            const res = await apiFetch(fileUrl);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
          } catch {
            // fallback to direct navigation
            window.open(fullUrl, "_blank");
          }
        }}
        className="text-xs text-[#0EA5E9] hover:underline flex-shrink-0"
      >
        Download
      </a>
    </div>
  );
}
