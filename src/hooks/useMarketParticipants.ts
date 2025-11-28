import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useUserCache } from '../contexts/UserCacheContext';
import type { Order, Trade, User } from '../types/firestore';

export interface MarketParticipant {
  user: User;
  totalAmount: number;
  yesAmount: number;
  noAmount: number;
  orderCount: number;
  tradeCount: number;
}

interface UserAmounts {
  yesAmount: number;
  noAmount: number;
  orderCount: number;
  tradeCount: number;
}

export function useMarketParticipants(marketId: string | undefined) {
  const { getUsers } = useUserCache();
  const [participants, setParticipants] = useState<MarketParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Store trades in a ref since they're fetched once and don't change
  const tradesRef = useRef<Trade[]>([]);

  useEffect(() => {
    if (!marketId) {
      setParticipants([]);
      setLoading(false);
      return;
    }

    let orders: Order[] = [];
    let tradesLoaded = false;
    let ordersLoaded = false;

    const processParticipants = async () => {
      if (!ordersLoaded || !tradesLoaded) return;

      const trades = tradesRef.current;

      // Map to track user amounts
      const userAmountsMap = new Map<string, UserAmounts>();

      // Add orders to the map
      for (const order of orders) {
        const existing = userAmountsMap.get(order.userId) || { yesAmount: 0, noAmount: 0, orderCount: 0, tradeCount: 0 };
        if (order.side === 'YES') {
          existing.yesAmount += order.originalAmount;
        } else {
          existing.noAmount += order.originalAmount;
        }
        existing.orderCount += 1;
        userAmountsMap.set(order.userId, existing);
      }

      // Add trades to the map (for users who took the other side)
      for (const trade of trades) {
        // Add YES user's trade amount
        const yesExisting = userAmountsMap.get(trade.yesUserId) || { yesAmount: 0, noAmount: 0, orderCount: 0, tradeCount: 0 };
        yesExisting.yesAmount += trade.yesPrice * trade.sharesTraded;
        yesExisting.tradeCount += 1;
        userAmountsMap.set(trade.yesUserId, yesExisting);

        // Add NO user's trade amount
        const noExisting = userAmountsMap.get(trade.noUserId) || { yesAmount: 0, noAmount: 0, orderCount: 0, tradeCount: 0 };
        noExisting.noAmount += trade.noPrice * trade.sharesTraded;
        noExisting.tradeCount += 1;
        userAmountsMap.set(trade.noUserId, noExisting);
      }

      // Batch fetch user data using cache
      const userIds = Array.from(userAmountsMap.keys());
      const userMap = await getUsers(userIds);

      // Build participants from fetched users
      const validParticipants: MarketParticipant[] = [];
      for (const [userId, amounts] of userAmountsMap.entries()) {
        const user = userMap.get(userId);
        if (!user) continue;

        validParticipants.push({
          user,
          totalAmount: amounts.yesAmount + amounts.noAmount,
          yesAmount: amounts.yesAmount,
          noAmount: amounts.noAmount,
          orderCount: amounts.orderCount,
          tradeCount: amounts.tradeCount,
        });
      }

      // Sort by total amount descending
      validParticipants.sort((a, b) => b.totalAmount - a.totalAmount);

      setParticipants(validParticipants);
      setLoading(false);
    };

    // Fetch trades once (historical data doesn't change)
    const fetchTrades = async () => {
      try {
        const tradesQuery = query(
          collection(db, 'trades'),
          where('marketId', '==', marketId)
        );
        const snapshot = await getDocs(tradesQuery);
        tradesRef.current = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Trade[];
        tradesLoaded = true;
        processParticipants();
      } catch (err) {
        console.error('Error fetching trades:', err);
        setError('Failed to load participants');
        setLoading(false);
      }
    };

    fetchTrades();

    // Subscribe to orders (real-time - orders can change)
    const ordersQuery = query(
      collection(db, 'orders'),
      where('marketId', '==', marketId),
      where('status', 'in', ['open', 'partially_filled'])
    );

    const unsubscribeOrders = onSnapshot(
      ordersQuery,
      (snapshot) => {
        orders = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Order[];
        ordersLoaded = true;
        processParticipants();
      },
      (err) => {
        console.error('Error fetching orders:', err);
        setError('Failed to load participants');
        setLoading(false);
      }
    );

    return () => {
      unsubscribeOrders();
    };
  }, [marketId, getUsers]);

  return { participants, loading, error };
}
