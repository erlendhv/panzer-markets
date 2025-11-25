/**
 * Vercel Serverless Function: Order Matching Engine
 *
 * This function implements the core binary order book matching logic.
 * It uses Firestore transactions to prevent race conditions when matching orders.
 *
 * Key Concept: YES price + NO price must equal $1.00
 * When a user wants to buy YES at $0.60, we look for a NO order at $0.40 or less.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type {
  PlaceOrderRequest,
  PlaceOrderResponse,
  Order,
  Trade,
  User,
  Market,
  Position,
  OrderSide
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

// Constants
const PRICE_PRECISION = 0.01; // Prices rounded to nearest cent
const MIN_ORDER_AMOUNT = 1; // Minimum $1 order
const MAX_ORDER_AMOUNT = 10000; // Maximum $10k order

/**
 * Main handler for placing orders
 */
async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    // Extract user ID from authorization header
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // Validate request body
    const orderRequest = req.body as PlaceOrderRequest;
    const validation = validateOrderRequest(orderRequest);
    if (!validation.valid) {
      res.status(400).json({ success: false, error: validation.error });
      return;
    }

    // Execute the order matching in a transaction
    const result = await matchOrder(userId, orderRequest);

    res.status(200).json(result);
  } catch (error) {
    console.error('Error processing order:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

/**
 * Validates the order request
 */
function validateOrderRequest(req: PlaceOrderRequest): { valid: boolean; error?: string } {
  if (!req.marketId) {
    return { valid: false, error: 'Market ID is required' };
  }

  if (req.side !== 'YES' && req.side !== 'NO') {
    return { valid: false, error: 'Side must be YES or NO' };
  }

  if (typeof req.priceLimit !== 'number' || req.priceLimit <= 0 || req.priceLimit >= 1) {
    return { valid: false, error: 'Price limit must be between 0 and 1' };
  }

  if (typeof req.amount !== 'number' || req.amount < MIN_ORDER_AMOUNT || req.amount > MAX_ORDER_AMOUNT) {
    return { valid: false, error: `Amount must be between $${MIN_ORDER_AMOUNT} and $${MAX_ORDER_AMOUNT}` };
  }

  // Round price to precision
  req.priceLimit = Math.round(req.priceLimit * 100) / 100;

  return { valid: true };
}

/**
 * Main order matching logic with Firestore transaction
 */
async function matchOrder(
  userId: string,
  orderRequest: PlaceOrderRequest
): Promise<PlaceOrderResponse> {
  return await db.runTransaction(async (transaction) => {
    // 1. Check if market exists and is open
    const marketRef = db.collection('markets').doc(orderRequest.marketId);
    const marketDoc = await transaction.get(marketRef);

    if (!marketDoc.exists) {
      throw new Error('Market not found');
    }

    const market = marketDoc.data() as Market;
    if (market.status !== 'open') {
      throw new Error('Market is not open for trading');
    }

    // 2. Check user balance
    const userRef = db.collection('users').doc(userId);
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const user = userDoc.data() as User;
    if (user.balance < orderRequest.amount) {
      throw new Error('Insufficient balance');
    }

    // 3. Get opposite side orders (sorted by best price)
    const oppositeSide: OrderSide = orderRequest.side === 'YES' ? 'NO' : 'YES';
    const complementPrice = 1 - orderRequest.priceLimit;

    // For matching: if buying YES at 0.60, we need NO at 0.40 or less
    // For matching: if buying NO at 0.40, we need YES at 0.60 or less
    const oppositeOrdersQuery = db.collection('orders')
      .where('marketId', '==', orderRequest.marketId)
      .where('side', '==', oppositeSide)
      .where('status', '==', 'open')
      .where('priceLimit', '<=', complementPrice)
      .orderBy('priceLimit', 'asc') // Best prices first (lowest for matching)
      .orderBy('createdAt', 'asc'); // FIFO for same price

    const oppositeOrdersSnapshot = await transaction.get(oppositeOrdersQuery);
    const oppositeOrders = oppositeOrdersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Order));

    // Pre-fetch positions for all potential trades (READ before WRITE)
    const userPositionId = `${userId}_${orderRequest.marketId}`;
    const userPositionRef = db.collection('positions').doc(userPositionId);
    const userPositionDoc = await transaction.get(userPositionRef);

    const positionsCache = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    positionsCache.set(userPositionId, userPositionDoc);

    // Pre-fetch positions for all opposite users
    for (const oppositeOrder of oppositeOrders) {
      const oppPositionId = `${oppositeOrder.userId}_${orderRequest.marketId}`;
      if (!positionsCache.has(oppPositionId)) {
        const oppPositionRef = db.collection('positions').doc(oppPositionId);
        const oppPositionDoc = await transaction.get(oppPositionRef);
        positionsCache.set(oppPositionId, oppPositionDoc);
      }
    }

    // 4. Match orders
    let remainingAmount = orderRequest.amount;
    const executedTrades: Trade[] = [];
    const now = Date.now();

    for (const oppositeOrder of oppositeOrders) {
      if (remainingAmount <= 0) break;

      // Check if this order can match
      const canMatch = (orderRequest.priceLimit + oppositeOrder.priceLimit) >= 1.0;

      if (!canMatch) continue;

      // Calculate how much we can fill
      const fillAmount = Math.min(remainingAmount, oppositeOrder.remainingAmount);
      const sharesTraded = fillAmount / 1.0; // Each share costs $1 total

      // Determine prices (user pays their limit, counterparty pays theirs)
      const yesPrice = orderRequest.side === 'YES' ? orderRequest.priceLimit : oppositeOrder.priceLimit;
      const noPrice = orderRequest.side === 'NO' ? orderRequest.priceLimit : oppositeOrder.priceLimit;

      // Create trade record
      const tradeId = db.collection('trades').doc().id;
      const trade: Trade = {
        id: tradeId,
        marketId: orderRequest.marketId,
        buyerOrderId: orderRequest.side === 'YES' ? '' : oppositeOrder.id, // Will update
        sellerOrderId: orderRequest.side === 'YES' ? oppositeOrder.id : '',
        yesUserId: orderRequest.side === 'YES' ? userId : oppositeOrder.userId,
        noUserId: orderRequest.side === 'NO' ? userId : oppositeOrder.userId,
        side: orderRequest.side,
        yesPrice,
        noPrice,
        sharesTraded,
        totalAmount: fillAmount,
        executedAt: now,
      };

      executedTrades.push(trade);

      // Update opposite order
      const newRemainingAmount = oppositeOrder.remainingAmount - fillAmount;
      const newStatus = newRemainingAmount <= 0 ? 'filled' : 'partially_filled';

      transaction.update(db.collection('orders').doc(oppositeOrder.id), {
        remainingAmount: newRemainingAmount,
        filledAmount: FieldValue.increment(fillAmount),
        status: newStatus,
        updatedAt: now,
        filledAt: newStatus === 'filled' ? now : null,
      });

      // Update positions for opposite user
      const oppPositionId = `${oppositeOrder.userId}_${orderRequest.marketId}`;
      updateUserPositionWithCache(
        transaction,
        positionsCache.get(oppPositionId)!,
        oppPositionId,
        oppositeOrder.userId,
        orderRequest.marketId,
        oppositeSide,
        sharesTraded,
        oppositeOrder.priceLimit * sharesTraded
      );

      // Update positions for this user
      updateUserPositionWithCache(
        transaction,
        positionsCache.get(userPositionId)!,
        userPositionId,
        userId,
        orderRequest.marketId,
        orderRequest.side,
        sharesTraded,
        orderRequest.priceLimit * sharesTraded
      );

      // Deduct from user balance
      transaction.update(userRef, {
        balance: FieldValue.increment(-orderRequest.priceLimit * sharesTraded),
      });

      // Deduct from opposite user balance (they already had it reserved)
      const oppositeUserRef = db.collection('users').doc(oppositeOrder.userId);
      transaction.update(oppositeUserRef, {
        balance: FieldValue.increment(0), // Balance was already reserved
      });

      // Record trade
      transaction.set(db.collection('trades').doc(tradeId), trade);

      // Update market stats
      transaction.update(marketRef, {
        lastTradedPrice: {
          yes: yesPrice,
          no: noPrice,
        },
        totalVolume: FieldValue.increment(fillAmount),
        totalYesShares: FieldValue.increment(sharesTraded),
        totalNoShares: FieldValue.increment(sharesTraded),
      });

      remainingAmount -= fillAmount;
    }

    // 5. If there's remaining amount, create a maker order
    let remainingOrder: Order | null = null;

    if (remainingAmount > 0) {
      const orderId = db.collection('orders').doc().id;

      remainingOrder = {
        id: orderId,
        marketId: orderRequest.marketId,
        userId,
        side: orderRequest.side,
        priceLimit: orderRequest.priceLimit,
        originalAmount: remainingAmount,
        remainingAmount,
        filledAmount: 0,
        status: 'open',
        createdAt: now,
        updatedAt: now,
        filledAt: null,
      };

      transaction.set(db.collection('orders').doc(orderId), remainingOrder);

      // Reserve the balance
      transaction.update(userRef, {
        balance: FieldValue.increment(-remainingAmount),
      });
    }

    return {
      success: true,
      trades: executedTrades,
      remainingOrder,
    };
  });
}

