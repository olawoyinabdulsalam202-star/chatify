import { BotIcon } from "lucide-react";
import { useAssistantStore } from "../store/useAssistantStore";

function AssistantFloatingButton() {
  const open = useAssistantStore((state) => state.open);

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Open Havn AI chat"
      className="absolute bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] right-3 z-20 flex size-12 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-500 text-white shadow-lg transition-colors hover:bg-cyan-600"
    >
      <BotIcon className="h-6 w-6" />
    </button>
  );
}

export default AssistantFloatingButton;
