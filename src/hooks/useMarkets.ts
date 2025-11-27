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

interface UseMarketsOptions {
  status?: MarketStatus;
  groupId?: string | null; // null = show all accessible, 'public' = public only, specific ID = show only that group
  userGroupIds?: string[]; // List of groups the user belongs to (for "all" view)
}

export function useMarkets(statusOrOptions?: MarketStatus | UseMarketsOptions) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle both old and new API
  const options: UseMarketsOptions = typeof statusOrOptions === 'string'
    ? { status: statusOrOptions }
    : statusOrOptions || {};

  const { status, groupId, userGroupIds } = options;

  useEffect(() => {
    const constraints: QueryConstraint[] = [];

    if (status) {
      constraints.push(where('status', '==', status));
    }

    // Group filtering
    if (groupId !== undefined) {
      if (groupId === null) {
        // "All markets" view - we need to fetch all and filter client-side
        // because Firestore doesn't support OR queries across different fields easily
        // We'll filter in the snapshot callback
      } else if (groupId === 'public') {
        // "Public only" view - filter client-side for markets without a groupId
        // We'll filter in the snapshot callback
      } else {
        // Specific group selected
        constraints.push(where('groupId', '==', groupId));
      }
    }

    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, 'markets'), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let marketData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Market[];

        // Client-side filtering for "all markets" view
        if (groupId === null && userGroupIds !== undefined) {
          // Show public markets (groupId is null) and markets from user's groups
          marketData = marketData.filter((market) => {
            // Public markets are always visible
            if (market.groupId === null || market.groupId === undefined) {
              return true;
            }
            // Group markets only if user is a member
            return userGroupIds.includes(market.groupId);
          });
        }

        // Client-side filtering for "public only" view
        if (groupId === 'public') {
          marketData = marketData.filter((market) => {
            return market.groupId === null || market.groupId === undefined;
          });
        }

        // Sort by "hotness" - prioritize recent activity and volume
        marketData.sort((a, b) => {
          // Calculate hotness score for each market
          const getHotnessScore = (market: Market) => {
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            const oneWeek = 7 * oneDay;

            let score = 0;

            // Recent trade bonus (up to 1000 points for trades in last 24h, decays over a week)
            if (market.lastTradeAt) {
              const timeSinceTrade = now - market.lastTradeAt;
              if (timeSinceTrade < oneDay) {
                score += 1000 * (1 - timeSinceTrade / oneDay);
              } else if (timeSinceTrade < oneWeek) {
                score += 200 * (1 - timeSinceTrade / oneWeek);
              }
            }

            // Volume bonus (logarithmic scale, max ~100 points)
            if (market.totalVolume > 0) {
              score += Math.log10(market.totalVolume + 1) * 30;
            }

            return score;
          };

          return getHotnessScore(b) - getHotnessScore(a);
        });

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
  }, [status, groupId, JSON.stringify(userGroupIds)]);

  return { markets, loading, error };
}
