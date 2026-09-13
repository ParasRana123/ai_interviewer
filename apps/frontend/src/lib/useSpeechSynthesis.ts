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
  const [isVoicesLoaded, setIsVoicesLoaded] = useState(false);
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  // Keep latest options and states in refs for stable callbacks
  const rateRef = useRef(rate);
  rateRef.current = rate;

  const pitchRef = useRef(pitch);
  pitchRef.current = pitch;

  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const langRef = useRef(lang);
  langRef.current = lang;

  const selectedVoiceRef = useRef(selectedVoice);
  selectedVoiceRef.current = selectedVoice;

  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;

  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Active utterance ref to prevent Chrome V8 garbage collection bug
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const pendingSpeakRef = useRef<{ text: string; callbackOnEnd?: () => void } | null>(null);

  // Watchdog timer ref to prevent Chrome synthesis freeze bug
  const watchdogTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Select the highest quality natural English voice available
  const pickBestVoice = useCallback((availableVoices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
    if (!availableVoices || availableVoices.length === 0) return null;

    return (
      availableVoices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Natural") ||
            v.name.includes("Google") ||
            v.name.includes("Samantha") ||
            v.name.includes("Jenny") ||
            v.name.includes("Guy") ||
            v.name.includes("Aria") ||
            v.name.includes("Premium") ||
            v.name.includes("Enhanced"))
      ) ||
      availableVoices.find((v) => v.lang === "en-US") ||
      availableVoices.find((v) => v.lang.startsWith("en-US")) ||
      availableVoices.find((v) => v.lang.startsWith("en")) ||
      availableVoices[0] ||
      null
    );
  }, []);

  const cancel = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        // ignore
      }
    }
    if (watchdogTimerRef.current) {
      clearInterval(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
    currentUtteranceRef.current = null;
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  const speak = useCallback(
    (text: string, callbackOnEnd?: () => void) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      if (!text || !text.trim()) return;

      // Clean markdown formatting, symbols, and links
      const cleanedText = text
        .replace(/[*#_`~>]/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/https?:\/\/\S+/g, "")
        .replace(/\n+/g, " ")
        .trim();

      if (!cleanedText) return;

      // Cancel any ongoing utterance before speaking new text
      cancel();

      try {
        // Resume synthesis engine in case browser placed it in suspended/paused state
        window.speechSynthesis.resume();

        const utterance = new SpeechSynthesisUtterance(cleanedText);
        utterance.rate = rateRef.current;
        utterance.pitch = pitchRef.current;
        utterance.volume = volumeRef.current;
        utterance.lang = langRef.current;

        // Choose assigned or best available voice
        const currentVoices = window.speechSynthesis.getVoices();
        const voiceToUse = selectedVoiceRef.current || pickBestVoice(currentVoices);
        if (voiceToUse) {
          utterance.voice = voiceToUse;
        }

        // Retain active utterance reference to prevent GC
        currentUtteranceRef.current = utterance;

        utterance.onstart = () => {
          setIsSpeaking(true);
          setIsPaused(false);
          setIsAutoplayBlocked(false);
          onStartRef.current?.();

          // Chrome watchdog timer to keep long utterances active
          if (watchdogTimerRef.current) clearInterval(watchdogTimerRef.current);
          watchdogTimerRef.current = setInterval(() => {
            if (typeof window !== "undefined" && window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
              window.speechSynthesis.pause();
              window.speechSynthesis.resume();
            }
          }, 8000);
        };

        utterance.onend = () => {
          if (watchdogTimerRef.current) {
            clearInterval(watchdogTimerRef.current);
            watchdogTimerRef.current = null;
          }
          currentUtteranceRef.current = null;
          setIsSpeaking(false);
          setIsPaused(false);
          onEndRef.current?.();
          callbackOnEnd?.();
        };

        utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
          if (watchdogTimerRef.current) {
            clearInterval(watchdogTimerRef.current);
            watchdogTimerRef.current = null;
          }
          currentUtteranceRef.current = null;
          setIsSpeaking(false);
          setIsPaused(false);

          if (e.error === "not-allowed") {
            // Autoplay policy blocked audio without user interaction
            setIsAutoplayBlocked(true);
            pendingSpeakRef.current = { text: cleanedText, callbackOnEnd };
          } else if (e.error !== "canceled" && e.error !== "interrupted") {
            console.warn("Speech synthesis notice:", e);
            onErrorRef.current?.(e);
          }
          callbackOnEnd?.();
        };

        window.speechSynthesis.speak(utterance);

        // Immediate resume nudge for Chromium engine
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch (err: any) {
        console.warn("Failed to execute speech utterance:", err);
        setIsSpeaking(false);
        callbackOnEnd?.();
      }
    },
    [cancel, pickBestVoice]
  );

  // Initialize SpeechSynthesis and voices
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setIsSupported(true);

      const updateVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices && availableVoices.length > 0) {
          setVoices(availableVoices);
          setIsVoicesLoaded(true);

          const preferredVoice = pickBestVoice(availableVoices);
          if (preferredVoice) {
            setSelectedVoice(preferredVoice);
            selectedVoiceRef.current = preferredVoice;
          }

          // If there was a pending speech waiting for voices to load, trigger it now
          if (pendingSpeakRef.current) {
            const pending = pendingSpeakRef.current;
            pendingSpeakRef.current = null;
            setTimeout(() => {
              speak(pending.text, pending.callbackOnEnd);
            }, 50);
          }
        }
      };

      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;

      return () => {
        if (window.speechSynthesis) {
          try {
            window.speechSynthesis.cancel();
          } catch (e) {
            // ignore
          }
        }
        if (watchdogTimerRef.current) {
          clearInterval(watchdogTimerRef.current);
          watchdogTimerRef.current = null;
        }
      };
    }
  }, [pickBestVoice, speak]);

  const unlockAudio = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.resume();
      setIsAutoplayBlocked(false);

      if (pendingSpeakRef.current) {
        const pending = pendingSpeakRef.current;
        pendingSpeakRef.current = null;
        speak(pending.text, pending.callbackOnEnd);
      }
    } catch (e) {
      console.warn("Error unlocking speech synthesis:", e);
    }
  }, [speak]);

  const pause = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window && isSpeaking) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, [isSpeaking]);

  const resume = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, [isPaused]);

  return {
    isSupported,
    isSpeaking,
    isPaused,
    isVoicesLoaded,
    isAutoplayBlocked,
    voices,
    selectedVoice,
    setSelectedVoice,
    speak,
    cancel,
    pause,
    resume,
    unlockAudio,
  };
}
