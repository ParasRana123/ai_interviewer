import express from "express";
import dotenv from "dotenv";
import resumeRouter from "./routes/resume";

dotenv.config();

const app = express();
app.use(express.json());

app.use("/api" , resumeRouter);

app.listen(3001 , () => {
    console.log("Server running on PORT 3001");
})