/**
 * Updates a user's position after a trade using pre-fetched position data
 */
function updateUserPositionWithCache(
  transaction: FirebaseFirestore.Transaction,
  positionDoc: FirebaseFirestore.DocumentSnapshot,
  positionId: string,
  userId: string,
  marketId: string,
  side: OrderSide,
  shares: number,
  cost: number
): void {
  const positionRef = db.collection('positions').doc(positionId);
  const now = Date.now();

  if (!positionDoc.exists) {
    // Create new position
    const newPosition: Position = {
      id: positionId,
      userId,
      marketId,
      yesShares: side === 'YES' ? shares : 0,
      noShares: side === 'NO' ? shares : 0,
      yesCostBasis: side === 'YES' ? cost : 0,
      noCostBasis: side === 'NO' ? cost : 0,
      currentValue: 0,
      unrealizedPnL: 0,
      updatedAt: now,
    };
    transaction.set(positionRef, newPosition);
  } else {
    // Update existing position
    const updates: any = {
      updatedAt: now,
    };

    if (side === 'YES') {
      updates.yesShares = FieldValue.increment(shares);
      updates.yesCostBasis = FieldValue.increment(cost);
    } else {
      updates.noShares = FieldValue.increment(shares);
      updates.noCostBasis = FieldValue.increment(cost);
    }

    transaction.update(positionRef, updates);
  }
}

module.exports = handler;
