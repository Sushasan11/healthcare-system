"use client";
import { useRef, useCallback, useState, useEffect } from "react";
import type { WsEnvelope, CallState, CallMedia } from "@/types/consultation";

interface UseWebRTCOptions {
  role: "doctor" | "patient";
  sendMessage: (msg: WsEnvelope) => void;
}

interface UseWebRTCReturn {
  callState: CallState;
  callMedia: CallMedia;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  initiateCall: (media: "audio" | "video") => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  escalateToVideo: () => Promise<void>;
  handleSignalingMessage: (msg: WsEnvelope) => Promise<void>;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // TURN server credentials should come from env/config in production
  // { urls: "turn:your-coturn-host:3478", username: "user", credential: "pass" }
];

export function useWebRTC({ role, sendMessage }: UseWebRTCOptions): UseWebRTCReturn {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [callState, setCallState] = useState<CallState>("idle");
  const [callMedia, setCallMedia] = useState<CallMedia>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  // Perfect negotiation state
  const makingOffer = useRef(false);
  const ignoreOffer = useRef(false);
  const isSettingRemoteAnswerPending = useRef(false);
  const pendingMedia = useRef<"audio" | "video" | null>(null);

  const isPolite = role === "patient"; // patient defers, doctor wins collisions

  const createPeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    // Remote stream setup
    const remote = new MediaStream();
    setRemoteStream(remote);

    pc.ontrack = ({ track }) => {
      remote.addTrack(track);
      // Update callMedia if video track arrives
      if (track.kind === "video") {
        setCallMedia("video");
      }
    };

    // Perfect negotiation: onnegotiationneeded
    pc.onnegotiationneeded = async () => {
      try {
        makingOffer.current = true;
        await pc.setLocalDescription(); // auto-generates offer
        sendMessage({ type: "call_offer", sdp: pc.localDescription! });
      } catch (err) {
        console.error("Negotiation error:", err);
      } finally {
        makingOffer.current = false;
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        sendMessage({ type: "ice_candidate", candidate: candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        // Don't auto-cleanup — let the user or timer handle it
      }
    };

    return pc;
  }, [sendMessage]);

  const getMediaStream = useCallback(async (media: "audio" | "video") => {
    const constraints: MediaStreamConstraints = {
      audio: true,
      video: media === "video",
    };
    return navigator.mediaDevices.getUserMedia(constraints);
  }, []);

  // Doctor initiates a call
  const initiateCall = useCallback(async (media: "audio" | "video") => {
    if (role !== "doctor") return;

    const pc = createPeerConnection();
    const stream = await getMediaStream(media);
    setLocalStream(stream);
    setCallMedia(media);

    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }

    setCallState("ringing");
    sendMessage({ type: "call_initiated", media, initiator_id: 0 }); // server fills initiator_id
  }, [role, createPeerConnection, getMediaStream, sendMessage]);

  // Patient accepts incoming call
  const acceptCall = useCallback(async () => {
    const pc = createPeerConnection();
    const media = pendingMedia.current || "audio";
    const stream = await getMediaStream(media);
    setLocalStream(stream);
    setCallMedia(media);

    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }

    setCallState("active");
    sendMessage({ type: "call_accepted" });
  }, [createPeerConnection, getMediaStream, sendMessage]);

  const declineCall = useCallback(() => {
    setCallState("idle");
    setCallMedia(null);
    pendingMedia.current = null;
    sendMessage({ type: "call_declined" });
  }, [sendMessage]);

  const endCall = useCallback(() => {
    // Stop all local tracks
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    setRemoteStream(null);

    // Close peer connection
    pcRef.current?.close();
    pcRef.current = null;

    setCallState("idle");
    setCallMedia(null);
    setIsMuted(false);
    setIsCameraOff(false);

    sendMessage({ type: "call_ended" });
  }, [localStream, sendMessage]);

  const toggleMute = useCallback(() => {
    if (!localStream) return;
    const audioTracks = localStream.getAudioTracks();
    audioTracks.forEach((t) => { t.enabled = !t.enabled; });
    setIsMuted((prev) => !prev);
  }, [localStream]);

  const toggleCamera = useCallback(() => {
    if (!localStream) return;
    const videoTracks = localStream.getVideoTracks();
    videoTracks.forEach((t) => { t.enabled = !t.enabled; });
    setIsCameraOff((prev) => !prev);
  }, [localStream]);

  // Escalate from audio to video (doctor only)
  const escalateToVideo = useCallback(async () => {
    if (!pcRef.current || !localStream) return;
    const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
    for (const track of videoStream.getVideoTracks()) {
      pcRef.current.addTrack(track, localStream);
      localStream.addTrack(track); // so localStream ref includes video
    }
    setCallMedia("video");
    setIsCameraOff(false);
    // onnegotiationneeded fires automatically -> sends new offer
  }, [localStream]);

  // Handle incoming signaling messages from WebSocket
  const handleSignalingMessage = useCallback(async (msg: WsEnvelope) => {
    switch (msg.type) {
      case "call_initiated": {
        pendingMedia.current = msg.media;
        setCallMedia(msg.media);
        setCallState("ringing");
        break;
      }
      case "call_accepted": {
        setCallState("active");
        break;
      }
      case "call_declined": {
        localStream?.getTracks().forEach((t) => t.stop());
        setLocalStream(null);
        pcRef.current?.close();
        pcRef.current = null;
        setCallState("idle");
        setCallMedia(null);
        break;
      }
      case "call_ended": {
        localStream?.getTracks().forEach((t) => t.stop());
        setLocalStream(null);
        setRemoteStream(null);
        pcRef.current?.close();
        pcRef.current = null;
        setCallState("idle");
        setCallMedia(null);
        setIsMuted(false);
        setIsCameraOff(false);
        break;
      }
      case "call_offer": {
        const pc = createPeerConnection();
        const offerCollision = msg.type === "call_offer" && (makingOffer.current || pc.signalingState !== "stable");
        ignoreOffer.current = !isPolite && offerCollision;
        if (ignoreOffer.current) break;

        await pc.setRemoteDescription(msg.sdp);
        if (msg.sdp.type === "offer") {
          await pc.setLocalDescription();
          sendMessage({ type: "call_answer", sdp: pc.localDescription! });
        }
        break;
      }
      case "call_answer": {
        const pc = pcRef.current;
        if (!pc) break;
        await pc.setRemoteDescription(msg.sdp);
        break;
      }
      case "ice_candidate": {
        const pc = pcRef.current;
        if (!pc) break;
        try {
          await pc.addIceCandidate(msg.candidate);
        } catch (err) {
          if (!ignoreOffer.current) console.error("ICE candidate error:", err);
        }
        break;
      }
    }
  }, [createPeerConnection, isPolite, localStream, sendMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      localStream?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
    };
  }, [localStream]);

  // Suppress unused variable warning for isSettingRemoteAnswerPending
  void isSettingRemoteAnswerPending;

  return {
    callState, callMedia, localStream, remoteStream,
    isMuted, isCameraOff,
    initiateCall, acceptCall, declineCall, endCall,
    toggleMute, toggleCamera, escalateToVideo,
    handleSignalingMessage,
  };
}
