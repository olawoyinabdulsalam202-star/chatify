import { MessageCircleIcon, HandIcon, SmileIcon, CalendarIcon } from "lucide-react";

const NoChatHistoryPlaceholder = ({ name }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
      <div className="w-16 h-16 bg-cyan-500/15 rounded-full flex items-center justify-center mb-5">
        <MessageCircleIcon className="size-8 text-cyan-400" />
      </div>
      <h3 className="text-lg font-medium text-slate-200 mb-3">
        Start your conversation with {name}
      </h3>
      <div className="flex flex-col space-y-3 max-w-md mb-5">
        <p className="text-slate-400 text-sm">
          This is the beginning of your conversation. Send a message to start chatting.
        </p>
        <div className="h-px w-32 bg-slate-700 mx-auto"></div>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        <span className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-cyan-400 bg-cyan-500/10 rounded-full">
          <HandIcon className="w-3.5 h-3.5" /> Say hello
        </span>
        <span className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-cyan-400 bg-cyan-500/10 rounded-full">
          <SmileIcon className="w-3.5 h-3.5" /> How are you?
        </span>
        <span className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-cyan-400 bg-cyan-500/10 rounded-full">
          <CalendarIcon className="w-3.5 h-3.5" /> Meet up soon?
        </span>
      </div>
    </div>
  );
};

export default NoChatHistoryPlaceholder;
