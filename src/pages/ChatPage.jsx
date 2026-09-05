import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import { useStoryStore } from "../store/useStoryStore";
import { useCallStore } from "../store/useCallStore";
import { useFriendStore } from "../store/useFriendStore";

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
  const { activeTab, selectedUser, setSelectedUser } = useChatStore();
  const {
    selectedGroup,
    setSelectedGroup,
    subscribeToGroupEvents,
    unsubscribeFromGroupEvents,
    fetchMyGroupInvites,
    getMyGroups,
  } = useGroupStore();
  const { subscribeToStoryEvents, unsubscribeFromStoryEvents, viewerIndex } = useStoryStore();
  const { fetchStatus, subscribeToFriendEvents, unsubscribeFromFriendEvents } = useFriendStore();
  const { subscribeGlobalHandlers, unsubscribeGlobalHandlers } = useChatStore();

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

  const showingGroup = activeTab === "groups" && selectedGroup;
  const showingChat = selectedUser || showingGroup;

  // Height tracks App.jsx's padding (p-2 on mobile, sm:p-4 above) so the chat
  // fills the screen without overflowing it. 100dvh — not 100vh — because vh on
  // mobile means the viewport with the URL bar hidden, which pushes the message
  // input off-screen until you scroll.
  return (
    <div className="relative w-full max-w-6xl h-[calc(100dvh-1rem)] sm:h-[calc(100dvh-2rem)] md:h-[800px]">
      <Panel>
        {/* LEFT SIDE - hidden on mobile when chat is open */}
        <div className={`${showingChat ? "hidden md:flex" : "flex"} w-full md:w-80 bg-slate-800 flex-col`}>
          <ProfileHeader />
          <StoryTray />
          <ActiveTabSwitch />
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {activeTab === "groups" ? <GroupsList /> : <ChatsList />}
          </div>
        </div>

        {/* RIGHT SIDE - hidden on mobile when no chat selected */}
        <div className={`${showingChat ? "flex" : "hidden md:flex"} flex-1 flex-col bg-slate-900`}>
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