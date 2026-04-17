"use client";

import { useEffect, useRef } from "react";

interface VideoPanelProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callControls: React.ReactNode;
}

export function VideoPanel({ localStream, remoteStream, callControls }: VideoPanelProps) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-black relative">
      {/* Remote video (full area) */}
      <div className="flex-1 relative flex items-center justify-center">
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-white text-sm">Connecting...</div>
        )}

        {/* Local video PiP (bottom-right corner) */}
        {localStream && (
          <div className="absolute bottom-4 right-4 w-40 rounded-lg overflow-hidden border-2 border-white/50 shadow-lg">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full"
            />
          </div>
        )}
      </div>

      {/* Call controls bar */}
      <div
        className="flex items-center justify-center bg-black/80 px-4"
        style={{ height: "44px" }}
      >
        {callControls}
      </div>
    </div>
  );
}
