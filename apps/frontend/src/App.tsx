import "../styles/globals.css";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";

export function App() {
  return (
    <div className="h-screen w-screen flex flex-col justify-center items-center">
    <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
      AI Interview Kickstart
    </h2>
      <div className="p-4">
        <Input placeholder="Linkedin URL" className="p-4" />
      </div>
      <div className="p-4">
        <Input placeholder="Github URL" className="p-4" />
      </div>
      <div className="flex justify-center p-4">
        <Button>Start Interview</Button>
      </div>
    </div>
  );
}

export default App;
