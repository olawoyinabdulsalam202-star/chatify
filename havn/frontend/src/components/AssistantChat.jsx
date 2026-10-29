import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  BotIcon,
  MoreVerticalIcon,
  SendIcon,
  TrashIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { handleEnterToSend } from "../lib/enterToSend";
import { useAuthStore } from "../store/useAuthStore";
import { useAssistantStore } from "../store/useAssistantStore";

const suggestions = [
  "Help me plan my week",
  "Explain a tricky idea simply",
  "Help me write a thoughtful reply",
];

function AssistantChat() {
  const authUserId = useAuthStore((state) => state.authUser?._id);
  const isSending = useAssistantStore((state) => state.isSending);
  const isLoadingHistory = useAssistantStore((state) => state.isLoadingHistory);
  const hasMore = useAssistantStore((state) => state.hasMore);
  const ownerId = useAssistantStore((state) => state.ownerId);
  const storedMessages = useAssistantStore((state) => state.messages);
  const errorMessage = useAssistantStore((state) => state.errorMessage);
  const failedMessageId = useAssistantStore((state) => state.failedMessageId);
  const failedText = useAssistantStore((state) => state.failedText);
  const loadHistory = useAssistantStore((state) => state.loadHistory);
  const loadOlder = useAssistantStore((state) => state.loadOlder);
  const send = useAssistantStore((state) => state.send);
  const retry = useAssistantStore((state) => state.retry);
  const clear = useAssistantStore((state) => state.clear);
  const close = useAssistantStore((state) => state.close);
  const [assistantName, setAssistantName] = useState("Kairos");
  const [text, setText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef(null);
  const nearBottomRef = useRef(true);
  const previousCountRef = useRef(0);
  const messages = ownerId === authUserId ? storedMessages : [];

  useEffect(() => {
    loadHistory();
    axiosInstance.get("/groups/assistant")
      .then(({ data }) => setAssistantName(data.name || "Kairos"))
      .catch(() => {});
  }, [loadHistory]);

  useEffect(() => {
    const pane = scrollRef.current;
    if (!pane) return;
    if (messages.length > previousCountRef.current && nearBottomRef.current) {
      pane.scrollTop = pane.scrollHeight;
    }
    previousCountRef.current = messages.length;
  }, [messages, isSending]);

  useEffect(() => {
    let firstFrame = 0;
    let secondFrame = 0;
    let preserveBottom = false;
    const keepLatestVisible = () => {
      if (!firstFrame && !secondFrame) preserveBottom = nearBottomRef.current;
      if (!preserveBottom) return;
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      firstFrame = requestAnimationFrame(() => {
        firstFrame = 0;
        secondFrame = requestAnimationFrame(() => {
          const pane = scrollRef.current;
          if (pane) pane.scrollTop = pane.scrollHeight;
          secondFrame = 0;
          preserveBottom = false;
        });
      });
    };
    const viewport = window.visualViewport;
    window.addEventListener("resize", keepLatestVisible);
    viewport?.addEventListener("resize", keepLatestVisible);
    return () => {
      window.removeEventListener("resize", keepLatestVisible);
      viewport?.removeEventListener("resize", keepLatestVisible);
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, []);

  const handleSend = (event) => {
    event?.preventDefault();
    if (!text.trim() || isSending) return;
    send(text);
    setText("");
  };

  const handleSuggestion = (suggestion) => {
    if (isSending) return;
    send(suggestion);
  };

  const handleLoadOlder = async () => {
    const pane = scrollRef.current;
    if (!pane) return;
    const oldHeight = pane.scrollHeight;
    await loadOlder();
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop += scrollRef.current.scrollHeight - oldHeight;
    });
  };

  const handleClear = async () => {
    setMenuOpen(false);
    await clear();
    previousCountRef.current = 0;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-slate-900">
      <header className="flex min-h-[72px] shrink-0 items-center justify-between gap-3 border-b border-slate-700/50 bg-slate-800/50 px-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={close}
            className="shrink-0 text-slate-400 transition-colors hover:text-slate-200 md:hidden"
            aria-label="Back to chats"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-300">
            <BotIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-medium text-slate-100">{assistantName}</h1>
              <span className="rounded-full border border-cyan-500/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cyan-300">
                AI
              </span>
            </div>
            <p className="truncate text-xs text-slate-400">Replies are only visible to you</p>
          </div>
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="AI chat options"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-700/60 hover:text-slate-100"
          >
            <MoreVerticalIcon className="h-5 w-5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-11 z-20 w-40 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl">
              <button
                type="button"
                onClick={handleClear}
                disabled={isSending}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
              >
                <TrashIcon className="h-4 w-4" /> Clear chat
              </button>
            </div>
          )}
        </div>
      </header>

      <div
        ref={scrollRef}
        onScroll={(event) => {
          const pane = event.currentTarget;
          nearBottomRef.current = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 120;
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-5 sm:px-6 sm:py-7"
      >
        <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-end gap-4">
          {hasMore && (
            <button
              type="button"
              onClick={handleLoadOlder}
              disabled={isLoadingHistory}
              className="self-center rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-50"
            >
              {isLoadingHistory ? "Loading…" : "Load earlier messages"}
            </button>
          )}

          {messages.length === 0 && !isLoadingHistory ? (
            <div className="my-auto flex flex-col items-center py-10 text-center">
              <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-300">
                <BotIcon className="h-7 w-7" />
              </span>
              <h2 className="text-lg font-medium text-slate-100">Talk it through with {assistantName}</h2>
              <p className="mt-2 max-w-sm text-sm text-slate-400">
                Ask a question, explore an idea, or get help finding the right words. This chat is private to you.
              </p>
              <div className="mt-6 flex w-full max-w-md flex-col gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSuggestion(suggestion)}
                    disabled={isSending}
                    className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-left text-sm text-slate-200 hover:border-cyan-500/50 hover:bg-slate-800 disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message._id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <p
                  className={`chat-bubble max-w-[85%] md:max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "bg-cyan-600 text-white"
                      : "bg-slate-800 text-slate-100"
                  } ${message.hasFailed ? "opacity-75" : ""}`}
                >
                  {message.text}
                </p>
              </div>
            ))
          )}

          {isSending && (
            <div className="flex justify-start">
              <div className="chat-bubble rounded-2xl bg-slate-800 px-4 py-3 text-sm text-slate-400" aria-label="Kairos is typing">
                <span className="animate-pulse">Kairos is typing…</span>
              </div>
            </div>
          )}

          {errorMessage && failedMessageId && (
            <div className="ml-auto flex max-w-[88%] items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={retry}
                disabled={isSending || !failedText}
                className="shrink-0 font-medium text-red-100 underline underline-offset-2 disabled:opacity-50"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSend} className="chat-input-bar shrink-0 border-t border-slate-700/50 p-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-slate-700 bg-slate-800/60 p-2 focus-within:border-cyan-500">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, 2000))}
            onKeyDown={(event) => handleEnterToSend(event, handleSend)}
            maxLength={2000}
            rows={1}
            placeholder="Message Kairos"
            className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500"
          />
          <span className="pb-2 text-[10px] text-slate-500">{text.length}/2000</span>
          <button
            type="submit"
            disabled={!text.trim() || isSending}
            aria-label="Send message"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500 text-white hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SendIcon className="h-4 w-4" />
          </button>
        </div>
      </form>
    </section>
  );
}

export default AssistantChat;
