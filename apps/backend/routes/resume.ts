import express from "express";
import multer from "multer";
import { parseResume } from "../services/llm.service";
import { extractText } from "../services/pdf.service";
import { extractProfiles } from "../utils/urlExtractor";
import { getGithuStats } from "../services/github.service";
import { getLeetcodeStats } from "../services/leecode.service";
import { getCodeforcesStats } from "../services/codeforces.service";

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
      return res.status(200).json({
        success: true,
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

export default router;