import { useEffect } from "react";
import { useFriendStore } from "../store/useFriendStore";
import { CheckIcon, XIcon, UserPlusIcon } from "lucide-react";
import VerifiedBadge from "./VerifiedBadge";

function FriendRequestsList() {
  const { receivedPending, respondToRequest, fetchStatus, isLoading } = useFriendStore();

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (isLoading && receivedPending.length === 0) {
    return <p className="text-slate-500 text-sm text-center mt-6">Loading requests…</p>;
  }

  if (receivedPending.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center mt-10 gap-2">
        <UserPlusIcon className="size-8 text-slate-600" />
        <p className="text-slate-500 text-sm">No pending friend requests</p>
      </div>
    );
  }

  return (
    <>
      {receivedPending.map((req) => (
        <div key={req.requestId} className="bg-cyan-500/10 p-4 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="avatar">
              <div className="size-12 rounded-full">
                <img src={req.from.profilePic || "/avatar.svg"} alt={req.from.fullName} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-slate-200 font-medium truncate flex items-center gap-1">
                {req.from.fullName || "Someone"}
                {req.from.isBadged && <VerifiedBadge className="w-3.5 h-3.5" />}
              </h4>
              <p className="text-xs text-slate-500">wants to be friends</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => respondToRequest(req.requestId, "accept")}
                className="p-2 rounded-full bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 transition-colors"
                title="Accept"
              >
                <CheckIcon className="size-4" />
              </button>
              <button
                onClick={() => respondToRequest(req.requestId, "decline")}
                className="p-2 rounded-full bg-slate-700/50 hover:bg-slate-700 text-slate-400 transition-colors"
                title="Decline"
              >
                <XIcon className="size-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
export default FriendRequestsList;
