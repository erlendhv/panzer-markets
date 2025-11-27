import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Order, Trade, User } from '../types/firestore';

export interface MarketParticipant {
  user: User;
  totalAmount: number;
  yesAmount: number;
  noAmount: number;
  orderCount: number;
}

interface UserAmounts {
  yesAmount: number;
  noAmount: number;
  orderCount: number;
}

export function useMarketParticipants(marketId: string | undefined) {
  const [participants, setParticipants] = useState<MarketParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!marketId) {
      setParticipants([]);
      setLoading(false);
      return;
    }

    // Track data from both queries
    let orders: Order[] = [];
    let trades: Trade[] = [];
    let ordersLoaded = false;
    let tradesLoaded = false;

    const processParticipants = async () => {
      if (!ordersLoaded || !tradesLoaded) return;

      // Map to track user amounts
      const userAmountsMap = new Map<string, UserAmounts>();

      // Add orders to the map
      for (const order of orders) {
        const existing = userAmountsMap.get(order.userId) || { yesAmount: 0, noAmount: 0, orderCount: 0 };
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
        const yesExisting = userAmountsMap.get(trade.yesUserId) || { yesAmount: 0, noAmount: 0, orderCount: 0 };
        yesExisting.yesAmount += trade.yesPrice * trade.sharesTraded;
        userAmountsMap.set(trade.yesUserId, yesExisting);

        // Add NO user's trade amount
        const noExisting = userAmountsMap.get(trade.noUserId) || { yesAmount: 0, noAmount: 0, orderCount: 0 };
        noExisting.noAmount += trade.noPrice * trade.sharesTraded;
        userAmountsMap.set(trade.noUserId, noExisting);
      }

      // Fetch user data and build participants
      const participantPromises = Array.from(userAmountsMap.entries()).map(
        async ([userId, amounts]) => {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (!userDoc.exists()) return null;

          const user = userDoc.data() as User;

          return {
            user,
            totalAmount: amounts.yesAmount + amounts.noAmount,
            yesAmount: amounts.yesAmount,
            noAmount: amounts.noAmount,
            orderCount: amounts.orderCount,
          } as MarketParticipant;
        }
      );

      const results = await Promise.all(participantPromises);
      const validParticipants = results.filter((p): p is MarketParticipant => p !== null);

      // Sort by total amount descending
      validParticipants.sort((a, b) => b.totalAmount - a.totalAmount);

      setParticipants(validParticipants);
      setLoading(false);
    };

    // Subscribe to orders
    const ordersQuery = query(
      collection(db, 'orders'),
      where('marketId', '==', marketId)
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

    // Subscribe to trades
    const tradesQuery = query(
      collection(db, 'trades'),
      where('marketId', '==', marketId)
    );

    const unsubscribesTrades = onSnapshot(
      tradesQuery,
      (snapshot) => {
        trades = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Trade[];
        tradesLoaded = true;
        processParticipants();
      },
      (err) => {
        console.error('Error fetching trades:', err);
        setError('Failed to load participants');
        setLoading(false);
      }
    );

    return () => {
      unsubscribeOrders();
      unsubscribesTrades();
    };
  }, [marketId]);

  return { participants, loading, error };
}
