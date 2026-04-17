// --- REST response types ---
export interface ConsultationResponse {
  id: number;
  appointment_id: number;
  status: "active" | "completed";
  started_at: string;
  ended_at: string | null;
  doctor_name: string | null;
  patient_name: string | null;
}

export interface MessageResponse {
  id: number;
  consultation_id: number;
  sender_id: number;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
}

// --- WebSocket envelope discriminated union ---
export type WsEnvelope =
  | { type: "chat_message"; id?: number; sender_id?: number; content: string; timestamp?: string; file_url?: string | null; file_name?: string | null }
  | { type: "message_delivered"; message_id: number }
  | { type: "message_read"; message_id: number }
  | { type: "typing_start"; user_id: number }
  | { type: "typing_stop"; user_id: number }
  | { type: "presence"; user_id: number; status: "online" | "offline" | "reconnecting" }
  | { type: "call_offer"; sdp: RTCSessionDescriptionInit }
  | { type: "call_answer"; sdp: RTCSessionDescriptionInit }
  | { type: "ice_candidate"; candidate: RTCIceCandidateInit }
  | { type: "call_initiated"; media: "audio" | "video"; initiator_id: number }
  | { type: "call_accepted" }
  | { type: "call_declined" }
  | { type: "call_ended" }
  | { type: "consultation_ended" }
  | { type: "error"; detail: string };

// --- Connection state ---
export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

// --- Call state ---
export type CallState = "idle" | "ringing" | "active" | "ended";
export type CallMedia = "audio" | "video" | null;
