"use client";

import { Phone, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface CallModalProps {
  isOpen: boolean;
  callerName: string;
  callMedia: "audio" | "video";
  onAccept: () => void;
  onDecline: () => void;
}

export function CallModal({
  isOpen,
  callerName,
  callMedia,
  onAccept,
  onDecline,
}: CallModalProps) {
  return (
    <Dialog open={isOpen}>
      <DialogContent
        showCloseButton={false}
        className="w-80 max-w-[320px] rounded-xl p-8 text-center"
      >
        {/* Pulsing ring animation around avatar initials */}
        <div className="flex justify-center mb-4">
          <div className="relative flex items-center justify-center">
            {/* Outer pulsing rings */}
            <span
              className="absolute inline-block rounded-full border-2 border-[#0EA5E9] opacity-40"
              style={{
                width: "72px",
                height: "72px",
                animation: "call-ring 1.8s ease-out 0s infinite",
              }}
            />
            <span
              className="absolute inline-block rounded-full border-2 border-[#0EA5E9] opacity-25"
              style={{
                width: "88px",
                height: "88px",
                animation: "call-ring 1.8s ease-out 0.4s infinite",
              }}
            />
            {/* Avatar */}
            <div
              className="relative flex items-center justify-center rounded-full bg-[#0EA5E9] text-white font-semibold text-lg z-10"
              style={{ width: "56px", height: "56px" }}
            >
              {callerName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        <style>{`
          @keyframes call-ring {
            0% { transform: scale(1); opacity: 0.4; }
            80% { transform: scale(1.4); opacity: 0; }
            100% { transform: scale(1.4); opacity: 0; }
          }
        `}</style>

        {/* Caller name */}
        <h2 className="text-[20px] font-semibold text-[#0F172A] leading-[1.2] mb-2">
          {callerName} is calling...
        </h2>

        {/* Call type badge */}
        <div className="flex justify-center mb-6">
          <Badge variant="secondary">
            {callMedia === "video" ? "Video Call" : "Audio Call"}
          </Badge>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-4">
          <Button
            variant="default"
            className="w-full bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
            onClick={onAccept}
          >
            <Phone size={16} className="mr-2" />
            Accept
          </Button>
          <Button
            variant="destructive"
            className="w-full"
            onClick={onDecline}
          >
            <PhoneOff size={16} className="mr-2" />
            Decline
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
