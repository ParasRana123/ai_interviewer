import express from "express";
import { preInterviewBody } from "./types";
import axios from "axios";

const app = express();
app.use(express.json());

app.post("/api/v1/pre-interview" , async (req , res) => {
    const {success , data} = preInterviewBody.safeParse(req.body);
    if(!success) {
        res.status(401).json({
            message: "Incorrect body"
        })
        return;
    }

    const githubUrl = data.github.endsWith("/") ? data.github.slice(0 , -1) : data.github;
    const linkedinUrl = data.linkedin.endsWith("/") ? data.linkedin.slice(0 , -1) : data.linkedin;

    const githubUsername = githubUrl.split("/").pop();
    const linkedinUsername = linkedinUrl.split("/").pop();

    const userRepos = await axios.get(`https://api.github.com/users/${githubUsername}/repos`);
    const filteredUserRepos = userRepos.data.map((x: any) => ({
        description: x.description,
        name: x.name,
        fullName: x.fullName,
        starCount: x.stargazers_count
    }))

    console.log(filteredUserRepos);

    // Difficult Bit: Linkedin Scraping
})

app.listen(3001)