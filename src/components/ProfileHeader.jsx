import { useState, useRef } from "react";
import { VolumeOffIcon, Volume2Icon, SettingsIcon, ShieldIcon, UserPlusIcon } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { Link } from "react-router";
import VerifiedBadge from "./VerifiedBadge";

const mouseClickSound = new Audio("/sounds/mouse-click.mp3");

function ProfileHeader() {
  const { authUser, updateProfile } = useAuthStore();
  const { isSoundEnabled, toggleSound, openAddPeople } = useChatStore();
  const [selectedImg, setSelectedImg] = useState(null);

  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onloadend = async () => {
      const base64Image = reader.result;
      setSelectedImg(base64Image);
      await updateProfile({ profilePic: base64Image });
    };
  };

  return (
    <div className="p-6 border-b border-slate-700/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* AVATAR */}
          <div className="avatar online">
            <button
              className="size-14 rounded-full overflow-hidden relative group"
              onClick={() => fileInputRef.current.click()}
            >
              <img
                src={selectedImg || authUser.profilePic || "/avatar.svg"}
                alt="User image"
                className="size-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="text-white text-xs">Change</span>
              </div>
            </button>

            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          {/* USERNAME & ONLINE TEXT */}
          <div className="min-w-0">
            <h3 className="text-slate-200 font-medium text-base truncate flex items-center gap-1">
              {authUser.fullName}
              {authUser.isBadged && <VerifiedBadge className="w-4 h-4 shrink-0" />}
            </h3>

            <p className="text-slate-400 text-xs">Online</p>
          </div>
        </div>

        {/* BUTTONS */}
        <div className="flex gap-4 items-center shrink-0 pl-2">
          {/* ADD PEOPLE BTN */}
          <button
            onClick={openAddPeople}
            className="text-cyan-400 hover:text-cyan-300 transition-colors"
            title="Add someone"
          >
            <UserPlusIcon className="size-5" />
          </button>

          {/* ADMIN BTN */}
          {authUser.isAdmin && (
            <Link to="/admin" className="text-slate-400 hover:text-cyan-400 transition-colors" title="Admin dashboard">
              <ShieldIcon className="size-5" />
            </Link>
          )}

          {/* SETTINGS BTN */}
          <Link to="/settings" className="text-slate-400 hover:text-slate-200 transition-colors">
            <SettingsIcon className="size-5" />
          </Link>

          {/* SOUND TOGGLE BTN */}
          <button
            className="text-slate-400 hover:text-slate-200 transition-colors"
            onClick={() => {
              // play click sound before toggling
              mouseClickSound.currentTime = 0; // reset to start
              mouseClickSound.play().catch((error) => console.log("Audio play failed:", error));
              toggleSound();
            }}
          >
            {isSoundEnabled ? (
              <Volume2Icon className="size-5" />
            ) : (
              <VolumeOffIcon className="size-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
export default ProfileHeader;