import { BotIcon, ChevronRightIcon } from "lucide-react";
import { useAssistantStore } from "../store/useAssistantStore";

function AssistantListRow() {
  const open = useAssistantStore((state) => state.open);
  const isOpen = useAssistantStore((state) => state.isOpen);

  return (
    <button
      type="button"
      onClick={open}
      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
        isOpen
          ? "border-cyan-500/40 bg-cyan-500/15"
          : "border-slate-700/60 bg-slate-800/50 hover:bg-slate-700/60"
      }`}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-300">
        <BotIcon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-slate-100">Kairos</span>
        <span className="block truncate text-xs text-slate-400">A private conversation</span>
      </span>
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-500" />
    </button>
  );
}

export default AssistantListRow;
