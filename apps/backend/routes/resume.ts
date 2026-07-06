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

const router = express.Router();
const upload = multer();

router.post("/upload-resume", upload.single("resume"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No resume file uploaded",
        });
      }
      const resumeText = await extractText(req.file.buffer);
      const parsedResume = await parseResume(resumeText);
      const profiles = extractProfiles(resumeText);
      const enrichedResume: any = {...parsedResume , githubStats: null , leetcodeStats: null , codeforcesStats: null};
      if (profiles.github) {
        try {
          enrichedResume.githubStats =
            await getGithuStats(
              profiles.github
            );
        } catch (error) {
          console.error("GitHub Stats Error:",error);
        }
      }
      if (profiles.leetcode) {
        try {
          enrichedResume.leetcodeStats = await getLeetcodeStats(profiles.leetcode);
        } catch (error) {
          console.error("LeetCode Stats Error:",error);
        }
      }
      if (profiles.codeforces) {
        try {
          enrichedResume.codeforcesStats = await getCodeforcesStats(profiles.codeforces);
        } catch (error) {
          console.error(
            "Codeforces Stats Error:",
            error
          );
        }
      }

      const interview = await prisma.interview.create({
        data: {
          name: enrichedResume.name,
          email: enrichedResume.email,
          phone: enrichedResume.phone,
          education: enrichedResume.education,
          experience: enrichedResume.experience,
          projects: enrichedResume.projects,
          skills: enrichedResume.skills,
          achievements: enrichedResume.achievements,
          codingProfiles: {
            ...enrichedResume.codingProfiles,
            githubStats: enrichedResume.githubStats,
            leetcodeStats: enrichedResume.leetcodeStats,
            codeforcesStats: enrichedResume.codeforcesStats
          },
          status: "PRE",
          score: 0,
        }
      })

      return res.status(200).json({
        success: true,
        interviewId: interview.id,
        data: enrichedResume,
      });
      
    } catch (error: any) {
      console.error(
        "Resume Parsing Error:",
        error
      );
      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          "Failed to parse resume",
      });
    }
  }
);

router.post("/session/:interviewId" , async (req , res) => {
  const sessionConfig = JSON.stringify({
    type: "realtime",
    model: "gpt-realtime-2",
    audio: { output: { voice: "marin" } }
  })

  const fd = new FormData();
  fd.set("sdp" , req.body);
  fd.set("session" , sessionConfig);
  try {
    const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls" , {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Safety-Identifier": "hashed-user-id",
      },
      body: fd
    });
    const location = sdpResponse.headers.get("location");
    const callId = location?.split("/").pop()!;
    console.log("Call ID:", callId);
    const sdp = await sdpResponse.text();
    initSideband(callId, req.params.interviewId);
    res.send(sdp);
  } catch(error) {
    console.error("Token generation error:", error);
    res.status(500).json({ message: "Failed to generate token" });
  }
})

router.post("/session1/:interviewId" , async (req , res) => {
  const { message } = req.body;
  await prisma.message.create({
    data: {
      interviewId: req.params.interviewId,
      type: "USER",
      message: message
    }
  });
  res.json({ message: "Message saved" });
})

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

  if(interview.status == "INPROGRESS") {
    
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
})

export default router;