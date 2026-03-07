import { useState, useRef, useCallback } from "react";

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number; // seconds elapsed
  blob: Blob | null;
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const start = useCallback(async () => {
    setBlob(null);
    chunks.current = [];
    setDuration(0);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorder.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };

    recorder.onstop = () => {
      const recorded = new Blob(chunks.current, { type: mimeType });
      setBlob(recorded);
      clearTimer();
      stopStream();
    };

    recorder.start(250); // collect every 250ms for smoother stop
    setIsRecording(true);
    setIsPaused(false);

    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  }, []);

  const stop = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.stop();
    }
    setIsRecording(false);
    setIsPaused(false);
    clearTimer();
  }, []);

  const pause = useCallback(() => {
    if (mediaRecorder.current?.state === "recording") {
      mediaRecorder.current.pause();
      setIsPaused(true);
      clearTimer();
    }
  }, []);

  const resume = useCallback(() => {
    if (mediaRecorder.current?.state === "paused") {
      mediaRecorder.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    }
  }, []);

  const discard = useCallback(() => {
    stop();
    setBlob(null);
    setDuration(0);
    chunks.current = [];
  }, [stop]);

  return { isRecording, isPaused, duration, blob, start, stop, pause, resume, discard };
}
