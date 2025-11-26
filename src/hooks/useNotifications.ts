import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
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

export function useNotifications(userId: string | undefined) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [resolvedMarkets, setResolvedMarkets] = useState<Map<string, Market>>(new Map());
  const [groupRequests, setGroupRequests] = useState<GroupJoinRequest[]>([]);
  const [groups, setGroups] = useState<Map<string, Group>>(new Map());
  const [loading, setLoading] = useState(true);

  // Admin notification state
  const [adminMemberships, setAdminMemberships] = useState<GroupMember[]>([]);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<GroupJoinRequest[]>([]);
  const [requesters, setRequesters] = useState<Map<string, User>>(new Map());

  // Fetch user's positions
  useEffect(() => {
    if (!userId) {
      setPositions([]);
      return;
    }

    const q = query(
      collection(db, 'positions'),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const positionData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Position[];
      setPositions(positionData);
    });

    return unsubscribe;
  }, [userId]);

  // Fetch resolved markets for user's positions
  useEffect(() => {
    if (positions.length === 0) {
      setResolvedMarkets(new Map());
      setLoading(false);
      return;
    }

    const marketIds = [...new Set(positions.map(p => p.marketId))];

    // Firestore 'in' queries are limited to 30 items
    const chunks = [];
    for (let i = 0; i < marketIds.length; i += 30) {
      chunks.push(marketIds.slice(i, i + 30));
    }

    const unsubscribes: (() => void)[] = [];

    chunks.forEach((chunk) => {
      const q = query(
        collection(db, 'markets'),
        where('__name__', 'in', chunk),
        where('status', '==', 'resolved')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        setResolvedMarkets((prev) => {
          const newMap = new Map(prev);
          snapshot.docs.forEach((doc) => {
            newMap.set(doc.id, { id: doc.id, ...doc.data() } as Market);
          });
          return newMap;
        });
        setLoading(false);
      });

      unsubscribes.push(unsubscribe);
    });

    return () => unsubscribes.forEach(u => u());
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

  // Fetch group names for the requests
  useEffect(() => {
    if (groupRequests.length === 0) {
      setGroups(new Map());
      return;
    }

    const groupIds = [...new Set(groupRequests.map(r => r.groupId))];

    groupIds.forEach(async (groupId) => {
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      if (groupDoc.exists()) {
        setGroups((prev) => {
          const newMap = new Map(prev);
          newMap.set(groupId, { id: groupDoc.id, ...groupDoc.data() } as Group);
          return newMap;
        });
      }
    });
  }, [groupRequests]);

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

  // Fetch user info for pending join requesters
  useEffect(() => {
    if (pendingJoinRequests.length === 0) {
      setRequesters(new Map());
      return;
    }

    const userIds = [...new Set(pendingJoinRequests.map(r => r.userId))];

    userIds.forEach(async (reqUserId) => {
      const userDoc = await getDoc(doc(db, 'users', reqUserId));
      if (userDoc.exists()) {
        setRequesters((prev) => {
          const newMap = new Map(prev);
          newMap.set(reqUserId, { uid: userDoc.id, ...userDoc.data() } as User);
          return newMap;
        });
      }
    });
  }, [pendingJoinRequests]);

  // Fetch group info for pending join requests (for admin notifications)
  useEffect(() => {
    if (pendingJoinRequests.length === 0) {
      return;
    }

    const groupIds = [...new Set(pendingJoinRequests.map(r => r.groupId))];

    groupIds.forEach(async (groupId) => {
      const groupDoc = await getDoc(doc(db, 'groups', groupId));
      if (groupDoc.exists()) {
        setGroups((prev) => {
          const newMap = new Map(prev);
          newMap.set(groupId, { id: groupDoc.id, ...groupDoc.data() } as Group);
          return newMap;
        });
      }
    });
  }, [pendingJoinRequests]);

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

    return notifs;
  }, [positions, resolvedMarkets, groupRequests, groups, pendingJoinRequests, requesters]);

  return { notifications, loading };
}
