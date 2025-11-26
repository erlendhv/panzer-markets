import type { Order } from '../types/firestore';

/**
 * Calculate the total amount locked in open orders
 * This is money that has been committed to orders but not yet filled
 */
export function getLockedInOrders(orders: Order[]): number {
  return orders
    .filter(o => o.status === 'open' || o.status === 'partially_filled')
    .reduce((sum, o) => sum + o.remainingAmount, 0);
}

/**
 * Calculate the available balance (total balance minus locked in orders)
 */
export function getAvailableBalance(balance: number, orders: Order[]): number {
  return balance - getLockedInOrders(orders);
}
