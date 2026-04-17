"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Phone, Video, PhoneOff, MessageSquare, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import {
  requestNotificationPermission,
  notifyNewMessage,
} from "@/lib/notifications";
import { useConsultationSocket } from "@/hooks/useConsultationSocket";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useCallTimer } from "@/hooks/useCallTimer";
import { TimerBar } from "./TimerBar";
import { ReconnectingBanner } from "./ReconnectingBanner";
import { PresenceIndicator } from "./PresenceIndicator";
import { ChatPanel } from "./ChatPanel";
import { VideoPanel } from "./VideoPanel";
import { CallControls } from "./CallControls";
import { CallModal } from "./CallModal";
import { PrescriptionForm } from "@/components/prescription/PrescriptionForm";
import type {
  ConsultationResponse,
  MessageResponse,
  WsEnvelope,
} from "@/types/consultation";

interface ConsultationRoomProps {
  consultationId: number;
}

const SIGNALING_TYPES = new Set([
  "call_initiated",
  "call_accepted",
  "call_declined",
  "call_ended",
  "call_offer",
  "call_answer",
  "ice_candidate",
]);

export default function ConsultationRoom({ consultationId }: ConsultationRoomProps) {
  const { user } = useAuth();
  const router = useRouter();
  const role = (user?.role ?? "patient") as "doctor" | "patient";

  const [consultation, setConsultation] = useState<ConsultationResponse | null>(null);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [presenceStatus, setPresenceStatus] = useState<
    Record<number, "online" | "offline" | "reconnecting">
  >({});
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [otherPartyName, setOtherPartyName] = useState("");
  const [reconnectCountdown, setReconnectCountdown] = useState(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [isConsultationEnded, setIsConsultationEnded] = useState(false);

  const timer = useCallTimer();

  // Use a ref to hold WebRTC handler so we can pass it to onMessage without
  // creating a circular dependency between the two hooks.
  const webrtcHandlerRef = useRef<((msg: WsEnvelope) => Promise<void>) | null>(null);

  // Use a ref for otherPartyName to avoid stale closure in onMessage
  const otherPartyNameRef = useRef(otherPartyName);
  useEffect(() => {
    otherPartyNameRef.current = otherPartyName;
  }, [otherPartyName]);

  const onMessage = useCallback(
    (msg: WsEnvelope) => {
      // Forward signaling messages to WebRTC handler
      if (SIGNALING_TYPES.has(msg.type)) {
        webrtcHandlerRef.current?.(msg);
        // Also process call state changes below if needed
      }

      switch (msg.type) {
        case "chat_message": {
          if (msg.id !== undefined && msg.sender_id !== undefined) {
            const newMsg: MessageResponse = {
              id: msg.id,
              consultation_id: consultationId,
              sender_id: msg.sender_id,
              content: msg.content,
              file_url: msg.file_url ?? null,
              file_name: msg.file_name ?? null,
              created_at: msg.timestamp ?? new Date().toISOString(),
              delivered_at: null,
              read_at: null,
            };
            setMessages((prev) => [...prev, newMsg]);
            if (msg.sender_id !== user?.id) {
              notifyNewMessage(otherPartyNameRef.current || "Someone");
            }
          }
          break;
        }
        case "message_delivered": {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.message_id
                ? { ...m, delivered_at: new Date().toISOString() }
                : m
            )
          );
          break;
        }
        case "message_read": {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.message_id
                ? { ...m, read_at: new Date().toISOString() }
                : m
            )
          );
          break;
        }
        case "typing_start": {
          if (msg.user_id !== user?.id) {
            setTypingUser(otherPartyNameRef.current || "Someone");
          }
          break;
        }
        case "typing_stop": {
          if (msg.user_id !== user?.id) {
            setTypingUser(null);
          }
          break;
        }
        case "presence": {
          setPresenceStatus((prev) => ({ ...prev, [msg.user_id]: msg.status }));
          if (msg.user_id !== user?.id) {
            if (msg.status === "offline") {
              setReconnectCountdown(300);
              if (reconnectTimerRef.current) clearInterval(reconnectTimerRef.current);
              reconnectTimerRef.current = setInterval(() => {
                setReconnectCountdown((prev) => {
                  if (prev <= 1) {
                    clearInterval(reconnectTimerRef.current!);
                    reconnectTimerRef.current = null;
                    return 0;
                  }
                  return prev - 1;
                });
              }, 1000);
            } else if (msg.status === "online") {
              if (reconnectTimerRef.current) {
                clearInterval(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
              }
              setReconnectCountdown(0);
            }
          }
          break;
        }
        case "consultation_ended": {
          setIsConsultationEnded(true);
          break;
        }
        default:
          break;
      }
    },
    [consultationId, user?.id]
  );

  const { sendMessage, status } = useConsultationSocket(consultationId, onMessage);

  const webrtc = useWebRTC({ role, sendMessage });

  // Wire WebRTC handler ref after webrtc is initialized
  useEffect(() => {
    webrtcHandlerRef.current = webrtc.handleSignalingMessage;
  }, [webrtc.handleSignalingMessage]);

  // Load consultation data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [consultRes, messagesRes] = await Promise.all([
          apiFetch(`/consultations/${consultationId}`),
          apiFetch(`/consultations/${consultationId}/messages`),
        ]);

        if (consultRes.ok) {
          const data: ConsultationResponse = await consultRes.json();
          setConsultation(data);
          const name =
            role === "doctor"
              ? (data.patient_name ?? "Patient")
              : (data.doctor_name ?? "Doctor");
          setOtherPartyName(name);
          otherPartyNameRef.current = name;
        }

        if (messagesRes.ok) {
          const msgs: MessageResponse[] = await messagesRes.json();
          setMessages(msgs);
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
    requestNotificationPermission();
    timer.start();

    return () => {
      if (reconnectTimerRef.current) {
        clearInterval(reconnectTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId]);

  const handleSendMessage = useCallback(
    (content: string) => {
      if (!user) return;
      const optimistic: MessageResponse = {
        id: Date.now(),
        consultation_id: consultationId,
        sender_id: user.id,
        content,
        file_url: null,
        file_name: null,
        created_at: new Date().toISOString(),
        delivered_at: null,
        read_at: null,
      };
      setMessages((prev) => [...prev, optimistic]);
      sendMessage({ type: "chat_message", content });
    },
    [user, consultationId, sendMessage]
  );

  const handleSendFile = useCallback(
    async (file: File) => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await apiFetch(`/consultations/${consultationId}/files`, {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          sendMessage({
            type: "chat_message",
            content: "",
            file_url: data.file_url,
            file_name: file.name,
          });
        }
      } catch {
        // File upload failed silently
      }
    },
    [consultationId, sendMessage]
  );

  const handleTypingStart = useCallback(() => {
    sendMessage({ type: "typing_start", user_id: user?.id ?? 0 });
  }, [sendMessage, user?.id]);

  const handleTypingStop = useCallback(() => {
    sendMessage({ type: "typing_stop", user_id: user?.id ?? 0 });
  }, [sendMessage, user?.id]);

  const handleMessageRead = useCallback(
    (messageId: number) => {
      sendMessage({ type: "message_read", message_id: messageId });
    },
    [sendMessage]
  );

  const handleEndConsultation = async () => {
    try {
      await apiFetch(`/consultations/${consultationId}/end`, { method: "POST" });
      sendMessage({ type: "consultation_ended" });
      router.push("/doctor/appointments");
    } catch {
      // Error handling
    }
    setShowEndDialog(false);
  };

  const otherPartyPresence: "online" | "offline" | "reconnecting" = (() => {
    const otherEntry = Object.entries(presenceStatus).find(
      ([uid]) => Number(uid) !== user?.id
    );
    return (otherEntry?.[1] as "online" | "offline" | "reconnecting") ?? "online";
  })();

  const isCallActive = webrtc.callState === "active";
  const isRinging = webrtc.callState === "ringing";

  if (isConsultationEnded) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <h2 className="text-[20px] font-semibold text-[#0F172A]">Consultation ended</h2>
        <p className="text-sm text-[#64748B]">The consultation has been completed.</p>
        <Button
          onClick={() =>
            router.push(
              role === "doctor" ? "/doctor/appointments" : "/patient/appointments"
            )
          }
        >
          Back to Appointments
        </Button>
      </div>
    );
  }

  void status;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Timer bar */}
      <TimerBar
        secondsRemaining={timer.secondsRemaining}
        isWarning={timer.isWarning}
        isExpired={timer.isExpired}
        isDoctor={role === "doctor"}
        onExtend={timer.extend}
      />

      {/* Reconnecting banner */}
      <ReconnectingBanner
        name={otherPartyName}
        secondsRemaining={reconnectCountdown}
        isVisible={reconnectCountdown > 0}
      />

      {isCallActive ? (
        /* Call active layout: video + collapsible chat side panel */
        <div className="flex flex-1 min-h-0 relative">
          <div className="flex-1 min-w-0">
            <VideoPanel
              localStream={webrtc.localStream}
              remoteStream={webrtc.remoteStream}
              callControls={
                <CallControls
                  isMuted={webrtc.isMuted}
                  isCameraOff={webrtc.isCameraOff}
                  callMedia={webrtc.callMedia}
                  onToggleMute={webrtc.toggleMute}
                  onToggleCamera={webrtc.toggleCamera}
                  onHangUp={webrtc.endCall}
                />
              }
            />
          </div>

          {isChatVisible ? (
            <div
              className="flex flex-col border-l border-[#E2E8F0] bg-white relative"
              style={{ width: "320px" }}
            >
              <button
                type="button"
                onClick={() => setIsChatVisible(false)}
                className="absolute -left-4 top-4 bg-white border border-[#E2E8F0] rounded-full p-1 shadow-sm z-10"
                aria-label="Hide chat"
              >
                <MessageSquare size={16} className="text-[#64748B]" />
              </button>
              <ChatPanel
                messages={messages}
                currentUserId={user?.id ?? 0}
                participantName={otherPartyName}
                onSendMessage={handleSendMessage}
                onSendFile={handleSendFile}
                onTypingStart={handleTypingStart}
                onTypingStop={handleTypingStop}
                onMessageRead={handleMessageRead}
                typingUser={typingUser}
                isLoading={isLoading}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsChatVisible(true)}
              className="absolute right-4 top-4 bg-white border border-[#E2E8F0] rounded-full p-2 shadow-sm z-10"
              aria-label="Show chat"
            >
              <MessageSquare size={16} className="text-[#64748B]" />
            </button>
          )}
        </div>
      ) : (
        /* Chat-only layout */
        <div className="flex flex-col flex-1 min-h-0">
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 border-b border-[#E2E8F0] bg-white flex-shrink-0"
            style={{ minHeight: "48px" }}
          >
            <Avatar size="sm">
              <AvatarFallback>
                {otherPartyName.charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-[16px] font-semibold text-[#0F172A] truncate">
                {otherPartyName}
              </span>
              <PresenceIndicator status={otherPartyPresence} />
            </div>

            {role === "doctor" && !isRinging && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {user?.role === "doctor" && consultation?.status === "active" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowPrescriptionForm(true)}
                    className="gap-1 h-7 text-xs border-[#0EA5E9] text-[#0EA5E9] hover:bg-[#0EA5E9]/10"
                  >
                    <FileText size={14} />
                    Write Prescription
                  </Button>
                )}
                <Button
                  size="sm"
                  className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white h-7 text-xs"
                  onClick={() => webrtc.initiateCall("audio")}
                >
                  <Phone size={14} className="mr-1" />
                  Start Audio Call
                </Button>
                <Button
                  size="sm"
                  className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white h-7 text-xs"
                  onClick={() => webrtc.initiateCall("video")}
                >
                  <Video size={14} className="mr-1" />
                  Start Video Call
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs"
                  onClick={() => setShowEndDialog(true)}
                >
                  <PhoneOff size={14} className="mr-1" />
                  End Consultation
                </Button>
              </div>
            )}

            {role === "patient" && !isRinging && (
              <span className="text-xs text-[#64748B] flex-shrink-0">
                Ask your doctor to start a call
              </span>
            )}
          </div>

          {/* Chat panel */}
          <ChatPanel
            messages={messages}
            currentUserId={user?.id ?? 0}
            participantName={otherPartyName}
            onSendMessage={handleSendMessage}
            onSendFile={handleSendFile}
            onTypingStart={handleTypingStart}
            onTypingStop={handleTypingStop}
            onMessageRead={handleMessageRead}
            typingUser={typingUser}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Incoming call modal (patient only — shown when ringing) */}
      {role === "patient" && (
        <CallModal
          isOpen={isRinging}
          callerName={otherPartyName}
          callMedia={webrtc.callMedia ?? "audio"}
          onAccept={webrtc.acceptCall}
          onDecline={webrtc.declineCall}
        />
      )}

      {/* End Consultation confirmation dialog (doctor only) */}
      {role === "doctor" && (
        <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>End this consultation?</DialogTitle>
              <DialogDescription>
                The consultation will be marked as completed. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setShowEndDialog(false)}>
                Keep Consulting
              </Button>
              <Button variant="destructive" onClick={handleEndConsultation}>
                End Consultation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Write Prescription dialog (doctor only) */}
      {consultation && (
        <PrescriptionForm
          open={showPrescriptionForm}
          onOpenChange={setShowPrescriptionForm}
          consultationId={consultation.id}
          onSuccess={() => {
            setShowPrescriptionForm(false);
          }}
        />
      )}
    </div>
  );
}
