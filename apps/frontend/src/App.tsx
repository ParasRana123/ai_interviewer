import { useState } from "react";
import "../styles/globals.css";
import { Form } from "./components/Form";
import { Result } from "./components/Result";
import { Interview } from "./components/interview";
import { Toaster } from "sonner";

export function App() {
  const [page , setPage] = useState<"form" | "interview" | "result">("form");
  return (
    <div>
      {page == "form" && <Form />}
      {page == "interview" && <Interview />}
      {page == "result" && <Result />}
      <Toaster />
    </div>
  );
}

export default App;
