import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { data, useNavigate } from "react-router";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { BACKEND_URL } from "@/lib/config";

export function Form() {
  const [resume, setResume] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit() {
    if (!resume) {
      toast("Please upload your resume.");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("resume", resume);

      const { data } = await axios.post(
        `${BACKEND_URL}/api/upload-resume`,
        formData
      );

      navigate(`/interview/${data.interviewId}`)

      toast("Resume uploaded successfully!");
    } catch (error: any) {
      console.error(error.response);
      console.log(error.request);
      console.log(error.message);
      toast("Failed to upload resume.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen w-screen flex flex-col justify-center items-center">
      <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight">
        AI Interview Kickstart
      </h2>

      <div className="p-4 w-96">
        <Input
          type="file"
          accept=".pdf"
          onChange={(e) => {
            if (e.target.files?.length) {
              setResume(e.target.files[0]);
            }
          }}
        />
      </div>

      <div className="p-4">
        <Button onClick={onSubmit} disabled={loading}>
          {loading ? "Uploading..." : "Start Interview"}
        </Button>
      </div>
    </div>
  );
}