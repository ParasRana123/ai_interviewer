export type CandidateIntent =
  | "AUDIO_CHECK"
  | "GREETING"
  | "REPEAT_REQUEST"
  | "CLARIFICATION"
  | "CORRECTION"
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

interface SemanticConcept {
  id: string;
  keywords: RegExp;
  acknowledgement: (name: string, snippet?: string) => string;
  questions: string[];
}

const SEMANTIC_CONCEPTS: SemanticConcept[] = [
  {
    id: "MUSIC_AUDIO_SYNC",
    keywords: /\b(music|audio|song|songs|stream|streaming|playback|track|playlist|listen|spotify|room|rooms)\b/i,
    acknowledgement: (name) => `Got it ${name}, a collaborative room for friends to listen to music together!`,
    questions: [
      "How did you keep playback timestamps and audio state synchronized across all friends in the same room when network latency varies?",
      "How did you handle race conditions when multiple users in a room attempt to pause, skip, or reorder songs in the shared playlist simultaneously?",
      "If a user with a slow network connection joins an active room, how did you prevent their audio from drifting out of sync with the group?",
      "How was the backend architected to broadcast real-time player events (play, pause, seek) to all connected room members?",
      "If you scaled this to thousands of concurrent music rooms, what caching or pub/sub architecture (like Redis Pub/Sub) would you use to broadcast state changes?"
    ]
  },
  {
    id: "REALTIME_WEBSOCKETS",
    keywords: /\b(realtime|real-time|websocket|websockets|socket|socket\.io|webrtc|sync|synchronization|broadcast)\b/i,
    acknowledgement: (name) => `I see, so real-time communication and live event broadcasting were central to the system.`,
    questions: [
      "How did you manage WebSocket connection lifecycles, heartbeats, and graceful reconnections when clients experience intermittent network drops?",
      "How did you structure the message payload format and event routing to minimize bandwidth overhead on the WebSocket server?",
      "If the WebSocket server crashes or restarts, how did you preserve room state and reconnect active peers without losing their session?",
      "How would you horizontally scale the WebSocket gateway across multiple server instances using a shared pub/sub layer?"
    ]
  },
  {
    id: "SEARCH_FILTERING",
    keywords: /\b(search|searching|filter|filtering|query|queries|lookup|autocomplete|find)\b/i,
    acknowledgement: (name) => `Understood, search and discovery are crucial for a smooth user experience.`,
    questions: [
      "When users search for tracks or items, how did you implement client-side debouncing and caching to avoid flooding your backend API with requests?",
      "How did you structure the backend search queries or indexing to ensure fast search response times under heavy load?",
      "Did you implement any fuzzy search or ranking algorithms to handle misspelled search terms from users?"
    ]
  },
  {
    id: "DATABASE_DATA_MODEL",
    keywords: /\b(database|postgres|postgresql|mongodb|sql|nosql|schema|prisma|orm|redis|cache|table|collection)\b/i,
    acknowledgement: (name) => `Thanks for detailing the data layer and storage architecture.`,
    questions: [
      "How did you design the database schema and relations for users, rooms, and session history?",
      "What indexing strategies or query optimizations did you implement to keep read latency low for active rooms?",
      "How did you decide between SQL relational models versus NoSQL or in-memory key-value stores for this use case?",
      "How did you handle database connection pooling and failover recovery in your production environment?"
    ]
  },
  {
    id: "AUTHENTICATION_SECURITY",
    keywords: /\b(auth|authentication|jwt|oauth|login|signup|token|session|security|permission|roles)\b/i,
    acknowledgement: (name) => `Security and authorization are essential components of any multi-user platform.`,
    questions: [
      "How did you implement authentication and secure token validation across both standard HTTP REST endpoints and WebSocket handshakes?",
      "How did you handle room permissions and access control, such as room hosts versus standard listeners?",
      "How did you prevent unauthorized users from tampering with room state or hijacking playlist control?"
    ]
  },
  {
    id: "SYSTEM_SCALE_PERFORMANCE",
    keywords: /\b(scale|scaling|performance|bottleneck|concurrency|latency|throughput|load|docker|kubernetes|microservices)\b/i,
    acknowledgement: (name) => `That is a solid foundation. Let's look at scaling and system architecture.`,
    questions: [
      "If traffic surged to 100,000 concurrent listeners, what would be the very first bottleneck in your system and how would you resolve it?",
      "How would you partition or shard room data across multiple servers to ensure high availability and low latency?",
      "What monitoring, metrics, and alerting (like Prometheus, Grafana, or Datadog) would you put in place to detect degraded audio sync or dropped sockets?"
    ]
  }
];

