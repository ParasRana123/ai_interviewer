import "../types/speech.d";

/**
 * Checks whether the current browser supports the Web Speech API (SpeechRecognition).
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Returns the SpeechRecognition constructor if available in the browser.
 */
export function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/**
 * Maps Web Speech API error codes to human-readable troubleshooting guidance.
 */
export function getSpeechErrorMessage(error: string): string {
  switch (error) {
    case "no-speech":
      return "No speech was detected. Please check your microphone.";
    case "audio-capture":
      return "No microphone was found or microphone access failed.";
    case "not-allowed":
      return "Microphone permission was denied. Please allow microphone access in your browser settings.";
    case "network":
      return "Network communication error occurred during speech recognition.";
    case "aborted":
      return "Speech recognition was aborted.";
    default:
      return `Speech recognition error: ${error}`;
  }
}
