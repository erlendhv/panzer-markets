/**
 * Vercel Serverless Function: Cancel Order
 * Allows users to cancel their open orders and get their reserved funds back
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { CancelOrderRequest, CancelOrderResponse, Order } from '../src/types/firestore';

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

    const { orderId } = req.body as CancelOrderRequest;

    if (!orderId) {
      res.status(400).json({ success: false, error: 'Order ID is required' });
      return;
    }

    const result = await cancelOrder(userId, orderId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

async function cancelOrder(userId: string, orderId: string): Promise<CancelOrderResponse> {
  return await db.runTransaction(async (transaction) => {
    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await transaction.get(orderRef);

    if (!orderDoc.exists) {
      throw new Error('Order not found');
    }

    const order = orderDoc.data() as Order;

    // Verify ownership
    if (order.userId !== userId) {
      throw new Error('Unauthorized: Order belongs to another user');
    }

    // Can only cancel open or partially filled orders
    if (order.status === 'filled' || order.status === 'cancelled') {
      throw new Error(`Cannot cancel order with status: ${order.status}`);
    }

    // Refund the remaining amount
    const refundAmount = order.remainingAmount;

    if (refundAmount > 0) {
      const userRef = db.collection('users').doc(userId);
      transaction.update(userRef, {
        balance: FieldValue.increment(refundAmount),
      });
    }

    // Update order status
    transaction.update(orderRef, {
      status: 'cancelled',
      updatedAt: Date.now(),
    });

    return {
      success: true,
      refundedAmount: refundAmount,
    };
  });
}

module.exports = handler;
