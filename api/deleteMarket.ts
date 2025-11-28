/**
 * Vercel Serverless Function: Delete Market
 * Admin-only (or creator/group admin) function to delete a market and related data
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Market, User, GroupMember, Order, Trade } from '../src/types/firestore';

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { marketId } = req.body as { marketId?: string };

    if (!marketId) {
      res.status(400).json({ success: false, error: 'Market ID is required' });
      return;
    }

    // Get market to check permissions
    const marketDoc = await db.collection('markets').doc(marketId).get();
    if (!marketDoc.exists) {
      res.status(404).json({ success: false, error: 'Market not found' });
      return;
    }
    const market = marketDoc.data() as Market;

    // Check user permissions
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.exists ? (userDoc.data() as User) : null;
    const isSiteAdmin = userData?.isAdmin === true;
    const isMarketCreator = market.creatorId === userId;

    // Check if user is group admin (for group markets)
    let isGroupAdmin = false;
    if (market.groupId) {
      const memberDoc = await db
        .collection('groupMembers')
        .doc(`${market.groupId}_${userId}`)
        .get();
      if (memberDoc.exists) {
        const membership = memberDoc.data() as GroupMember;
        isGroupAdmin = membership.role === 'admin';
      }
    }

    // Permission check: site admin, market creator, or group admin
    if (!isSiteAdmin && !isMarketCreator && !isGroupAdmin) {
      res.status(403).json({
        success: false,
        error: 'You do not have permission to delete this market',
      });
      return;
    }

    const result = await deleteMarket(marketId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error deleting market:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

async function deleteMarket(marketId: string): Promise<{ success: boolean; refunds: Record<string, number> }> {
  const refunds: Record<string, number> = {};

  await db.runTransaction(async (transaction) => {
    const marketRef = db.collection('markets').doc(marketId);
    const marketDoc = await transaction.get(marketRef);

    if (!marketDoc.exists) {
      throw new Error('Market not found');
    }

    // Optionally, you can restrict which statuses can be deleted
    const market = marketDoc.data() as Market;
    if (market.status === 'resolved') {
      throw new Error('Cannot delete a resolved market');
    }

    // Get related positions
    const positionsSnapshot = await transaction.get(
      db.collection('positions').where('marketId', '==', marketId)
    );

    // Get related orders
    const ordersSnapshot = await transaction.get(
      db.collection('orders').where('marketId', '==', marketId)
    );

    // Get related trades
    const tradesSnapshot = await transaction.get(
      db.collection('trades').where('marketId', '==', marketId)
    );

    // Calculate refunds from open/partially filled orders
    for (const orderDoc of ordersSnapshot.docs) {
      const order = orderDoc.data() as Order;
      if (order.status === 'open' || order.status === 'partially_filled') {
        const refundAmount = order.remainingAmount;
        if (refundAmount > 0) {
          refunds[order.userId] = (refunds[order.userId] || 0) + refundAmount;
        }
      }
    }

    // Calculate refunds from trades (refund what each user paid)
    for (const tradeDoc of tradesSnapshot.docs) {
      const trade = tradeDoc.data() as Trade;
      // Refund YES user what they paid
      const yesPaid = trade.yesPrice * trade.sharesTraded;
      refunds[trade.yesUserId] = (refunds[trade.yesUserId] || 0) + yesPaid;
      // Refund NO user what they paid
      const noPaid = trade.noPrice * trade.sharesTraded;
      refunds[trade.noUserId] = (refunds[trade.noUserId] || 0) + noPaid;
    }

    // Apply refunds to user balances
    for (const [userId, amount] of Object.entries(refunds)) {
      const userRef = db.collection('users').doc(userId);
      transaction.update(userRef, {
        balance: FieldValue.increment(amount),
      });
    }

    // Delete trades
    for (const tradeDoc of tradesSnapshot.docs) {
      transaction.delete(tradeDoc.ref);
    }

    // Delete positions
    for (const positionDoc of positionsSnapshot.docs) {
      transaction.delete(positionDoc.ref);
    }

    // Delete orders
    for (const orderDoc of ordersSnapshot.docs) {
      transaction.delete(orderDoc.ref);
    }

    // Finally delete the market itself
    transaction.delete(marketRef);
  });

  return { success: true, refunds };
}

module.exports = handler;
