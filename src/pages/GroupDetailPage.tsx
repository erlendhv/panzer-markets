import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useGroups } from '../contexts/GroupContext';
import type { Group, GroupMember, GroupJoinRequest, User } from '../types/firestore';

interface MemberWithUser extends GroupMember {
  user: User | null;
}

interface JoinRequestWithUser extends GroupJoinRequest {
  user: User | null;
}

export function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const { memberships, pendingRequests } = useGroups();
  const navigate = useNavigate();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequestWithUser[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinMessage, setJoinMessage] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  const currentMembership = groupId ? memberships.get(groupId) : null;
  const isMember = !!currentMembership;
  const isAdmin = currentMembership?.role === 'admin' || user?.isAdmin;
  const hasPendingRequest = groupId ? pendingRequests.has(groupId) : false;

  // Get users who are not already members
  const memberUserIds = new Set(members.map(m => m.userId));
  const availableUsers = allUsers.filter(u => !memberUserIds.has(u.uid));

  useEffect(() => {
    if (!groupId) return;

    const fetchGroupAndMembers = async () => {
      try {
        // Fetch group
        const groupDoc = await getDoc(doc(db, 'groups', groupId));
        if (!groupDoc.exists()) {
          setLoading(false);
          return;
        }
        setGroup({ id: groupDoc.id, ...groupDoc.data() } as Group);

        // Fetch all users
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersList = usersSnapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data(),
        })) as User[];
        setAllUsers(usersList);

        // Fetch members
        const membersQuery = query(
          collection(db, 'groupMembers'),
          where('groupId', '==', groupId)
        );
        const membersSnapshot = await getDocs(membersQuery);
        const membersList = membersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as GroupMember[];

        // Fetch user details for each member
        const membersWithUsers: MemberWithUser[] = await Promise.all(
          membersList.map(async (member) => {
            const userDoc = await getDoc(doc(db, 'users', member.userId));
            return {
              ...member,
              user: userDoc.exists() ? { uid: userDoc.id, ...userDoc.data() } as User : null,
            };
          })
        );

        // Sort: admins first, then by join date
        membersWithUsers.sort((a, b) => {
          if (a.role === 'admin' && b.role !== 'admin') return -1;
          if (a.role !== 'admin' && b.role === 'admin') return 1;
          return a.joinedAt - b.joinedAt;
        });

        setMembers(membersWithUsers);

        // Fetch pending join requests
        const requestsQuery = query(
          collection(db, 'groupJoinRequests'),
          where('groupId', '==', groupId),
          where('status', '==', 'pending')
        );
        const requestsSnapshot = await getDocs(requestsQuery);
        const requestsList = requestsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as GroupJoinRequest[];

        // Add user info to requests
        const requestsWithUsers: JoinRequestWithUser[] = await Promise.all(
          requestsList.map(async (request) => {
            const userDoc = await getDoc(doc(db, 'users', request.userId));
            return {
              ...request,
              user: userDoc.exists() ? { uid: userDoc.id, ...userDoc.data() } as User : null,
            };
          })
        );

        setJoinRequests(requestsWithUsers);
      } catch (err) {
        console.error('Error fetching group:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchGroupAndMembers();
  }, [groupId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !groupId || !selectedUserId) return;

    setInviteError(null);
    setInviteSuccess(false);
    setActionLoading('invite');

    try {
      const response = await fetch('/api/inviteToGroup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.uid,
        },
        body: JSON.stringify({
          groupId,
          inviteeUserId: selectedUserId,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to invite user');
      }

      setInviteSuccess(true);
      setSelectedUserId('');

      // Refresh members list
      window.location.reload();
    } catch (err: any) {
      setInviteError(err.message || 'Failed to invite user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestToJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !groupId || !joinMessage.trim()) return;

    setJoinError(null);
    setActionLoading('request');

    try {
      const response = await fetch('/api/requestToJoinGroup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.uid,
        },
        body: JSON.stringify({ groupId, message: joinMessage }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to request to join');
      }

      // Refresh page to show updated status
      window.location.reload();
    } catch (err: any) {
      setJoinError(err.message || 'Failed to request to join');
    } finally {
      setActionLoading(null);
    }
  };

  const handleJoinRequestAction = async (targetUserId: string, action: 'approve' | 'deny') => {
    if (!user || !groupId) return;

    setActionLoading(`${action}-${targetUserId}`);

    try {
      const response = await fetch('/api/handleJoinRequest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.uid,
        },
        body: JSON.stringify({
          groupId,
          targetUserId,
          action,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to handle request');
      }

      // Refresh page
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Failed to handle request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!user || !groupId) return;
    if (!confirm('Er du sikker på at du vil fjerne dette medlemmet?')) return;

    setActionLoading(targetUserId);

    try {
      const response = await fetch('/api/removeFromGroup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.uid,
        },
        body: JSON.stringify({
          groupId,
          targetUserId,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to remove member');
      }

      // Update local state
      setMembers(members.filter(m => m.userId !== targetUserId));
    } catch (err: any) {
      alert(err.message || 'Failed to remove member');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateRole = async (targetUserId: string, newRole: 'admin' | 'member') => {
    if (!user || !groupId) return;

    setActionLoading(targetUserId);

    try {
      const response = await fetch('/api/updateGroupRole', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.uid,
        },
        body: JSON.stringify({
          groupId,
          targetUserId,
          newRole,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update role');
      }

      // Update local state
      setMembers(members.map(m =>
        m.userId === targetUserId ? { ...m, role: newRole } : m
      ));
    } catch (err: any) {
      alert(err.message || 'Failed to update role');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLeaveGroup = async () => {
    if (!user || !groupId) return;
    if (!confirm('Er du sikker på at du vil forlate denne gruppen?')) return;

    setActionLoading('leave');

    try {
      const response = await fetch('/api/leaveGroup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.uid,
        },
        body: JSON.stringify({ groupId }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to leave group');
      }

      navigate('/');
    } catch (err: any) {
      alert(err.message || 'Failed to leave group');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Gruppe ikke funnet</h2>
        <p className="text-gray-600">Denne gruppen eksisterer ikke eller du har ikke tilgang.</p>
      </div>
    );
  }

  // Non-member view - show request to join
  if (!isMember && !user?.isAdmin) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">{group.name}</h2>
        {group.description && (
          <p className="text-gray-600 mb-4">{group.description}</p>
        )}
        <p className="text-sm text-gray-500 mb-6">
          {group.memberCount} {group.memberCount === 1 ? 'medlem' : 'medlemmer'}
        </p>

        {hasPendingRequest ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">
              Du har allerede bedt om å bli med. Venter på godkjenning fra admin.
            </p>
          </div>
        ) : (
          <button
            onClick={() => setShowJoinModal(true)}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Be om å bli med
          </button>
        )}

        {/* Join request modal */}
        {showJoinModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 text-left">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Be om å bli med i {group.name}</h3>
              <form onSubmit={handleRequestToJoin}>
                <div className="mb-4">
                  <label htmlFor="joinMessage" className="block text-sm font-medium text-gray-700 mb-2">
                    Skriv en melding til admin
                  </label>
                  <textarea
                    id="joinMessage"
                    value={joinMessage}
                    onChange={(e) => setJoinMessage(e.target.value)}
                    placeholder="Fortell hvorfor du vil bli med i gruppen..."
                    required
                    maxLength={500}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">{joinMessage.length}/500 tegn</p>
                </div>
                {joinError && (
                  <p className="text-sm text-red-600 mb-4">{joinError}</p>
                )}
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowJoinModal(false);
                      setJoinMessage('');
                      setJoinError(null);
                    }}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Avbryt
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading === 'request' || !joinMessage.trim()}
                    className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                  >
                    {actionLoading === 'request' ? 'Sender...' : 'Send forespørsel'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{group.name}</h1>
        {group.description && (
          <p className="text-gray-600">{group.description}</p>
        )}
        <p className="text-sm text-gray-500 mt-2">
          {group.memberCount} {group.memberCount === 1 ? 'medlem' : 'medlemmer'}
        </p>
      </div>

      {/* Invite form (for members) */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Inviter medlem</h2>
        {availableUsers.length > 0 ? (
          <form onSubmit={handleInvite} className="flex gap-4">
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              required
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Velg bruker...</option>
              {availableUsers.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.displayName || u.email}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={actionLoading === 'invite' || !selectedUserId}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {actionLoading === 'invite' ? 'Inviterer...' : 'Inviter'}
            </button>
          </form>
        ) : (
          <p className="text-gray-500">Alle brukere er allerede medlemmer av denne gruppen.</p>
        )}
        {inviteError && (
          <p className="mt-2 text-sm text-red-600">{inviteError}</p>
        )}
        {inviteSuccess && (
          <p className="mt-2 text-sm text-green-600">Bruker lagt til!</p>
        )}
      </div>

      {/* Pending join requests (for admins) */}
      {isAdmin && joinRequests.length > 0 && (
        <div className="bg-white rounded-lg border border-yellow-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Ventende forespørsler ({joinRequests.length})
          </h2>
          <div className="space-y-4">
            {joinRequests.map((request) => (
              <div
                key={request.id}
                className="py-4 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {request.user?.photoURL ? (
                      <img
                        src={request.user.photoURL}
                        alt=""
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-500 text-sm">
                          {request.user?.displayName?.[0] || '?'}
                        </span>
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-gray-900">
                        {request.user?.displayName || request.user?.email || 'Ukjent bruker'}
                      </div>
                      <div className="text-sm text-gray-500">
                        Ba om å bli med {new Date(request.requestedAt).toLocaleDateString('nb-NO')}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleJoinRequestAction(request.userId, 'approve')}
                      disabled={actionLoading === `approve-${request.userId}`}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                    >
                      {actionLoading === `approve-${request.userId}` ? '...' : 'Godkjenn'}
                    </button>
                    <button
                      onClick={() => handleJoinRequestAction(request.userId, 'deny')}
                      disabled={actionLoading === `deny-${request.userId}`}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 transition-colors"
                    >
                      {actionLoading === `deny-${request.userId}` ? '...' : 'Avslå'}
                    </button>
                  </div>
                </div>
                {request.message && (
                  <div className="ml-13 pl-13 bg-gray-50 rounded-lg p-3 mt-2">
                    <p className="text-sm text-gray-600 italic">"{request.message}"</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members list */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Medlemmer</h2>
        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
            >
              <div className="flex items-center gap-3">
                {member.user?.photoURL ? (
                  <img
                    src={member.user.photoURL}
                    alt=""
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-500 text-sm">
                      {member.user?.displayName?.[0] || '?'}
                    </span>
                  </div>
                )}
                <div>
                  <div className="font-medium text-gray-900">
                    {member.user?.displayName || member.user?.email || 'Ukjent bruker'}
                    {member.userId === user?.uid && (
                      <span className="ml-2 text-xs text-gray-500">(deg)</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {member.role === 'admin' ? (
                      <span className="text-blue-600 font-medium">Admin</span>
                    ) : (
                      'Medlem'
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              {isAdmin && member.userId !== user?.uid && (
                <div className="flex gap-2">
                  {member.role === 'member' ? (
                    <button
                      onClick={() => handleUpdateRole(member.userId, 'admin')}
                      disabled={actionLoading === member.userId}
                      className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      Gjør admin
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUpdateRole(member.userId, 'member')}
                      disabled={actionLoading === member.userId}
                      className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    >
                      Fjern admin
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveMember(member.userId)}
                    disabled={actionLoading === member.userId}
                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    Fjern
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Leave group */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Forlat gruppe</h2>
        <p className="text-gray-600 mb-4">
          Hvis du forlater gruppen vil du ikke lenger se bets i denne gruppen.
        </p>
        <button
          onClick={handleLeaveGroup}
          disabled={actionLoading === 'leave'}
          className="px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors"
        >
          {actionLoading === 'leave' ? 'Forlater...' : 'Forlat gruppe'}
        </button>
      </div>
    </div>
  );
}
