import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Order, User } from '../types/firestore';

export interface MarketParticipant {
  user: User;
  totalAmount: number;
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

    const q = query(
      collection(db, 'orders'),
      where('marketId', '==', marketId)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const orders = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Order[];

        // Group orders by userId
        const userOrderMap = new Map<string, Order[]>();
        for (const order of orders) {
          const existing = userOrderMap.get(order.userId) || [];
          existing.push(order);
          userOrderMap.set(order.userId, existing);
        }

        // Fetch user data and calculate totals
        const participantPromises = Array.from(userOrderMap.entries()).map(
          async ([userId, userOrders]) => {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (!userDoc.exists()) return null;

            const user = userDoc.data() as User;
            const yesAmount = userOrders
              .filter(o => o.side === 'YES')
              .reduce((sum, o) => sum + o.originalAmount, 0);
            const noAmount = userOrders
              .filter(o => o.side === 'NO')
              .reduce((sum, o) => sum + o.originalAmount, 0);

            return {
              user,
              totalAmount: yesAmount + noAmount,
              yesAmount,
              noAmount,
              orderCount: userOrders.length,
            } as MarketParticipant;
          }
        );

        const results = await Promise.all(participantPromises);
        const validParticipants = results.filter((p): p is MarketParticipant => p !== null);

        // Sort by total amount descending
        validParticipants.sort((a, b) => b.totalAmount - a.totalAmount);

        setParticipants(validParticipants);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching market participants:', err);
        setError('Failed to load participants');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [marketId]);

  return { participants, loading, error };
}
