export type CandidateIntent =
  | "AUDIO_CHECK"
  | "GREETING"
  | "REPEAT_REQUEST"
  | "CLARIFICATION"
  | "TECHNICAL_EXPLANATION"
  | "BRIEF_RESPONSE"
  | "WRAP_UP";

export interface DialogContext {
  candidateName: string;
  skills: string[];
  projects: Array<{ title?: string; name?: string; description?: string; techStack?: string[] }>;
  experience: Array<{ company?: string; role?: string; description?: string }>;
  history: Array<{ type: "ASSISTANT" | "USER"; message: string }>;
}

/**
 * Classifies the intent of candidate's voice or text message
 */
export function classifyCandidateIntent(message: string): CandidateIntent {
  const clean = message.toLowerCase().trim();

  // Audio / connection / audibility checks
  const audioCheckPatterns = [
    /\b(can you (hear|listen|hear me|listen to me))\b/i,
    /\b(are you (able to hear|able to listen|listening|there|online))\b/i,
    /\b(am i (audible|clear|speaking))\b/i,
    /\b(is my (mic|microphone|audio) (working|on|live))\b/i,
    /\b(hello hello|testing|test 1 2|mic check|check check)\b/i,
    /\b(you there|can u hear|can u listen)\b/i,
  ];

  for (const pattern of audioCheckPatterns) {
    if (pattern.test(clean)) {
      return "AUDIO_CHECK";
    }
  }

  // Request to repeat or clarify prior question
  const repeatPatterns = [
    /\b(repeat|say (that|it) again|pardon|what was the question|come again|didn't catch that)\b/i,
  ];
  for (const pattern of repeatPatterns) {
    if (pattern.test(clean)) {
      return "REPEAT_REQUEST";
    }
  }

  // Pure initial greetings
  if (/^(hello|hi|hey|good morning|good afternoon|good evening)[\s!.]*$/i.test(clean)) {
    return "GREETING";
  }

  // Candidate wrapping up
  if (/^(i am done|that's all|that's it|i'm finished|nothing more to add)[\s!.]*$/i.test(clean)) {
    return "WRAP_UP";
  }

  // Very short response
  if (clean.split(/\s+/).length <= 3 && !clean.includes("because")) {
    return "BRIEF_RESPONSE";
  }

  return "TECHNICAL_EXPLANATION";
}

/**
 * Generates an intelligent, context-aware conversational response
 * when handling non-technical checks or when Gemini is rate-limited.
 */
export function generateContextualFallback(
  context: DialogContext,
  userMessage: string
): string {
  const intent = classifyCandidateIntent(userMessage);
  const name = context.candidateName || "there";
  const history = context.history || [];

  // Find previous questions to avoid repetition
  const priorAssistantQuestions = history
    .filter((h) => h.type === "ASSISTANT")
    .map((h) => h.message);

  const priorQuestionsText = priorAssistantQuestions.join(" ").toLowerCase();

  // 1. Audio check response
  if (intent === "AUDIO_CHECK") {
    const lastQuestion = priorAssistantQuestions[priorAssistantQuestions.length - 1];
    if (lastQuestion && !lastQuestion.includes("hear you")) {
      return `Yes ${name}, I can hear you loud and clear! Let's continue. To pick up where we left off: ${lastQuestion}`;
    }
    return `Yes ${name}, I can hear you loud and clear! Whenever you're ready, let me know about a project or technical challenge you've worked on recently.`;
  }

  // 2. Repeat request response
  if (intent === "REPEAT_REQUEST") {
    const lastQuestion = priorAssistantQuestions[priorAssistantQuestions.length - 1];
    if (lastQuestion) {
      return `Sure, absolutely! The question was: ${lastQuestion}`;
    }
    return `Of course! Could you walk me through the architecture of a project you've built recently using ${context.skills.slice(0, 3).join(", ") || "your tech stack"}?`;
  }

  // 3. Simple greeting response
  if (intent === "GREETING") {
    const firstSkill = context.skills[0] || "software engineering";
    return `Hello ${name}! Great to meet you. I've looked over your background with ${firstSkill}. Could you introduce yourself and tell me about a project you are particularly proud of?`;
  }

  // 4. Wrap-up response
  if (intent === "WRAP_UP") {
    return `Thank you for sharing those details, ${name}. That provides great clarity on your experience. Let's move on to system design: how would you approach designing a scalable, fault-tolerant service?`;
  }

  // 5. Technical progression based on candidate resume projects & skills
  const availableProjects = context.projects || [];
  const validProject = availableProjects.find(
    (p) => {
      const title = p.title || p.name || "";
      return title && !priorQuestionsText.includes(title.toLowerCase());
    }
  );

  const availableSkills = context.skills || [];
  const untouchedSkill = availableSkills.find(
    (s) => !priorQuestionsText.includes(s.toLowerCase())
  );

  // Determine conversation phase
  const candidateTurnCount = history.filter((h) => h.type === "USER").length;

  if (validProject && candidateTurnCount <= 3) {
    const pTitle = validProject.title || validProject.name;
    const pDesc = validProject.description ? ` (${validProject.description.substring(0, 80)}...)` : "";
    return `That makes sense regarding ${userMessage.slice(0, 40)}. I also noticed your work on "${pTitle}"${pDesc}. What was the most critical architectural decision you made on that project?`;
  }

  if (untouchedSkill && candidateTurnCount > 3 && candidateTurnCount <= 6) {
    return `Interesting approach. Diving into your experience with ${untouchedSkill}: how have you handled performance optimization or concurrency bottlenecks when working with it?`;
  }

  if (candidateTurnCount > 6) {
    return `Great explanation, ${name}. If you were to redesign this system to handle 100x traffic and sudden failovers, what caching, partitioning, or database replication strategies would you implement?`;
  }

  return `Thanks for breaking that down, ${name}. Could you walk me through how you handled data validation, error handling, and testing for that solution?`;
}
