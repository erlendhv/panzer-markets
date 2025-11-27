import { Link } from "react-router-dom";
import { useGroups } from "../contexts/GroupContext";
import { useAuth } from "../hooks/useAuth";

interface SidebarProps {
  mobile?: boolean;
  onClose?: () => void;
  className?: string;
}

export function Sidebar({ mobile, onClose, className }: SidebarProps) {
  const { user } = useAuth();
  const {
    allGroups,
    myGroups,
    selectedGroupId,
    setSelectedGroupId,
    loading,
    memberships,
    pendingRequests,
  } = useGroups();

  if (!user) {
    return null;
  }

  const handleLinkClick = () => {
    if (mobile && onClose) {
      onClose();
    }
  };

  // Groups user is NOT a member of
  const otherGroups = allGroups.filter((g) => !memberships.has(g.id));

  const handleSelectGroup = (groupId: string | null) => {
    setSelectedGroupId(groupId);
  };

  // Mobile variant renders without the aside wrapper (content only)
  if (mobile) {
    return (
      <div className="p-4">
        <div className="space-y-1">
          {/* All Markets option */}
          <Link
            to="/"
            onClick={() => { handleSelectGroup(null); handleLinkClick(); }}
            className={`w-full block text-left px-3 py-3 rounded-lg text-base font-medium transition-colors ${
              selectedGroupId === null
                ? "bg-blue-50 text-blue-700"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            Alle bets
          </Link>

          {/* Public only option */}
          <Link
            to="/"
            onClick={() => { handleSelectGroup("public"); handleLinkClick(); }}
            className={`w-full block text-left px-3 py-3 rounded-lg text-base font-medium transition-colors ${
              selectedGroupId === "public"
                ? "bg-blue-50 text-blue-700"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            Kun offentlige bets
          </Link>

          {/* My Groups */}
          {myGroups.length > 0 && (
            <>
              <div className="pt-4 pb-1">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3">
                  Mine grupper
                </div>
              </div>
              {myGroups.map((group) => (
                <div
                  key={group.id}
                  className={`flex items-center justify-between px-3 py-3 rounded-lg text-base font-medium transition-colors ${
                    selectedGroupId === group.id
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Link
                    to="/"
                    onClick={() => { handleSelectGroup(group.id); handleLinkClick(); }}
                    className="flex-1 text-left truncate"
                  >
                    {group.name}
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {group.memberCount}
                    </span>
                    <Link
                      to={`/groups/${group.id}`}
                      onClick={handleLinkClick}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                      title="Gruppeinnstillinger"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </Link>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Create group link */}
          <div className="pt-4">
            <Link
              to="/groups/create"
              onClick={handleLinkClick}
              className="w-full flex items-center gap-2 px-3 py-3 rounded-lg text-base font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <span className="text-lg">+</span>
              <span>Opprett gruppe</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <aside className={`w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-64px)] p-4 ${className || ''}`}>
      <div className="space-y-1">
        {/* All Markets option */}
        <Link
          to="/"
          onClick={() => handleSelectGroup(null)}
          className={`w-full block text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedGroupId === null
              ? "bg-blue-50 text-blue-700"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          Alle bets
        </Link>

        {/* Public only option */}
        <Link
          to="/"
          onClick={() => handleSelectGroup("public")}
          className={`w-full block text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedGroupId === "public"
              ? "bg-blue-50 text-blue-700"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          Kun offentlige bets
        </Link>

        {/* My Groups */}
        {myGroups.length > 0 && (
          <>
            <div className="pt-4 pb-1">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3">
                Mine grupper
              </div>
            </div>
            {myGroups.map((group) => (
              <div
                key={group.id}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedGroupId === group.id
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Link
                  to="/"
                  onClick={() => handleSelectGroup(group.id)}
                  className="flex-1 text-left truncate"
                >
                  {group.name}
                </Link>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {group.memberCount}
                  </span>
                  <Link
                    to={`/groups/${group.id}`}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                    title="Gruppeinnstillinger"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Other Groups (not a member) */}
        {otherGroups.length > 0 && (
          <>
            <div className="pt-4 pb-1">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3">
                Andre grupper
              </div>
            </div>
            {loading ? (
              <div className="px-3 py-2 text-sm text-gray-500">Laster...</div>
            ) : (
              otherGroups.map((group) => {
                const hasPendingRequest = pendingRequests.has(group.id);

                // Site admins can view bets in any group
                if (user?.isAdmin) {
                  return (
                    <div
                      key={group.id}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedGroupId === group.id
                          ? "bg-blue-50 text-blue-700"
                          : "text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      <Link
                        to="/"
                        onClick={() => handleSelectGroup(group.id)}
                        className="flex-1 text-left truncate"
                      >
                        {group.name}
                      </Link>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          {group.memberCount}
                        </span>
                        <Link
                          to={`/groups/${group.id}`}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                          title="Gruppeinnstillinger"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  );
                }

                // Non-admin: link to group page to request joining
                return (
                  <Link
                    key={group.id}
                    to={`/groups/${group.id}`}
                    className="w-full block text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{group.name}</span>
                      <div className="flex items-center gap-1">
                        {group.isOpen && (
                          <span className="text-xs text-green-600" title="Åpen gruppe">
                            Åpen
                          </span>
                        )}
                        {hasPendingRequest ? (
                          <span className="text-xs text-yellow-600">Venter</span>
                        ) : (
                          <span className="text-xs text-gray-400">
                            {group.memberCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </>
        )}

        {/* Create group link */}
        <div className="pt-4">
          <Link
            to="/groups/create"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <span className="text-lg">+</span>
            <span>Opprett gruppe</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
