"use client";

import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CallMedia } from "@/types/consultation";

interface CallControlsProps {
  isMuted: boolean;
  isCameraOff: boolean;
  callMedia: CallMedia;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onHangUp: () => void;
}

export function CallControls({
  isMuted,
  isCameraOff,
  callMedia,
  onToggleMute,
  onToggleCamera,
  onHangUp,
}: CallControlsProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      {/* Mute / Unmute */}
      <Button
        variant={isMuted ? "secondary" : "outline"}
        size="icon"
        onClick={onToggleMute}
        aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
        className="min-h-[44px] min-w-[44px]"
      >
        {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
      </Button>

      {/* Camera toggle — only shown for video calls */}
      {callMedia === "video" && (
        <Button
          variant={isCameraOff ? "secondary" : "outline"}
          size="icon"
          onClick={onToggleCamera}
          aria-label={isCameraOff ? "Turn camera on" : "Turn camera off"}
          className="min-h-[44px] min-w-[44px]"
        >
          {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
        </Button>
      )}

      {/* Hang up */}
      <Button
        variant="destructive"
        size="icon"
        onClick={onHangUp}
        aria-label="End call"
        className="min-h-[44px] min-w-[44px] bg-[#EF4444] hover:bg-[#DC2626]"
      >
        <PhoneOff size={20} />
      </Button>
    </div>
  );
}
