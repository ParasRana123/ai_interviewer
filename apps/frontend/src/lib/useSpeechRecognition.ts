import { useEffect, useRef, useState, useCallback } from "react";
import {
  getSpeechRecognitionConstructor,
  isSpeechRecognitionSupported,
  getSpeechErrorMessage,
} from "./speechUtils";
import type { ISpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from "../types/speech.d";

export interface UseSpeechRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
  silenceTimeoutMs?: number;
  onFinalTranscript?: (transcript: string) => void;
  onSpeechChange?: (currentLiveTranscript: string) => void;
  onError?: (errorMessage: string) => void;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const {
    continuous = true,
    interimResults = true,
    lang = "en-US",
    silenceTimeoutMs = 1800,
    onFinalTranscript,
    onSpeechChange,
    onError,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [accumulatedFinal, setAccumulatedFinal] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isSupported = isSpeechRecognitionSupported();
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const shouldBeListeningRef = useRef<boolean>(false);
  const isStartingRef = useRef<boolean>(false);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accumulatedTextRef = useRef<string>("");
  const interimTextRef = useRef<string>("");

  const onFinalTranscriptRef = useRef(onFinalTranscript);
  onFinalTranscriptRef.current = onFinalTranscript;

  const onSpeechChangeRef = useRef(onSpeechChange);
  onSpeechChangeRef.current = onSpeechChange;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const commitTranscript = useCallback(() => {
    clearSilenceTimer();
    const finalBuffer = accumulatedTextRef.current.trim();
    const interimBuffer = interimTextRef.current.trim();

    let fullText = finalBuffer;
    if (interimBuffer && !finalBuffer.endsWith(interimBuffer)) {
      fullText = finalBuffer ? `${finalBuffer} ${interimBuffer}` : interimBuffer;
    }

    if (fullText) {
      accumulatedTextRef.current = "";
      interimTextRef.current = "";
      setAccumulatedFinal("");
      setInterimTranscript("");
      onSpeechChangeRef.current?.("");
      onFinalTranscriptRef.current?.(fullText);
    }
  }, [clearSilenceTimer]);

  const resetTranscript = useCallback(() => {
    clearSilenceTimer();
    accumulatedTextRef.current = "";
    interimTextRef.current = "";
    setAccumulatedFinal("");
    setInterimTranscript("");
    onSpeechChangeRef.current?.("");
  }, [clearSilenceTimer]);

  const stopListening = useCallback(() => {
    shouldBeListeningRef.current = false;
    isStartingRef.current = false;
    clearSilenceTimer();

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, [clearSilenceTimer]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      const msg = "Web Speech API is not supported in this browser. Please use Chrome, Edge, or Safari.";
      setError(msg);
      onErrorRef.current?.(msg);
      return;
    }

    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) return;

    shouldBeListeningRef.current = true;
    setError(null);

    if (isStartingRef.current) {
      return;
    }

    // Cleanly abort previous instance if one exists
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null;
    }

    try {
      isStartingRef.current = true;
      const recognition = new SpeechRecognition();
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.lang = lang;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        isStartingRef.current = false;
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (!event || !event.results) return;

        let sessionInterim = "";
        let sessionFinal = "";

        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          if (!res || !res[0]) continue;
          const transcript = res[0].transcript;

          if (res.isFinal) {
            sessionFinal += (sessionFinal ? " " : "") + transcript.trim();
          } else {
            sessionInterim += transcript;
          }
        }

        if (sessionFinal) {
          accumulatedTextRef.current = sessionFinal;
          setAccumulatedFinal(sessionFinal);
        }

        interimTextRef.current = sessionInterim;
        setInterimTranscript(sessionInterim);

        const currentFull = (accumulatedTextRef.current + " " + sessionInterim).trim();
        if (currentFull) {
          onSpeechChangeRef.current?.(currentFull);

          // Reset silence timer whenever words are spoken
          if (silenceTimeoutMs > 0) {
            clearSilenceTimer();
            silenceTimerRef.current = setTimeout(() => {
              commitTranscript();
            }, silenceTimeoutMs);
          }
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        isStartingRef.current = false;
        if (!event) return;

        // 'no-speech' happens naturally when user pauses, ignore
        if (event.error === "no-speech") {
          return;
        }

        if (event.error === "aborted") {
          return;
        }

        const friendlyMessage = getSpeechErrorMessage(event.error || "unknown");
        setError(friendlyMessage);
        onErrorRef.current?.(friendlyMessage);

        if (event.error === "not-allowed" || event.error === "audio-capture") {
          shouldBeListeningRef.current = false;
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        isStartingRef.current = false;
        setIsListening(false);

        // Auto-restart if we are supposed to be continuously listening
        if (shouldBeListeningRef.current) {
          if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current);
          }
          restartTimeoutRef.current = setTimeout(() => {
            if (shouldBeListeningRef.current) {
              try {
                startListening();
              } catch (e) {
                // ignore
              }
            }
          }, 250);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      isStartingRef.current = false;
      const msg = err?.message || "Failed to start speech recognition";
      setError(msg);
      onErrorRef.current?.(msg);
      setIsListening(false);
    }
  }, [continuous, interimResults, lang, isSupported, silenceTimeoutMs, clearSilenceTimer, commitTranscript]);

  useEffect(() => {
    return () => {
      shouldBeListeningRef.current = false;
      isStartingRef.current = false;
      clearSilenceTimer();
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
        recognitionRef.current = null;
      }
    };
  }, [clearSilenceTimer]);

  const liveTranscript = (accumulatedFinal + " " + interimTranscript).trim();

  return {
    isSupported,
    isListening,
    interimTranscript,
    accumulatedFinal,
    liveTranscript,
    error,
    startListening,
    stopListening,
    commitTranscript,
    resetTranscript,
  };
}

