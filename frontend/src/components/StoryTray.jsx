import { useEffect, useRef, useState } from "react";
import { useStoryStore } from "../store/useStoryStore";
import { useAuthStore } from "../store/useAuthStore";
import { PlusIcon } from "lucide-react";
import CreateStoryModal from "./CreateStoryModal";
import VerifiedBadge from "./VerifiedBadge";

function StoryTray() {
  const { feed, myStories, getStoriesFeed, getMyStories, openViewer } = useStoryStore();
  const { authUser } = useAuthStore();
  const [showCreate, setShowCreate] = useState(false);
  const fetchedOnce = useRef(false);

  useEffect(() => {
    if (fetchedOnce.current) return;
    fetchedOnce.current = true;
    getStoriesFeed();
    getMyStories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center gap-3 px-4 py-3 overflow-x-auto border-b border-slate-700/50">
      <button
        onClick={() => (myStories.length > 0 ? openViewer("mine", 0) : setShowCreate(true))}
        className="flex flex-col items-center gap-1 shrink-0"
      >
        <div className="relative">
          <div
            className={`size-12 rounded-full p-0.5 ${
              myStories.length > 0 ? "bg-cyan-500" : "bg-slate-700"
            }`}
          >
            <img
              src={authUser.profilePic || "/avatar.svg"}
              alt="Your story"
              className="size-full rounded-full object-cover border-2 border-slate-800"
            />
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowCreate(true);
            }}
            className="absolute -bottom-0.5 -right-0.5 size-5 rounded-full bg-cyan-500 flex items-center justify-center border-2 border-slate-800"
          >
            <PlusIcon className="w-3 h-3 text-white" />
          </button>
        </div>
        <span className="text-[10px] text-slate-400">Your story</span>
      </button>

      {feed.map((group, index) => {
        const allViewed = group.stories.every((s) =>
          s.viewers?.some((v) => (v.userId?._id || v.userId) === authUser._id)
        );
        return (
          <button
            key={group.user._id}
            onClick={() => openViewer(index, 0)}
            className="flex flex-col items-center gap-1 shrink-0"
          >
            <div
              className={`size-12 rounded-full p-0.5 ${
                allViewed ? "bg-slate-700" : "bg-cyan-500"
              }`}
            >
              <img
                src={group.user.profilePic || "/avatar.svg"}
                alt={group.user.fullName}
                className="size-full rounded-full object-cover border-2 border-slate-800"
              />
            </div>
            <span className="text-[10px] text-slate-400 truncate max-w-[56px] flex items-center gap-0.5">
              {group.user.fullName.split(" ")[0]}
              {group.user.isBadged && <VerifiedBadge className="w-2.5 h-2.5" />}
            </span>
          </button>
        );
      })}

      {showCreate && <CreateStoryModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

export default StoryTray;
