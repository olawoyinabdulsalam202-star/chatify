import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";

function ActiveTabSwitch() {
  const { activeTab, setActiveTab } = useChatStore();
  const { receivedGroupInvites } = useGroupStore();

  return (
    <div className="tab-switcher tabs tabs-boxed bg-transparent p-1.5 sm:p-2 m-1.5 sm:m-2">
      <button
        onClick={() => setActiveTab("chats")}
        className={`tab min-h-10 flex-1 md:min-h-0 md:flex-none transition-colors ${activeTab === "chats" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400"}`}
      >
        Chats
      </button>

      <button
        onClick={() => setActiveTab("groups")}
        className={`tab min-h-10 flex-1 md:min-h-0 md:flex-none relative transition-colors ${activeTab === "groups" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400"}`}
      >
        Groups
        {receivedGroupInvites.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-cyan-500 text-white text-[10px] font-semibold rounded-full size-4 flex items-center justify-center">
            {receivedGroupInvites.length}
          </span>
        )}
      </button>
    </div>
  );
}
export default ActiveTabSwitch;
