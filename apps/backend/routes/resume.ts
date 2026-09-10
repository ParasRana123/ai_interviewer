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

      const resumeText = await extractText(req.file.buffer);
      if (!resumeText || resumeText.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: "Unable to extract text from the uploaded PDF. Please upload a standard text-based PDF resume.",
          message: "Unable to extract text from the uploaded PDF. Please upload a standard text-based PDF resume.",
        });
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

router.post("/session1/:interviewId", async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { message } = req.body;

    if (!interviewId) {
      return res.status(400).json({ error: "Missing interviewId parameter" });
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message content cannot be empty" });
    }

    const savedMessage = await prisma.message.create({
      data: {
        interviewId,
        type: "USER",
        message: message.trim(),
      },
    });

    return res.status(200).json({ success: true, message: "User transcript saved", id: savedMessage.id });
  } catch (error: any) {
    console.error("Error saving user transcript message:", error);
    return res.status(500).json({ error: "Failed to save message" });
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