import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Position } from '../types/firestore';

export function useUserPositions(userId: string | undefined) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setPositions([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'positions'),
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const positionData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Position[];

        setPositions(positionData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching positions:', err);
        setError('Failed to load positions');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [userId]);

  return { positions, loading, error };
}
