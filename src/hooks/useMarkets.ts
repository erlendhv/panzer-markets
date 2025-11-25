/**
 * Markets Hook
 * Fetches and manages market data from Firestore
 */

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Market, MarketStatus } from '../types/firestore';

export function useMarkets(status?: MarketStatus) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const constraints: QueryConstraint[] = [];

    if (status) {
      constraints.push(where('status', '==', status));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, 'markets'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const marketData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Market[];

        setMarkets(marketData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching markets:', err);
        setError('Failed to load markets');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [status]);

  return { markets, loading, error };
}
