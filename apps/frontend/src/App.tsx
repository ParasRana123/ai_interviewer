import { useState } from "react";
import "../styles/globals.css";
import { Form } from "./components/Form";
import { Result } from "./components/Result";
import { Interview } from "./components/Interview";
import { Toaster } from "sonner";
import { BrowserRouter , Routes , Route } from "react-router";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Form />} />
        <Route path="/interview/:id" element={<Interview />} />
        <Route path="/result/:id" element={<Result />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
