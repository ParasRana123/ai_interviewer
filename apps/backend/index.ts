import "dotenv/config";
import express from "express";
import cors from "cors";
import resumeRouter from "./routes/resume";

const app = express();
app.use(express.json());
app.use(cors({
    origin: ["http://localhost:3000", "http://localhost:5173", "http://localhost:3001"]
}));
app.use(express.text({ type: ["application/sdp", "text/plain"] }));

app.use("/api/v1", resumeRouter);

app.listen(3001, () => {
    console.log("Server running on PORT 3001");
});