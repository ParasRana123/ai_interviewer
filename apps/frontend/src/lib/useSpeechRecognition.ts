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
  onFinalTranscript?: (transcript: string) => void;
  onError?: (errorMessage: string) => void;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const {
    continuous = true,
    interimResults = true,
    lang = "en-US",
    onFinalTranscript,
    onError,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isSupported = isSpeechRecognitionSupported();
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const shouldBeListeningRef = useRef<boolean>(false);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onFinalTranscriptRef = useRef(onFinalTranscript);
  onFinalTranscriptRef.current = onFinalTranscript;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const stopListening = useCallback(() => {
    shouldBeListeningRef.current = false;
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        // Ignore errors when stopping already inactive recognition
      }
    }
    setIsListening(false);
    setInterimTranscript("");
  }, []);

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

    // If an existing instance exists, cleanly abort it before re-initializing
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // ignore
      }
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.lang = lang;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let currentInterim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const resultItem = event.results[i];
          const text = resultItem[0]?.transcript || "";

          if (resultItem.isFinal) {
            const trimmed = text.trim();
            if (trimmed) {
              setFinalTranscript((prev) => (prev ? `${prev} ${trimmed}` : trimmed));
              setInterimTranscript("");
              onFinalTranscriptRef.current?.(trimmed);
            }
          } else {
            currentInterim += text;
          }
        }
        setInterimTranscript(currentInterim);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        // 'no-speech' is a normal event when the user pauses talking, do not treat as fatal
        if (event.error === "no-speech") {
          return;
        }

        if (event.error === "aborted") {
          return;
        }

        const friendlyMessage = getSpeechErrorMessage(event.error);
        setError(friendlyMessage);
        onErrorRef.current?.(friendlyMessage);

        if (event.error === "not-allowed" || event.error === "audio-capture") {
          shouldBeListeningRef.current = false;
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript("");

        // If continuous recognition was requested and session wasn't explicitly stopped, auto-restart
        if (shouldBeListeningRef.current) {
          if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current);
          }
          restartTimeoutRef.current = setTimeout(() => {
            if (shouldBeListeningRef.current) {
              try {
                recognition.start();
              } catch (e) {
                // If start fails, attempt a fresh start
                startListening();
              }
            }
          }, 300);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      const msg = err?.message || "Failed to start speech recognition";
      setError(msg);
      onErrorRef.current?.(msg);
      setIsListening(false);
    }
  }, [continuous, interimResults, lang, isSupported]);

  const resetTranscript = useCallback(() => {
    setFinalTranscript("");
    setInterimTranscript("");
  }, []);

  useEffect(() => {
    return () => {
      shouldBeListeningRef.current = false;
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    interimTranscript,
    finalTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
