"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Paperclip, SendHorizontal, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import type { MessageResponse } from "@/types/consultation";

const BLOCKED_EXTENSIONS = new Set([".exe", ".sh", ".bat", ".ps1", ".py", ".js", ".dll", ".msi"]);
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

interface ChatPanelProps {
  messages: MessageResponse[];
  currentUserId: number;
  participantName: string;
  onSendMessage: (content: string) => void;
  onSendFile: (file: File) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onMessageRead: (messageId: number) => void;
  typingUser: string | null;
  isLoading: boolean;
}

export function ChatPanel({
  messages,
  currentUserId,
  participantName,
  onSendMessage,
  onSendFile,
  onTypingStart,
  onTypingStop,
  onMessageRead,
  typingUser,
  isLoading,
}: ChatPanelProps) {
  const [text, setText] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isTypingRef = useRef(false);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark last unread message from the other party when bottom is visible
  useEffect(() => {
    const unread = messages.filter(
      (m) => m.sender_id !== currentUserId && m.read_at === null
    );
    if (unread.length === 0) return;
    const lastUnread = unread[unread.length - 1];
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onMessageRead(lastUnread.id);
        }
      },
      { threshold: 0.1 }
    );
    const sentinel = bottomRef.current;
    if (sentinel) observer.observe(sentinel);
    return () => observer.disconnect();
  }, [messages, currentUserId, onMessageRead]);

  const handleSend = useCallback(() => {
    if (pendingFile) {
      onSendFile(pendingFile);
      setPendingFile(null);
      setFileError(null);
    }
    if (text.trim()) {
      onSendMessage(text.trim());
      setText("");
    }
    clearTimeout(typingStopTimerRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingStop();
    }
  }, [text, pendingFile, onSendMessage, onSendFile, onTypingStop]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        onTypingStart();
      }
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = setTimeout(() => {
        isTypingRef.current = false;
        onTypingStop();
      }, 2000);

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, onTypingStart, onTypingStop]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const name = file.name.toLowerCase();
    const dotIndex = name.lastIndexOf(".");
    const ext = dotIndex >= 0 ? name.substring(dotIndex) : "";
    if (BLOCKED_EXTENSIONS.has(ext)) {
      setFileError("File type not allowed. Use images, PDFs, or documents.");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError("File too large. Maximum size is 25 MB.");
      e.target.value = "";
      return;
    }

    setFileError(null);
    setPendingFile(file);
    e.target.value = "";
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const canSend = text.trim().length > 0 || pendingFile !== null;

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-12 w-1/2 self-end" />
            <Skeleton className="h-12 w-2/3" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-[#64748B] text-center px-4">
            Send your first message to start the consultation.
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.sender_id === currentUserId}
              senderName={msg.sender_id === currentUserId ? "You" : participantName}
            />
          ))
        )}
        {typingUser && <TypingIndicator name={typingUser} isVisible />}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div
        className="border-t border-[#E2E8F0] px-4 py-3 flex flex-col gap-2 bg-white"
        style={{ minHeight: "64px" }}
      >
        {pendingFile && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] text-sm text-[#0F172A]">
            <Paperclip size={14} className="text-[#64748B] flex-shrink-0" />
            <span className="truncate flex-1">{pendingFile.name}</span>
            <span className="text-[12px] text-[#64748B] flex-shrink-0">
              {formatFileSize(pendingFile.size)}
            </span>
            <button
              type="button"
              onClick={() => setPendingFile(null)}
              className="text-[#64748B] hover:text-[#0F172A] flex-shrink-0"
              aria-label="Remove file"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {fileError && (
          <p className="text-[12px] text-red-500">{fileError}</p>
        )}

        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0 text-[#64748B] hover:text-[#0F172A] p-1 transition-colors"
            aria-label="Attach file"
          >
            <Paperclip size={20} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            aria-hidden="true"
          />

          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none min-h-[36px] max-h-[120px] py-2"
          />

          <Button
            type="button"
            size="icon"
            variant={canSend ? "default" : "ghost"}
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send message"
            className={canSend ? "bg-[#0EA5E9] hover:bg-[#0284C7] text-white flex-shrink-0" : "flex-shrink-0"}
          >
            <SendHorizontal size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}
