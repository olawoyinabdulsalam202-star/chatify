import { useState } from "react";
import { BotIcon, LoaderIcon, SendIcon, XIcon } from "lucide-react";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

function AssistantFab({ groupId = null }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  const ask = async (event) => {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const { data } = await axiosInstance.post("/messages/assistant", {
        text,
        groupId: groupId || undefined,
      });
      setAnswer(data.answer || "I couldn't find an answer this time.");
      setQuestion("");
    } catch (error) {
      toast.error(error.response?.data?.message || "The assistant is unavailable right now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-3 bottom-20 sm:bottom-28 z-40 size-12 rounded-full bg-gradient-to-br from-cyan-400 to-violet-600 text-white shadow-lg shadow-cyan-950/40 ring-2 ring-slate-900 hover:scale-105 transition-transform"
        aria-label="Ask Havn AI"
        title="Ask Havn AI"
      >
        <span className="absolute inset-0 grid place-items-center"><BotIcon className="w-6 h-6" /></span>
        <span className="absolute -right-1 -top-1 rounded-full bg-slate-950 px-1 text-[9px] font-bold tracking-wide">AI</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 grid place-items-center" onClick={() => setOpen(false)}>
          <section
            className="w-full max-w-md rounded-2xl border border-cyan-400/30 bg-slate-900 shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Ask Havn AI"
          >
            <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-3">
              <div className="flex items-center gap-2 text-slate-100 font-medium">
                <span className="grid place-items-center size-8 rounded-full bg-gradient-to-br from-cyan-400 to-violet-600"><BotIcon className="w-4 h-4" /></span>
                Ask Havn AI
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-white" aria-label="Close assistant"><XIcon className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-slate-400">Ask a question privately here. In a group, the answer is only shown to you.</p>
              {answer && <div className="rounded-xl bg-slate-800/80 p-3 text-sm text-slate-200 whitespace-pre-wrap break-words">{answer}</div>}
              <form onSubmit={ask} className="flex gap-2">
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  rows={2}
                  maxLength={2000}
                  autoFocus
                  placeholder="Ask anything…"
                  className="min-w-0 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                />
                <button type="submit" disabled={!question.trim() || busy} className="self-end size-10 rounded-xl bg-cyan-500 text-white grid place-items-center disabled:opacity-50" aria-label="Ask">
                  {busy ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <SendIcon className="w-4 h-4" />}
                </button>
              </form>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default AssistantFab;
