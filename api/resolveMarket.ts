/**
 * Vercel Serverless Function: Resolve Market
 * Admin-only function to resolve a market and payout winners
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type {
  ResolveMarketRequest,
  ResolveMarketResponse,
  Market,
  Position,
  User
} from '../src/types/firestore';

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

    // Check if user is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || !(userDoc.data() as User).isAdmin) {
      res.status(403).json({ success: false, error: 'Admin access required' });
      return;
    }

    const request = req.body as ResolveMarketRequest;

    if (!request.marketId || !request.outcome) {
      res.status(400).json({ success: false, error: 'Market ID and outcome are required' });
      return;
    }

    if (!['YES', 'NO', 'INVALID'].includes(request.outcome)) {
      res.status(400).json({ success: false, error: 'Outcome must be YES, NO, or INVALID' });
      return;
    }

    const result = await resolveMarket(request);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error resolving market:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

async function resolveMarket(request: ResolveMarketRequest): Promise<ResolveMarketResponse> {
  const { marketId, outcome, note } = request;

  return await db.runTransaction(async (transaction) => {
    // Get market
    const marketRef = db.collection('markets').doc(marketId);
    const marketDoc = await transaction.get(marketRef);

    if (!marketDoc.exists) {
      throw new Error('Market not found');
    }

    const market = marketDoc.data() as Market;

    if (market.status === 'resolved') {
      throw new Error('Market already resolved');
    }

    if (market.status !== 'closed' && market.status !== 'open') {
      throw new Error(`Cannot resolve market with status: ${market.status}`);
    }

    // Get all positions for this market
    const positionsSnapshot = await transaction.get(
      db.collection('positions').where('marketId', '==', marketId)
    );

    const payouts: { userId: string; amount: number }[] = [];
    const now = Date.now();

    // Process each position
    for (const positionDoc of positionsSnapshot.docs) {
      const position = positionDoc.data() as Position;
      let payout = 0;

      if (outcome === 'YES') {
        // YES winners get $1 per YES share
        payout = position.yesShares * 1.0;
      } else if (outcome === 'NO') {
        // NO winners get $1 per NO share
        payout = position.noShares * 1.0;
      } else if (outcome === 'INVALID') {
        // INVALID: Everyone gets back their cost basis
        payout = position.yesCostBasis + position.noCostBasis;
      }

      if (payout > 0) {
        // Add payout to user balance
        const userRef = db.collection('users').doc(position.userId);
        transaction.update(userRef, {
          balance: FieldValue.increment(payout),
        });

        payouts.push({
          userId: position.userId,
          amount: payout,
        });

        // Update position to mark it as resolved
        transaction.update(db.collection('positions').doc(positionDoc.id), {
          currentValue: payout,
          unrealizedPnL: payout - (position.yesCostBasis + position.noCostBasis),
          updatedAt: now,
        });
      }
    }

    // Cancel all open orders for this market
    const openOrdersSnapshot = await transaction.get(
      db.collection('orders')
        .where('marketId', '==', marketId)
        .where('status', 'in', ['open', 'partially_filled'])
    );

    for (const orderDoc of openOrdersSnapshot.docs) {
      const order = orderDoc.data() as any;
      if (order.remainingAmount > 0) {
        // Refund remaining amount
        const userRef = db.collection('users').doc(order.userId);
        transaction.update(userRef, {
          balance: FieldValue.increment(order.remainingAmount),
        });
      }

      transaction.update(orderDoc.ref, {
        status: 'cancelled',
        updatedAt: now,
      });
    }

    // Update market
    transaction.update(marketRef, {
      status: 'resolved',
      resolutionOutcome: outcome,
      resolutionNote: note || null,
      resolvedAt: now,
    });

    return {
      success: true,
      payouts,
    };
  });
}

module.exports = handler;
