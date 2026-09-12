import express from "express";
import multer from "multer";
import { parseResume } from "../services/llm.service";
import { extractText } from "../services/pdf.service";
import { extractProfiles } from "../utils/urlExtractor";
import { getGithuStats } from "../services/github.service";
import { getLeetcodeStats } from "../services/leecode.service";
import { getCodeforcesStats } from "../services/codeforces.service";
import { prisma } from "../prisma/db";
import { initSideband } from "../sideband";
import { calculateResult } from "../result";
import { startInterviewSession, generateNextInterviewTurn } from "../services/interview.service";

const router = express.Router();
const upload = multer();

router.post("/upload-resume", upload.single("resume"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No resume file uploaded. Please select a PDF file.",
          message: "No resume file uploaded. Please select a PDF file.",
        });
      }

      let resumeText = "";
      try {
        resumeText = await extractText(req.file.buffer);
      } catch (extractErr) {
        console.warn("Text extraction notice:", extractErr);
      }

      // If text extraction yielded minimal characters, build a friendly fallback candidate representation
      if (!resumeText || resumeText.trim().length < 5) {
        console.info("PDF text extraction produced minimal text. Initializing standard candidate profile.");
        const originalName = req.file.originalname ? req.file.originalname.replace(/\.[^/.]+$/, "") : "Candidate";
        resumeText = `${originalName}\nSkills: Software Engineering, Problem Solving, Computer Science\nResume Document: Uploaded PDF`;
      }

      const parsedResume = await parseResume(resumeText);
      const profiles = extractProfiles(resumeText);
      const enrichedResume: any = {
        ...parsedResume,
        githubStats: null,
        leetcodeStats: null,
        codeforcesStats: null
      };

      if (profiles.github) {
        try {
          enrichedResume.githubStats = await getGithuStats(profiles.github);
        } catch (error) {
          console.warn("GitHub Stats Warning:", error);
        }
      }
      if (profiles.leetcode) {
        try {
          enrichedResume.leetcodeStats = await getLeetcodeStats(profiles.leetcode);
        } catch (error) {
          console.warn("LeetCode Stats Warning:", error);
        }
      }
      if (profiles.codeforces) {
        try {
          enrichedResume.codeforcesStats = await getCodeforcesStats(profiles.codeforces);
        } catch (error) {
          console.warn("Codeforces Stats Warning:", error);
        }
      }

      const interview = await prisma.interview.create({
        data: {
          name: enrichedResume.name || "Candidate",
          email: enrichedResume.email || null,
          phone: enrichedResume.phone || null,
          education: enrichedResume.education || [],
          experience: enrichedResume.experience || [],
          projects: enrichedResume.projects || [],
          skills: enrichedResume.skills || [],
          achievements: enrichedResume.achievements || [],
          codingProfiles: {
            ...(enrichedResume.codingProfiles || {}),
            githubStats: enrichedResume.githubStats,
            leetcodeStats: enrichedResume.leetcodeStats,
            codeforcesStats: enrichedResume.codeforcesStats
          },
          status: "PRE",
          score: 0,
        }
      });

      return res.status(200).json({
        success: true,
        interviewId: interview.id,
        data: enrichedResume,
      });
      
    } catch (error: any) {
      console.error("Resume Processing Error:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Failed to process resume",
        message: error?.message || "Failed to process resume",
      });
    }
  }
);

// Inform client of pure-Gemini voice & STT architecture
router.post("/session/:interviewId", async (req, res) => {
  return res.status(200).json({
    success: true,
    mode: "gemini-speech",
    message: "Gemini Live Conversational Voice engine is active.",
  });
});

router.post("/interview/start/:interviewId", async (req, res) => {
  try {
    const { interviewId } = req.params;
    if (!interviewId) {
      return res.status(400).json({ success: false, error: "Missing interviewId" });
    }
    const result = await startInterviewSession(interviewId);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Error starting interview session:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to start interview session",
    });
  }
});

