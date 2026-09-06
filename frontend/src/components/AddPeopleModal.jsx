import { useEffect, useMemo, useRef, useState } from "react";
import { XIcon, SearchIcon, UserPlusIcon, MessageCircleIcon, LoaderIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useFriendStore } from "../store/useFriendStore";
import VerifiedBadge from "./VerifiedBadge";

function AddPeopleModal() {
  const { isAddPeopleOpen, closeAddPeople, setSelectedUser, setActiveTab, allContacts, getAllContacts } =
    useChatStore();
  const { friends, fetchStatus, searchUsers, addByUsername } = useFriendStore();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingId, setAddingId] = useState(null);
  const inputRef = useRef(null);

  // On open, pull the pieces the "your contacts" list is built from and focus
  // the box so a handle can be typed straight away.
  useEffect(() => {
    if (!isAddPeopleOpen) return;
    getAllContacts({ quiet: true });
    fetchStatus();
    setQuery("");
    setResults([]);
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [isAddPeopleOpen, getAllContacts, fetchStatus]);

  // Debounced typeahead: each keystroke resets the timer, so only a 300ms pause
  // actually queries the server rather than one request per character.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const t = setTimeout(async () => {
      const found = await searchUsers(q);
      setResults(found);
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query, searchUsers]);

  // Existing connections, resolved to full contact objects for display.
  const contacts = useMemo(() => {
    const friendSet = new Set(friends);
    return allContacts.filter((c) => friendSet.has(c._id));
  }, [allContacts, friends]);

  if (!isAddPeopleOpen) return null;

  const openChatWith = (user) => {
    setSelectedUser(user);
    setActiveTab("chats");
    closeAddPeople();
  };

  const handleAdd = async (user) => {
    setAddingId(user._id);
    const connected = await addByUsername(user.username);
    setAddingId(null);
    if (connected) openChatWith(connected);
  };

  const q = query.trim();

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 pt-20"
      onClick={closeAddPeople}
    >
      <div
        className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="text-slate-100 font-semibold">Add someone</h3>
          <button
            onClick={closeAddPeople}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-700/50">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
              placeholder="Enter a username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/60 pl-9 pr-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-500"
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Find people by their exact username. There's no public directory.
          </p>
        </div>

        <div className="overflow-y-auto flex-1 p-2">
          {q.length >= 2 ? (
            <>
              {isSearching && (
                <div className="flex items-center gap-2 text-slate-500 text-sm p-3">
                  <LoaderIcon className="w-4 h-4 animate-spin" /> Searching…
                </div>
              )}
              {!isSearching && results.length === 0 && (
                <p className="text-sm text-slate-500 p-3">No accounts match that username.</p>
              )}
              {results.map((u) => (
                <div
                  key={u._id}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-700/50"
                >
                  <img
                    src={u.profilePic || "/avatar.svg"}
                    alt={u.username}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 text-sm flex items-center gap-1">
                      <span className="truncate">@{u.username}</span>
                      {u.isBadged && <VerifiedBadge className="w-3.5 h-3.5" />}
                    </p>
                  </div>
                  {u.isFriend ? (
                    <button
                      onClick={() => openChatWith(u)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-medium transition-colors"
                    >
                      <MessageCircleIcon className="w-3.5 h-3.5" /> Message
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAdd(u)}
                      disabled={addingId === u._id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      {addingId === u._id ? (
                        <LoaderIcon className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserPlusIcon className="w-3.5 h-3.5" />
                      )}
                      Add
                    </button>
                  )}
                </div>
              ))}
            </>
          ) : (
            <>
              <p className="px-2.5 py-1.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Your contacts
              </p>
              {contacts.length === 0 ? (
                <p className="text-sm text-slate-500 p-3">
                  No contacts yet. Search a username above to add your first.
                </p>
              ) : (
                contacts.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => openChatWith(c)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-700/50 text-left transition-colors"
                  >
                    <img
                      src={c.profilePic || "/avatar.svg"}
                      alt={c.username || c.fullName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <span className="text-slate-200 text-sm flex items-center gap-1 min-w-0">
                      <span className="truncate">@{c.username || c.fullName}</span>
                      {c.isBadged && <VerifiedBadge className="w-3.5 h-3.5" />}
                    </span>
                  </button>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
export default AddPeopleModal;
