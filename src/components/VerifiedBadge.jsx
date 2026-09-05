import { BadgeCheckIcon } from "lucide-react";

// Small verified badge shown next to badged users' names, and next to
// groups/channels created by a badged user.
function VerifiedBadge({ className = "w-4 h-4" }) {
  return (
    <BadgeCheckIcon
      className={`text-cyan-400 shrink-0 ${className}`}
      title="Verified"
    />
  );
}

export default VerifiedBadge;