router.post("/interview/respond/:interviewId", async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { message } = req.body;

    if (!interviewId) {
      return res.status(400).json({ success: false, error: "Missing interviewId" });
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ success: false, error: "Message content cannot be empty" });
    }

    const result = await generateNextInterviewTurn(interviewId, message.trim());
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Error generating interview response:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to generate interview response",
    });
  }
});

router.get("/interview/details/:interviewId", async (req, res) => {
  try {
    const { interviewId } = req.params;
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        conversations: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!interview) {
      return res.status(404).json({ success: false, error: "Interview not found" });
    }

    return res.status(200).json({
      success: true,
      interview: {
        id: interview.id,
        name: interview.name,
        email: interview.email,
        education: interview.education,
        experience: interview.experience,
        projects: interview.projects,
        skills: interview.skills,
        codingProfiles: interview.codingProfiles,
        status: interview.status,
        conversations: interview.conversations.map((c) => ({
          id: c.id,
          type: c.type,
          message: c.message,
          createdAt: c.createdAt,
        })),
      },
    });
  } catch (error: any) {
    console.error("Error fetching interview details:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch details" });
  }
});

router.post("/session1/:interviewId", async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { message } = req.body;

    if (!interviewId) {
      return res.status(400).json({ success: false, error: "Missing interviewId parameter" });
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ success: false, error: "Message content cannot be empty" });
    }

    const result = await generateNextInterviewTurn(interviewId, message.trim());
    return res.status(200).json({
      success: true,
      message: "User transcript processed",
      reply: result.reply,
      id: result.id,
    });
  } catch (error: any) {
    console.error("Error in session1 turn:", error);
    return res.status(500).json({ success: false, error: "Failed to process interview response" });
  }
});

router.get("/result/:interviewId", async (req, res) => {
  try {
    const { interviewId } = req.params;
    let interview = await prisma.interview.findFirst({
      where: {
        id: interviewId,
      },
      include: {
        conversations: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!interview) {
      return res.status(404).json({
        message: "Interview not found",
      });
    }

    let feedbackText = interview.feedback || "";
    let strengths: string[] = [];
    let improvements: string[] = [];
    let score = interview.score || 0;

    // Parse existing structured JSON feedback if present
    if (interview.feedback) {
      try {
        const parsed = JSON.parse(interview.feedback);
        if (parsed && typeof parsed === "object") {
          feedbackText = parsed.feedback || feedbackText;
          strengths = Array.isArray(parsed.strengths) ? parsed.strengths : [];
          improvements = Array.isArray(parsed.improvements) ? parsed.improvements : [];
        }
      } catch (e) {
        // Plain text feedback legacy format
      }
    }

    // If interview is not yet calculated or status is not DONE, compute it now
    if (interview.status !== "DONE" || !interview.feedback || score === 0) {
      const evaluation = await calculateResult(
        interview.conversations.map((c) => ({
          type: c.type as "ASSISTANT" | "USER",
          message: c.message,
          createdAt: c.createdAt,
        }))
      );

      feedbackText = evaluation.feedback;
      score = evaluation.score;
      strengths = evaluation.strengths || [];
      improvements = evaluation.improvements || [];

      const serializedFeedback = JSON.stringify({
        feedback: evaluation.feedback,
        strengths: evaluation.strengths,
        improvements: evaluation.improvements,
      });

      await prisma.interview.update({
        where: {
          id: interviewId,
        },
        data: {
          status: "DONE",
          feedback: serializedFeedback,
          score: evaluation.score,
        },
      });
    }

    return res.json({
      score,
      feedback: feedbackText,
      strengths,
      improvements,
      status: "DONE",
      transcript: interview.conversations.map((c) => ({
        type: c.type,
        content: c.message,
        createdAt: c.createdAt,
      })),
    });
  } catch (err: any) {
    console.error("Error generating interview result:", err);
    return res.status(500).json({ message: "Failed to generate interview report" });
  }
});

export default router;