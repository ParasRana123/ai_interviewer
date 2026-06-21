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

router.post("/upload-resume" , upload.single("resume") , async (req , res) => {
    try {
        if(!req.file) {
            return res.status(400).json({
                error: "No file found"
            })
        }
        const resumeText = await extractText(req.file.buffer);
        const parsed = await parseResume(resumeText);
        const profiles = extractProfiles(resumeText);
        if(profiles.github) {
            parsed.githubStats = await getGithuStats(profiles.github);
        }
        if(profiles.leetcode) {
            parsed.leetcodeStats = await getLeetcodeStats(profiles.leetcode);
        }
        if(profiles.codeforces) {
            parsed.codeforcesStats = await getCodeforcesStats(profiles.codeforces);
        }
        return res.json(parsed);
    } catch(err) {
        console.log(err);
        return res.status(500).json({
            error: "Failed"
        })
    }
})

export default router;