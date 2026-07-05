import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import resumeRouter from "./routes/resume";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({
    origin: "http://localhost:3000"
}))
app.use(express.text({ type: ["application/sdp", "text/plain"] }));

app.use("/api/v1/" , resumeRouter);

app.listen(3001 , () => {
    console.log("Server running on PORT 3001");
})