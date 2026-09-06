import { useEffect, useRef, useState } from "react";
import { SquareIcon, TrashIcon, SendIcon, PlayIcon, PauseIcon } from "lucide-react";
import toast from "react-hot-toast";

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// onSend receives { audio: base64DataUrl, audioDuration: seconds }
function VoiceRecorder({ onSend, onCancel }) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewBlob, setPreviewBlob] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const audioElRef = useRef(null);

  useEffect(() => {
    startRecording();
    return () => {
      clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setPreviewBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
      };

      recorder.start();
      setIsRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch {
      toast.error("Microphone access is required to record a voice note");
      onCancel();
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    clearInterval(timerRef.current);
    setIsRecording(false);
  };

  const handleDiscard = () => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current?.state === "recording" && mediaRecorderRef.current.stop();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onCancel();
  };

  const handleSend = () => {
    if (!previewBlob) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      onSend({ audio: reader.result, audioDuration: elapsed });
    };
    reader.readAsDataURL(previewBlob);
  };

  const togglePlayback = () => {
    if (!audioElRef.current) return;
    if (isPlaying) {
      audioElRef.current.pause();
    } else {
      audioElRef.current.play();
    }
    setIsPlaying((p) => !p);
  };

  if (previewUrl) {
    return (
      <div className="flex items-center gap-3 bg-slate-800/60 border border-slate-700/50 rounded-lg px-4 py-2 flex-1">
        <button type="button" onClick={togglePlayback} className="text-cyan-400 hover:text-cyan-300">
          {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
        </button>
        <audio
          ref={audioElRef}
          src={previewUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
        <span className="text-sm text-slate-300 flex-1">Voice note · {formatDuration(elapsed)}</span>
        <button type="button" onClick={handleDiscard} className="text-slate-400 hover:text-red-400">
          <TrashIcon className="w-4 h-4" />
        </button>
        <button type="button" onClick={handleSend} className="text-cyan-400 hover:text-cyan-300">
          <SendIcon className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-slate-800/60 border border-slate-700/50 rounded-lg px-4 py-2 flex-1">
      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
      <span className="text-sm text-slate-300 flex-1">Recording… {formatDuration(elapsed)}</span>
      <button type="button" onClick={handleDiscard} className="text-slate-400 hover:text-red-400">
        <TrashIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={stopRecording}
        disabled={!isRecording}
        className="text-cyan-400 hover:text-cyan-300"
      >
        <SquareIcon className="w-5 h-5" />
      </button>
    </div>
  );
}

export { formatDuration };
export default VoiceRecorder;
