import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Position, Market, GroupJoinRequest, Group } from '../types/firestore';

export interface Notification {
  id: string;
  type: 'bet_won' | 'bet_lost' | 'bet_invalid' | 'group_accepted' | 'group_rejected';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

export function useNotifications(userId: string | undefined) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [resolvedMarkets, setResolvedMarkets] = useState<Map<string, Market>>(new Map());
  const [groupRequests, setGroupRequests] = useState<GroupJoinRequest[]>([]);
  const [groups, setGroups] = useState<Map<string, Group>>(new Map());
  const [loading, setLoading] = useState(true);

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

    // Sort by timestamp, newest first
    notifs.sort((a, b) => b.timestamp - a.timestamp);

    return notifs;
  }, [positions, resolvedMarkets, groupRequests, groups]);

  return { notifications, loading };
}
