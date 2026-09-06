import { useEffect, useRef, useState } from "react";
import { XIcon, CameraIcon, UsersIcon, MegaphoneIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import VerifiedBadge from "./VerifiedBadge";

function CreateGroupModal({ onClose }) {
  const { allContacts, getAllContacts } = useChatStore();
  const { createGroup } = useGroupStore();

  const [step, setStep] = useState(1); // 1 = pick members, 2 = details
  const [selectedIds, setSelectedIds] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [type, setType] = useState("group");
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    getAllContacts();
  }, [getAllContacts]);

  const toggleMember = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setAvatar(reader.result);
    reader.readAsDataURL(file);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    const group = await createGroup({ name, description, avatar, type, memberIds: selectedIds });
    setIsCreating(false);
    if (group) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-800 border border-slate-700 rounded-lg w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
          <h3 className="text-slate-100 font-medium">
            {step === 1 ? "Invite members" : "Group details"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {step === 1 ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {allContacts.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">No contacts yet.</p>
              ) : (
                allContacts.map((c) => (
                  <label
                    key={c._id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(c._id)}
                      onChange={() => toggleMember(c._id)}
                      className="checkbox checkbox-sm checkbox-primary"
                    />
                    <img src={c.profilePic || "/avatar.svg"} alt={c.fullName} className="w-8 h-8 rounded-full" />
                    <span className="text-slate-200 text-sm flex items-center gap-1">
                      {c.fullName}
                      {c.isBadged && <VerifiedBadge className="w-3.5 h-3.5" />}
                    </span>
                  </label>
                ))
              )}
            </div>
            <div className="p-4 border-t border-slate-700/50">
              <button
                disabled={selectedIds.length === 0}
                onClick={() => setStep(2)}
                className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-2 font-medium"
              >
                Next ({selectedIds.length} invited)
              </button>
            </div>
          </>
        ) : (
          <div className="p-4 space-y-4 overflow-y-auto">
            <div className="flex justify-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="size-16 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden relative group"
              >
                {avatar ? (
                  <img src={avatar} alt="avatar" className="size-full object-cover" />
                ) : (
                  <CameraIcon className="w-6 h-6 text-slate-400" />
                )}
              </button>
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setType("group")}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm border ${
                  type === "group" ? "border-cyan-500 bg-cyan-500/10 text-cyan-300" : "border-slate-700 text-slate-400"
                }`}
              >
                <UsersIcon className="w-4 h-4" /> Group
              </button>
              <button
                onClick={() => setType("channel")}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm border ${
                  type === "channel" ? "border-cyan-500 bg-cyan-500/10 text-cyan-300" : "border-slate-700 text-slate-400"
                }`}
              >
                <MegaphoneIcon className="w-4 h-4" /> Channel
              </button>
            </div>
            <p className="text-xs text-slate-500 -mt-2">
              {type === "channel"
                ? "Only you (and other admins) can post. Everyone else can read."
                : "Anyone in the group can post."}
            </p>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-200"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 border border-slate-700 text-slate-300 rounded-lg py-2 text-sm"
              >
                Back
              </button>
              <button
                disabled={!name.trim() || isCreating}
                onClick={handleCreate}
                className="flex-1 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-medium"
              >
                {isCreating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CreateGroupModal;
