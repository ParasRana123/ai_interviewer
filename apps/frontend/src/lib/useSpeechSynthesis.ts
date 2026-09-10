import { useState, useEffect, useRef, useCallback } from "react";

export interface UseSpeechSynthesisOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

export function useSpeechSynthesis(options: UseSpeechSynthesisOptions = {}) {
  const {
    rate = 1.0,
    pitch = 1.0,
    volume = 1.0,
    lang = "en-US",
    onStart,
    onEnd,
    onError,
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;

  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Watchdog timer ref to prevent Chrome synthesis freeze bug
  const watchdogTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setIsSupported(true);

      const updateVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices && availableVoices.length > 0) {
          setVoices(availableVoices);

          // Priority voice selection: natural English voices
          const preferredVoice =
            availableVoices.find((v) => v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Premium"))) ||
            availableVoices.find((v) => v.lang.startsWith("en-US")) ||
            availableVoices.find((v) => v.lang.startsWith("en")) ||
            availableVoices[0];

          setSelectedVoice(preferredVoice || null);
        }
      };

      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;

      return () => {
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        if (watchdogTimerRef.current) {
          clearInterval(watchdogTimerRef.current);
          watchdogTimerRef.current = null;
        }
      };
    }
  }, []);

  const cancel = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (watchdogTimerRef.current) {
      clearInterval(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  const speak = useCallback(
    (text: string, callbackOnEnd?: () => void) => {
      if (!isSupported || !text || !text.trim()) return;

      cancel();

      // Clean markdown tags or bullets before speaking
      const cleanedText = text
        .replace(/[*#_`]/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/https?:\/\/\S+/g, "")
        .trim();

      if (!cleanedText) return;

      try {
        const utterance = new SpeechSynthesisUtterance(cleanedText);
        utterance.rate = rate;
        utterance.pitch = pitch;
        utterance.volume = volume;
        utterance.lang = lang;

        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }

        utterance.onstart = () => {
          setIsSpeaking(true);
          setIsPaused(false);
          onStartRef.current?.();

          // Chrome speech synthesis workaround for long speech
          if (watchdogTimerRef.current) clearInterval(watchdogTimerRef.current);
          watchdogTimerRef.current = setInterval(() => {
            if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
              window.speechSynthesis.pause();
              window.speechSynthesis.resume();
            }
          }, 10000);
        };

        utterance.onend = () => {
          if (watchdogTimerRef.current) {
            clearInterval(watchdogTimerRef.current);
            watchdogTimerRef.current = null;
          }
          setIsSpeaking(false);
          setIsPaused(false);
          onEndRef.current?.();
          callbackOnEnd?.();
        };

        utterance.onerror = (e) => {
          if (watchdogTimerRef.current) {
            clearInterval(watchdogTimerRef.current);
            watchdogTimerRef.current = null;
          }
          setIsSpeaking(false);
          setIsPaused(false);
          if (e.error !== "canceled" && e.error !== "interrupted") {
            console.warn("Speech synthesis notice:", e);
            onErrorRef.current?.(e);
          }
          callbackOnEnd?.();
        };

        window.speechSynthesis.speak(utterance);
      } catch (err: any) {
        console.warn("Failed to speak utterance:", err);
        setIsSpeaking(false);
        callbackOnEnd?.();
      }
    },
    [isSupported, rate, pitch, volume, lang, selectedVoice, cancel]
  );

  const pause = useCallback(() => {
    if (isSupported && isSpeaking) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, [isSupported, isSpeaking]);

  const resume = useCallback(() => {
    if (isSupported && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, [isSupported, isPaused]);

  return {
    isSupported,
    isSpeaking,
    isPaused,
    voices,
    selectedVoice,
    setSelectedVoice,
    speak,
    cancel,
    pause,
    resume,
  };
}
