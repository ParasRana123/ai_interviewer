import { useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner"
import axios from "axios";
import { BACKEND_URL } from "@/lib/config";

export function Form() {
    const [github , setGithub] = useState("");
    const [linkedin , setLinkedin] = useState("");

    async function onSubmit() {
        if(!github || !linkedin) {
        toast("Please provide valid github and linkedin")
        }

        await axios.post(`${BACKEND_URL}/api/v1/pre-interview` , {
            linkedin,
            github
        })
    }

    return <div className="h-screen w-screen flex flex-col justify-center items-center">
    <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
      AI Interview Kickstart
    </h2>
      <div className="p-4">
        <Input placeholder="Linkedin URL" onChange={e => setLinkedin(e.target.value)} className="p-4" />
      </div>
      <div className="p-4">
        <Input placeholder="Github URL" onChange={e => setGithub(e.target.value)} className="p-4" />
      </div>
      <div className="flex justify-center p-4">
        <Button onClick={onSubmit}>Start Interview</Button>
      </div>
    </div>
}