import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { useGroups } from '../../contexts/GroupContext';
import { banUserFromMarket, unbanUserFromMarket } from '../../services/api';
import type { Market, MarketBannedUser, User } from '../../types/firestore';

interface MarketBannedUsersProps {
  market: Market;
}

export function MarketBannedUsers({ market }: MarketBannedUsersProps) {
  const { user } = useAuth();
  const { memberships } = useGroups();
  const [bannedUsers, setBannedUsers] = useState<(MarketBannedUser & { userDisplayName?: string })[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Check if current user is admin for this market
  const isSiteAdmin = user?.isAdmin === true;
  const isGroupAdmin = market.groupId
    ? memberships.get(market.groupId)?.role === 'admin'
    : false;
  const canManageBans = isSiteAdmin || isGroupAdmin;

  // Fetch banned users for this market
  useEffect(() => {
    const bannedQuery = query(
      collection(db, 'marketBannedUsers'),
      where('marketId', '==', market.id)
    );

    const unsubscribe = onSnapshot(
      bannedQuery,
      async (snapshot) => {
        const bans = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as MarketBannedUser[];

        // Fetch user display names for banned users
        const bansWithNames = await Promise.all(
          bans.map(async (ban) => {
            const userDoc = await getDocs(
              query(collection(db, 'users'), where('uid', '==', ban.userId))
            );
            const userData = userDoc.docs[0]?.data() as User | undefined;
            return {
              ...ban,
              userDisplayName: userData?.displayName || userData?.email || ban.userId,
            };
          })
        );

        setBannedUsers(bansWithNames);
      },
      (error) => {
        console.error('Error fetching banned users:', error);
      }
    );

    return () => unsubscribe();
  }, [market.id]);

  // Fetch all users for the dropdown
  useEffect(() => {
    if (!showForm) return;

    const fetchUsers = async () => {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const users = usersSnapshot.docs.map(doc => doc.data() as User);
      // Filter out already banned users
      const bannedUserIds = new Set(bannedUsers.map(b => b.userId));
      const availableUsers = users.filter(u => !bannedUserIds.has(u.uid));
      setAllUsers(availableUsers);
    };

    fetchUsers();
  }, [showForm, bannedUsers]);

  if (!canManageBans) {
    return null;
  }

  const handleBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !reason.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await banUserFromMarket(market.id, selectedUserId, reason.trim());
      setSuccess('Bruker utestengt fra beten');
      setSelectedUserId('');
      setReason('');
      setShowForm(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Kunne ikke utestenge bruker');
    } finally {
      setLoading(false);
    }
  };

  const handleUnban = async (userId: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await unbanUserFromMarket(market.id, userId);
      setSuccess('Bruker fjernet fra utestengingslisten');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Kunne ikke fjerne utestengelse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Utestengte brukere</h3>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-sm px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
          >
            + Utesteng bruker
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
          {success}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleBan} className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Velg bruker
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              required
            >
              <option value="">Velg en bruker...</option>
              {allUsers.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.displayName || u.email}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Grunn for utestengelse
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="f.eks. Direkte involvert i utfallet"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              required
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !selectedUserId || !reason.trim()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
            >
              {loading ? 'Utestenger...' : 'Utesteng'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setSelectedUserId('');
                setReason('');
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Avbryt
            </button>
          </div>
        </form>
      )}

      {bannedUsers.length === 0 ? (
        <p className="text-sm text-gray-500">Ingen utestengte brukere for denne beten.</p>
      ) : (
        <ul className="space-y-2">
          {bannedUsers.map((ban) => (
            <li
              key={ban.id}
              className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
            >
              <div>
                <div className="font-medium text-gray-900">{ban.userDisplayName}</div>
                <div className="text-sm text-gray-600">Grunn: {ban.reason}</div>
                <div className="text-xs text-gray-500">
                  Utestengt {new Date(ban.bannedAt).toLocaleDateString('nb-NO')}
                </div>
              </div>
              <button
                onClick={() => handleUnban(ban.userId)}
                disabled={loading}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Fjern
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
