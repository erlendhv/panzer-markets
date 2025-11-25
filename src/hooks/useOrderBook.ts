/**
 * Order Book Hook
 * Fetches and aggregates the order book for a specific market
 */

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Order, OrderBook, OrderBookEntry, OrderSide } from '../types/firestore';

export function useOrderBook(marketId: string) {
  const [orderBook, setOrderBook] = useState<OrderBook>({ yes: [], no: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!marketId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'orders'),
      where('marketId', '==', marketId),
      where('status', '==', 'open'),
      orderBy('priceLimit', 'desc'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const orders = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Order[];

        const aggregated = aggregateOrderBook(orders);
        setOrderBook(aggregated);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching order book:', err);
        setError('Failed to load order book');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [marketId]);

  return { orderBook, loading, error };
}

/**
 * Aggregates orders by price level
 */
function aggregateOrderBook(orders: Order[]): OrderBook {
  const yesOrders = orders.filter((o) => o.side === 'YES');
  const noOrders = orders.filter((o) => o.side === 'NO');

  return {
    yes: aggregateOrders(yesOrders),
    no: aggregateOrders(noOrders),
  };
}

function aggregateOrders(orders: Order[]): OrderBookEntry[] {
  const priceMap = new Map<number, Order[]>();

  for (const order of orders) {
    const price = order.priceLimit;
    if (!priceMap.has(price)) {
      priceMap.set(price, []);
    }
    priceMap.get(price)!.push(order);
  }

  const entries: OrderBookEntry[] = [];

  for (const [price, ordersAtPrice] of priceMap.entries()) {
    const totalAmount = ordersAtPrice.reduce((sum, o) => sum + o.remainingAmount, 0);
    entries.push({
      price,
      totalAmount,
      orders: ordersAtPrice,
    });
  }

  // Sort by price descending (best prices first)
  entries.sort((a, b) => b.price - a.price);

  return entries;
}
