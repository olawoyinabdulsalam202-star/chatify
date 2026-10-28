import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import { useStoryStore } from "../store/useStoryStore";
import { useCallStore } from "../store/useCallStore";
import { useFriendStore } from "../store/useFriendStore";
import { useLocation } from "react-router";

import Panel from "../components/Panel";
import ProfileHeader from "../components/ProfileHeader";
import ActiveTabSwitch from "../components/ActiveTabSwitch";
import ChatsList from "../components/ChatsList";
import GroupsList from "../components/GroupsList";
import AddPeopleModal from "../components/AddPeopleModal";
import ChatContainer from "../components/ChatContainer";
import GroupChatContainer from "../components/GroupChatContainer";
import NoConversationPlaceholder from "../components/NoConversationPlaceholder";
import StoryTray from "../components/StoryTray";
import StoryViewerModal from "../components/StoryViewerModal";

function ChatPage() {
  const activeTab = useChatStore((state) => state.activeTab);
  const selectedUser = useChatStore((state) => state.selectedUser);
  const chats = useChatStore((state) => state.chats);
  const setSelectedUser = useChatStore((state) => state.setSelectedUser);
  const setActiveTab = useChatStore((state) => state.setActiveTab);
  const selectedGroup = useGroupStore((state) => state.selectedGroup);
  const groups = useGroupStore((state) => state.groups);
  const setSelectedGroup = useGroupStore((state) => state.setSelectedGroup);
  const subscribeToGroupEvents = useGroupStore((state) => state.subscribeToGroupEvents);
  const unsubscribeFromGroupEvents = useGroupStore((state) => state.unsubscribeFromGroupEvents);
  const fetchMyGroupInvites = useGroupStore((state) => state.fetchMyGroupInvites);
  const getMyGroups = useGroupStore((state) => state.getMyGroups);
  const subscribeToStoryEvents = useStoryStore((state) => state.subscribeToStoryEvents);
  const unsubscribeFromStoryEvents = useStoryStore((state) => state.unsubscribeFromStoryEvents);
  const viewerIndex = useStoryStore((state) => state.viewerIndex);
  const location = useLocation();
  const fetchStatus = useFriendStore((state) => state.fetchStatus);
  const subscribeToFriendEvents = useFriendStore((state) => state.subscribeToFriendEvents);
  const unsubscribeFromFriendEvents = useFriendStore((state) => state.unsubscribeFromFriendEvents);
  const subscribeGlobalHandlers = useChatStore((state) => state.subscribeGlobalHandlers);
  const unsubscribeGlobalHandlers = useChatStore((state) => state.unsubscribeGlobalHandlers);

  // Story, friend-request, and group events need to work no matter which
  // tab/chat is open, so they're subscribed once at the page level rather than
  // per-conversation.
  //
  // Call events are deliberately NOT here — they're subscribed in App.jsx.
  // Leaving them on this page meant that navigating to Settings unmounted the
  // subscription, so an incoming call never reached the client at all.
  useEffect(() => {
    subscribeToStoryEvents();
    subscribeToFriendEvents();
    subscribeToGroupEvents();
    // Session-global DM handling: sound, unread badges, and chats-list ordering
    // for messages that arrive while you're looking at a different chat.
    subscribeGlobalHandlers();
    fetchStatus();
    getMyGroups();
    fetchMyGroupInvites();
    return () => {
      unsubscribeFromStoryEvents();
      unsubscribeFromFriendEvents();
      unsubscribeFromGroupEvents();
      unsubscribeGlobalHandlers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The DM and group selections are mutually exclusive — switching tabs
  // clears whichever one doesn't belong to the tab you switched to.
  useEffect(() => {
    if (activeTab === "groups") setSelectedUser(null);
    else setSelectedGroup(null);
  }, [activeTab, setSelectedUser, setSelectedGroup]);

  // Notification URLs carry the originating conversation id. Resolve it from
  // the normal loaded lists so a notification click behaves like Telegram,
  // including on a cold app start.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const dmId = params.get("dm");
    const groupId = params.get("group");
    if (dmId) {
      const chat = chats.find((item) => String(item._id) === String(dmId));
      if (chat && selectedUser?._id !== chat._id) setSelectedUser(chat);
    } else if (groupId) {
      const group = groups.find((item) => String(item._id) === String(groupId));
      if (group) {
        if (activeTab !== "groups") setActiveTab("groups");
        if (selectedGroup?._id !== group._id) setSelectedGroup(group);
      }
    }
  }, [location.search, chats, groups, selectedUser, selectedGroup, activeTab, setSelectedUser, setSelectedGroup, setActiveTab]);

  const showingGroup = activeTab === "groups" && selectedGroup;
  const showingChat = selectedUser || showingGroup;

  // Height tracks App.jsx's padding (p-2 on mobile, sm:p-4 above) so the chat
  // fills the screen without overflowing it. 100dvh — not 100vh — because vh on
  // mobile means the viewport with the URL bar hidden, which pushes the message
  // input off-screen until you scroll.
  return (
    <div className="relative w-full max-w-6xl min-h-0 h-[calc(100dvh-1rem)] sm:h-[calc(100dvh-2rem)] md:h-[800px]">
      <Panel>
        {/* LEFT SIDE - hidden on mobile when chat is open */}
        <div className={`${showingChat ? "hidden md:flex" : "flex"} min-h-0 w-full md:w-80 bg-slate-800 flex-col`}>
          <ProfileHeader />
          <StoryTray />
          <ActiveTabSwitch />
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {activeTab === "groups" ? <GroupsList /> : <ChatsList />}
          </div>
        </div>

        {/* RIGHT SIDE - hidden on mobile when no chat selected */}
        <div className={`${showingChat ? "flex" : "hidden md:flex"} min-w-0 min-h-0 flex-1 flex-col bg-slate-900`}>
          {selectedUser ? (
            <ChatContainer />
          ) : showingGroup ? (
            <GroupChatContainer />
          ) : (
            <NoConversationPlaceholder />
          )}
        </div>
      </Panel>

      {viewerIndex && <StoryViewerModal />}
      <AddPeopleModal />
      {/* IncomingCallModal and CallScreen are rendered at the app root (App.jsx)
          so a call is visible on every route, not just this page. */}
    </div>
  );
}
export default ChatPage;