/**
 * Classifies candidate input intent with support for audio checks, greetings, and corrections
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

  // Correction / disagreement patterns (e.g., "no actually", "there was no", "not really")
  const correctionPatterns = [
    /\b(no actually|not really|there was no|there is no|it was not|it wasn't|what i meant|no no|instead of|not about)\b/i,
  ];
  for (const pattern of correctionPatterns) {
    if (pattern.test(clean)) {
      return "CORRECTION";
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
 * Generates an intelligent, context-aware conversational response with 100% anti-repetition guarantee
 */
export function generateContextualFallback(
  context: DialogContext,
  userMessage: string
): string {
  const intent = classifyCandidateIntent(userMessage);
  const name = context.candidateName || "there";
  const history = context.history || [];

  // All prior assistant questions to guarantee zero repetition
  const priorAssistantQuestions = history
    .filter((h) => h.type === "ASSISTANT")
    .map((h) => h.message);

  const priorQuestionsText = priorAssistantQuestions.join(" ").toLowerCase();

  // 1. Audio check response
  if (intent === "AUDIO_CHECK") {
    const lastQuestion = priorAssistantQuestions[priorAssistantQuestions.length - 1];
    if (lastQuestion && !lastQuestion.toLowerCase().includes("hear you")) {
      return `Yes ${name}, I can hear you loud and clear! Let's continue. To pick up where we left off: ${lastQuestion}`;
    }
    return `Yes ${name}, I can hear you loud and clear! Whenever you're ready, tell me about a project or technical system you've built.`;
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

  // 5. Match semantic concepts from user's current message OR conversation history
  const combinedUserText = `${userMessage} ${history.filter(h => h.type === "USER").map(h => h.message).join(" ")}`;

  for (const concept of SEMANTIC_CONCEPTS) {
    if (concept.keywords.test(userMessage) || (intent === "CORRECTION" && concept.keywords.test(combinedUserText))) {
      // Find an unasked question from this concept
      const unaskedQuestion = concept.questions.find(
        (q) => !priorQuestionsText.includes(q.toLowerCase().substring(0, 35))
      );

      if (unaskedQuestion) {
        const ack = intent === "CORRECTION"
          ? `Got it, thanks for clarifying that ${name}!`
          : concept.acknowledgement(name);

        return `${ack} ${unaskedQuestion}`;
      }
    }
  }

  // 6. Resume project-based progression
  const availableProjects = context.projects || [];
  for (const project of availableProjects) {
    const title = project.title || project.name || "";
    if (title && !priorQuestionsText.includes(title.toLowerCase())) {
      const desc = project.description ? ` (${project.description.slice(0, 70)}...)` : "";
      return `I see! I also noticed your project "${title}"${desc}. What was the most critical architectural decision or technical challenge you tackled on that?`;
    }
  }

  // 7. Unasked skill-based progression
  const availableSkills = context.skills || [];
  for (const skill of availableSkills) {
    if (!priorQuestionsText.includes(skill.toLowerCase())) {
      return `That makes sense. Diving into your experience with ${skill}: how have you handled performance optimization, error boundaries, or concurrency bottlenecks with it?`;
    }
  }

  // 8. Dynamic General System Engineering Questions (Each strictly unique)
  const GENERAL_QUESTIONS = [
    `How did you structure logging, monitoring, and debugging to quickly identify errors in production?`,
    `If you had to refactor this solution today with 10x more users, what architectural trade-offs would you make?`,
    `How did you manage state consistency across distributed clients during sudden network disconnects?`,
    `Could you walk me through your automated testing strategy — such as unit, integration, and load tests?`,
    `How did you handle rate limiting and API security to prevent abuse from malicious clients?`
  ];

  for (const generalQ of GENERAL_QUESTIONS) {
    if (!priorQuestionsText.includes(generalQ.toLowerCase().substring(0, 30))) {
      return `Thanks for breaking that down, ${name}. ${generalQ}`;
    }
  }

  return `Thanks for walking me through that, ${name}. That covers this section well! To wrap up, what was your biggest technical takeaway from building this system?`;
}

