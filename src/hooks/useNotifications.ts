import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useUserCache } from '../contexts/UserCacheContext';
import type { Position, Market, GroupJoinRequest, Group, GroupMember, User } from '../types/firestore';

export interface Notification {
  id: string;
  type: 'bet_won' | 'bet_lost' | 'bet_invalid' | 'group_accepted' | 'group_rejected' | 'join_request';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  groupId?: string; // For join_request notifications
}

const DISMISSED_KEY = 'panzer_dismissed_notifications';

function getDismissedIds(): Set<string> {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissedIds(ids: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

// Accept positions as a parameter to avoid duplicate reads (positions already fetched by useUserPositions)
export function useNotifications(userId: string | undefined, positions: Position[]) {
  const { getUsers } = useUserCache();
  const [resolvedMarkets, setResolvedMarkets] = useState<Map<string, Market>>(new Map());
  const [groupRequests, setGroupRequests] = useState<GroupJoinRequest[]>([]);
  const [groups, setGroups] = useState<Map<string, Group>>(new Map());
  const [loading, setLoading] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => getDismissedIds());

  // Admin notification state
  const [adminMemberships, setAdminMemberships] = useState<GroupMember[]>([]);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<GroupJoinRequest[]>([]);
  const [requesters, setRequesters] = useState<Map<string, User>>(new Map());

  // Fetch resolved markets for user's positions (one-time fetch - resolved markets don't change)
  useEffect(() => {
    if (positions.length === 0) {
      setResolvedMarkets(new Map());
      setLoading(false);
      return;
    }

    const marketIds = [...new Set(positions.map(p => p.marketId))];

    const fetchResolvedMarkets = async () => {
      const newMap = new Map<string, Market>();

      // Firestore 'in' queries are limited to 30 items
      for (let i = 0; i < marketIds.length; i += 30) {
        const chunk = marketIds.slice(i, i + 30);
        const q = query(
          collection(db, 'markets'),
          where('__name__', 'in', chunk),
          where('status', '==', 'resolved')
        );
        const snapshot = await getDocs(q);
        snapshot.docs.forEach((doc) => {
          newMap.set(doc.id, { id: doc.id, ...doc.data() } as Market);
        });
      }

      setResolvedMarkets(newMap);
      setLoading(false);
    };

    fetchResolvedMarkets();
  }, [positions]);

  // Fetch user's reviewed (approved/denied) group join requests
  useEffect(() => {
    if (!userId) {
      setGroupRequests([]);
      return;
    }

    const q = query(
      collection(db, 'groupJoinRequests'),
      where('userId', '==', userId),
      where('status', 'in', ['approved', 'denied'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as GroupJoinRequest[];
      setGroupRequests(requests);
    });

    return unsubscribe;
  }, [userId]);

  // Fetch group names for all requests (consolidated - was two separate effects)
  useEffect(() => {
    // Collect group IDs from both user's requests and pending admin requests
    const allGroupIds = new Set<string>([
      ...groupRequests.map(r => r.groupId),
      ...pendingJoinRequests.map(r => r.groupId),
    ]);

    if (allGroupIds.size === 0) {
      return;
    }

    const groupIdsArray = [...allGroupIds];

    const fetchGroups = async () => {
      const fetchedGroups = new Map<string, Group>();

      // Firestore 'in' queries limited to 30 items, chunk if needed
      for (let i = 0; i < groupIdsArray.length; i += 30) {
        const chunk = groupIdsArray.slice(i, i + 30);
        const q = query(
          collection(db, 'groups'),
          where('__name__', 'in', chunk)
        );
        const snapshot = await getDocs(q);
        snapshot.docs.forEach((doc) => {
          fetchedGroups.set(doc.id, { id: doc.id, ...doc.data() } as Group);
        });
      }

      setGroups(fetchedGroups);
    };

    fetchGroups();
  }, [groupRequests, pendingJoinRequests]);

  // Fetch groups where user is admin (for join request notifications)
  useEffect(() => {
    if (!userId) {
      setAdminMemberships([]);
      return;
    }

    const q = query(
      collection(db, 'groupMembers'),
      where('userId', '==', userId),
      where('role', '==', 'admin')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const memberships = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as GroupMember[];
      setAdminMemberships(memberships);
    });

    return unsubscribe;
  }, [userId]);

  // Fetch pending join requests for groups the user admins
  useEffect(() => {
    if (adminMemberships.length === 0) {
      setPendingJoinRequests([]);
      return;
    }

    const adminGroupIds = adminMemberships.map(m => m.groupId);

    // Firestore 'in' queries are limited to 30 items
    const chunks: string[][] = [];
    for (let i = 0; i < adminGroupIds.length; i += 30) {
      chunks.push(adminGroupIds.slice(i, i + 30));
    }

    const unsubscribes: (() => void)[] = [];

    chunks.forEach((chunk) => {
      const q = query(
        collection(db, 'groupJoinRequests'),
        where('groupId', 'in', chunk),
        where('status', '==', 'pending')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const requests = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as GroupJoinRequest[];
        setPendingJoinRequests(requests);
      });

      unsubscribes.push(unsubscribe);
    });

    return () => unsubscribes.forEach(u => u());
  }, [adminMemberships]);

  // Fetch user info for pending join requesters (using cache)
  useEffect(() => {
    if (pendingJoinRequests.length === 0) {
      setRequesters(new Map());
      return;
    }

    const userIds = [...new Set(pendingJoinRequests.map(r => r.userId))];

    // Use the shared user cache to avoid duplicate reads
    getUsers(userIds).then((users) => {
      setRequesters(users);
    });
  }, [pendingJoinRequests, getUsers]);

  // Build notifications from the data
  const notifications = useMemo<Notification[]>(() => {
    const notifs: Notification[] = [];

    // Add bet outcome notifications
    positions.forEach((position) => {
      const market = resolvedMarkets.get(position.marketId);
      if (!market || !market.resolutionOutcome) return;

      const hasYesShares = position.yesShares > 0;
      const hasNoShares = position.noShares > 0;

      if (!hasYesShares && !hasNoShares) return;

      let type: Notification['type'];
      let title: string;
      let message: string;

      if (market.resolutionOutcome === 'INVALID') {
        type = 'bet_invalid';
        title = 'Marked ugyldig';
        message = `"${market.question}" ble erklært ugyldig. Innsatsen din er refundert.`;
      } else {
        const userWon = (market.resolutionOutcome === 'YES' && hasYesShares) ||
                       (market.resolutionOutcome === 'NO' && hasNoShares);

        if (userWon) {
          type = 'bet_won';
          title = 'Du vant!';
          const payout = market.resolutionOutcome === 'YES'
            ? position.yesShares
            : position.noShares;
          message = `"${market.question}" ble avgjort ${market.resolutionOutcome}. Du vant $${payout.toFixed(2)}!`;
        } else {
          type = 'bet_lost';
          title = 'Du tapte';
          message = `"${market.question}" ble avgjort ${market.resolutionOutcome}. Lykke til neste gang!`;
        }
      }

      notifs.push({
        id: `bet_${position.marketId}`,
        type,
        title,
        message,
        timestamp: market.resolvedAt || market.createdAt,
        read: false,
      });
    });

    // Add group request notifications
    groupRequests.forEach((request) => {
      const group = groups.get(request.groupId);
      const groupName = group?.name || 'gruppen';

      if (request.status === 'approved') {
        notifs.push({
          id: `group_${request.id}`,
          type: 'group_accepted',
          title: 'Godkjent',
          message: `Din forespørsel om å bli med i "${groupName}" ble godkjent!`,
          timestamp: request.reviewedAt || request.requestedAt,
          read: false,
        });
      } else if (request.status === 'denied') {
        notifs.push({
          id: `group_${request.id}`,
          type: 'group_rejected',
          title: 'Avslått',
          message: `Din forespørsel om å bli med i "${groupName}" ble avslått.`,
          timestamp: request.reviewedAt || request.requestedAt,
          read: false,
        });
      }
    });

    // Add pending join request notifications for admins
    pendingJoinRequests.forEach((request) => {
      const group = groups.get(request.groupId);
      const groupName = group?.name || 'gruppen';
      const requester = requesters.get(request.userId);
      const requesterName = requester?.displayName || 'Noen';

      notifs.push({
        id: `join_request_${request.id}`,
        type: 'join_request',
        title: 'Ny forespørsel',
        message: `${requesterName} ønsker å bli med i "${groupName}"`,
        timestamp: request.requestedAt,
        read: false,
        groupId: request.groupId,
      });
    });

    // Sort by timestamp, newest first
    notifs.sort((a, b) => b.timestamp - a.timestamp);

    // Filter out dismissed notifications
    return notifs.filter(n => !dismissedIds.has(n.id));
  }, [positions, resolvedMarkets, groupRequests, groups, pendingJoinRequests, requesters, dismissedIds]);

  const dismissNotification = (id: string) => {
    setDismissedIds(prev => {
      const newSet = new Set(prev);
      newSet.add(id);
      saveDismissedIds(newSet);
      return newSet;
    });
  };

  const dismissAll = () => {
    setDismissedIds(prev => {
      const newSet = new Set(prev);
      notifications.forEach(n => newSet.add(n.id));
      saveDismissedIds(newSet);
      return newSet;
    });
  };

  return { notifications, loading, dismissNotification, dismissAll };
}
