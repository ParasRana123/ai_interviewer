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

router.post("/session/:interviewId", async (req, res) => {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.warn("OPENAI_API_KEY is not configured. WebRTC voice calls disabled; client will use Web Speech API.");
    return res.status(503).json({
      success: false,
      error: "OPENAI_API_KEY is not configured.",
      message: "OpenAI Realtime Voice requires an OPENAI_API_KEY. Speech recognition mode remains fully active.",
    });
  }

  const sessionConfig = JSON.stringify({
    type: "realtime",
    model: "gpt-realtime-2",
    audio: { output: { voice: "marin" } }
  });

  const fd = new FormData();
  fd.set("sdp", req.body);
  fd.set("session", sessionConfig);

  try {
    const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "OpenAI-Safety-Identifier": "hashed-user-id",
      },
      body: fd,
    });

    const sdpText = await sdpResponse.text();

    if (!sdpResponse.ok) {
      console.warn("OpenAI Realtime API response error:", sdpResponse.status, sdpText);
      return res.status(sdpResponse.status).json({
        success: false,
        error: "OpenAI Realtime session generation failed",
        details: sdpText,
      });
    }

    if (!sdpText || !sdpText.trim().startsWith("v=")) {
      console.warn("OpenAI Realtime returned non-SDP response:", sdpText);
      return res.status(502).json({
        success: false,
        error: "Invalid SDP returned by OpenAI Realtime",
      });
    }

    const location = sdpResponse.headers.get("location");
    const callId = location?.split("/").pop();
    if (callId) {
      console.log("OpenAI Realtime Call ID:", callId);
      initSideband(callId, req.params.interviewId).catch((err) => {
        console.warn("Sideband initialization warning:", err?.message || err);
      });
    }

    res.setHeader("Content-Type", "application/sdp");
    return res.status(200).send(sdpText);
  } catch (error: any) {
    console.error("Token generation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate realtime session",
      error: error?.message || error,
    });
  }
});

import { startInterviewSession, generateNextInterviewTurn } from "../services/interview.service";

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

router.get("/result/:interviewId" , async (req , res) => {
  const interview = await prisma.interview.findFirst({
    where: {
      id: req.params.interviewId
    },
    include: {
      conversations: true
    }
  })

  if(!interview) {
    res.status(411).json({
      message: "Interview not found"
    })
    return
  }

  res.json({
    score: interview?.score,
    feedback: interview?.feedback,
    transcript: interview?.conversations.map(c => ({
      type: c.type,
      content: c.message,
      createdAt: c.createdAt
    }))
  })

  if(interview.status != "DONE") {
    const result = await calculateResult(interview.conversations)

    await prisma.interview.update({
      where: {
        id: req.params.interviewId
      },
      data: {
        status: "DONE",
        feedback: result.feedback,
        score: result.score
      }
    })
  }

})

export default router;