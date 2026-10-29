import { useCallback, useEffect, useRef, useState } from "react";
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
import AssistantFloatingButton from "../components/AssistantFloatingButton";
import AssistantListRow from "../components/AssistantListRow";
import AssistantChat from "../components/AssistantChat";
import { useAssistantStore } from "../store/useAssistantStore";
import { useSidebarWidth } from "../hooks/useSidebarWidth";

function ChatPage() {
  const { width: sidebarWidth, maxWidth: sidebarMaxWidth, setWidth, persistWidth, clampWidth } = useSidebarWidth();
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const sidebarDragRef = useRef(null);
  const activeTab = useChatStore((state) => state.activeTab);
  const selectedUser = useChatStore((state) => state.selectedUser);
  const chats = useChatStore((state) => state.chats);
  const setSelectedUser = useChatStore((state) => state.setSelectedUser);
  const setActiveTab = useChatStore((state) => state.setActiveTab);
  const assistantOpen = useAssistantStore((state) => state.isOpen);
  const closeAssistant = useAssistantStore((state) => state.close);
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

  const finishSidebarResize = useCallback(() => {
    const drag = sidebarDragRef.current;
    if (!drag) return;
    if (drag.frame) cancelAnimationFrame(drag.frame);
    setWidth(drag.nextWidth);
    persistWidth(drag.nextWidth);
    sidebarDragRef.current = null;
    setIsResizingSidebar(false);
    document.body.classList.remove("sidebar-resizing");
  }, [persistWidth, setWidth]);

  useEffect(() => () => {
    if (sidebarDragRef.current?.frame) cancelAnimationFrame(sidebarDragRef.current.frame);
    document.body.classList.remove("sidebar-resizing");
  }, []);

  const startSidebarResize = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    sidebarDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: sidebarWidth,
      nextWidth: sidebarWidth,
      frame: null,
    };
    setIsResizingSidebar(true);
    document.body.classList.add("sidebar-resizing");
  };

  const moveSidebarResize = (event) => {
    const drag = sidebarDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.nextWidth = clampWidth(drag.startWidth + event.clientX - drag.startX);
    if (!drag.frame) {
      drag.frame = requestAnimationFrame(() => {
        const currentDrag = sidebarDragRef.current;
        if (!currentDrag) return;
        currentDrag.frame = null;
        setWidth(currentDrag.nextWidth);
      });
    }
  };

  const resizeSidebarWithKeyboard = (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const nextWidth = clampWidth(sidebarWidth + (event.key === "ArrowRight" ? 16 : -16));
    setWidth(nextWidth);
    persistWidth(nextWidth);
  };

  const resetSidebarWidth = () => {
    const defaultWidth = clampWidth(Math.max(320, Math.round(window.innerWidth * 0.38)));
    setWidth(defaultWidth);
    persistWidth(defaultWidth);
  };

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
    if (assistantOpen) return;
    if (activeTab === "groups") setSelectedUser(null);
    else setSelectedGroup(null);
  }, [activeTab, assistantOpen, setSelectedUser, setSelectedGroup]);

  useEffect(() => {
    if (assistantOpen && (selectedUser || selectedGroup)) closeAssistant();
  }, [assistantOpen, selectedUser, selectedGroup, closeAssistant]);

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
  const showingChat = Boolean(selectedUser || showingGroup || assistantOpen);
  const showAssistantButton = !selectedUser && !showingGroup && !assistantOpen;

  // The app-height variable follows the visible viewport as browser chrome or
  // the soft keyboard changes the available height.
  return (
    <div className="relative w-full max-w-6xl md:max-w-none min-h-0 h-[var(--app-h,100dvh)] max-h-none md:h-full md:max-h-[920px]">
      <Panel
        className="rounded-none border-0 md:rounded-2xl md:border md:grid md:grid-cols-[var(--sidebar-w)_6px_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)]"
        style={{ "--sidebar-w": `${sidebarWidth}px` }}
      >
        {/* LEFT SIDE - hidden on mobile when chat is open */}
        <div className={`relative ${showingChat ? "hidden md:flex" : "flex"} min-h-0 min-w-0 w-full md:w-auto bg-slate-800 flex-col pt-[env(safe-area-inset-top)] md:pt-0`}>
          <div className="shrink-0"><ProfileHeader /></div>
          <div className="shrink-0"><StoryTray /></div>
          <div className="shrink-0"><ActiveTabSwitch /></div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] space-y-2">
            {activeTab === "groups" ? (
              <GroupsList />
            ) : (
              <>
                <AssistantListRow />
                <ChatsList />
              </>
            )}
          </div>
          {showAssistantButton && <AssistantFloatingButton />}
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={sidebarWidth}
          aria-valuemin={320}
          aria-valuemax={sidebarMaxWidth}
          aria-label="Resize chat list"
          tabIndex={0}
          onPointerDown={startSidebarResize}
          onPointerMove={moveSidebarResize}
          onPointerUp={finishSidebarResize}
          onPointerCancel={finishSidebarResize}
          onLostPointerCapture={finishSidebarResize}
          onDoubleClick={resetSidebarWidth}
          onKeyDown={resizeSidebarWithKeyboard}
          className={`group hidden md:flex h-full w-[6px] cursor-col-resize touch-none items-center justify-center outline-none ${
            isResizingSidebar ? "bg-slate-800" : "bg-transparent hover:bg-slate-800/70 focus-visible:bg-slate-800/70"
          }`}
        >
          <span className={`h-full w-px transition-colors ${
            isResizingSidebar ? "bg-cyan-400" : "bg-slate-700 group-hover:bg-cyan-500 group-focus-visible:bg-cyan-500"
          }`} />
        </div>

        {/* RIGHT SIDE - hidden on mobile when no chat selected */}
        <div className={`${showingChat ? "flex" : "hidden md:flex"} min-w-0 min-h-0 w-full md:w-auto flex-1 flex-col bg-slate-900 pt-[env(safe-area-inset-top)] md:pt-0`}>
          {assistantOpen ? (
            <AssistantChat />
          ) : selectedUser ? (
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
