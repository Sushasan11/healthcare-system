"use client";
import { useState, useEffect, useCallback, useRef } from "react";

const DEFAULT_DURATION_SEC = 30 * 60; // 30 minutes
const WARNING_THRESHOLD_SEC = 5 * 60;  // 5 minutes
const EXTENSION_SEC = 15 * 60;         // 15 minutes

interface UseCallTimerReturn {
  secondsRemaining: number;
  isWarning: boolean;
  isExpired: boolean;
  extend: () => void;
  start: () => void;
  stop: () => void;
}

export function useCallTimer(): UseCallTimerReturn {
  const [secondsRemaining, setSecondsRemaining] = useState(DEFAULT_DURATION_SEC);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const isWarning = secondsRemaining <= WARNING_THRESHOLD_SEC && secondsRemaining > 0;
  const isExpired = secondsRemaining <= 0;

  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 0) {
          clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const extend = useCallback(() => {
    setSecondsRemaining((prev) => prev + EXTENSION_SEC);
  }, []);

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
    clearInterval(intervalRef.current);
  }, []);

  return { secondsRemaining, isWarning, isExpired, extend, start, stop };
}

// Utility to format seconds as "MM:SS"
export function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
