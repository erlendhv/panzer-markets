/**
 * Vercel Serverless Function: Market Ban Management
 * Allows admins to ban/unban users from betting on specific markets due to conflicts of interest
 *
 * Permissions:
 * - Site admins can ban/unban users from any market
 * - Group admins can ban/unban users from markets in their groups
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type {
  Market,
  User,
  GroupMember,
  MarketBannedUser
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

interface MarketBanRequest {
  action: 'ban' | 'unban';
  marketId: string;
  userId: string;
  reason?: string; // Required for ban, optional for unban
}

async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const adminUserId = req.headers['x-user-id'] as string;
    if (!adminUserId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const request = req.body as MarketBanRequest;

    if (!request.action || !['ban', 'unban'].includes(request.action)) {
      res.status(400).json({ success: false, error: 'Action must be "ban" or "unban"' });
      return;
    }

    if (!request.marketId || !request.userId) {
      res.status(400).json({ success: false, error: 'Market ID and user ID are required' });
      return;
    }

    if (request.action === 'ban' && (!request.reason || request.reason.trim() === '')) {
      res.status(400).json({ success: false, error: 'A reason for the ban is required' });
      return;
    }

    // Get market to check permissions
    const marketDoc = await db.collection('markets').doc(request.marketId).get();
    if (!marketDoc.exists) {
      res.status(404).json({ success: false, error: 'Market not found' });
      return;
    }
    const market = marketDoc.data() as Market;

    // Check admin permissions
    const adminDoc = await db.collection('users').doc(adminUserId).get();
    const adminData = adminDoc.exists ? (adminDoc.data() as User) : null;
    const isSiteAdmin = adminData?.isAdmin === true;

    // Check if user is group admin (for group markets)
    let isGroupAdmin = false;
    if (market.groupId) {
      const memberDoc = await db.collection('groupMembers').doc(`${market.groupId}_${adminUserId}`).get();
      if (memberDoc.exists) {
        const membership = memberDoc.data() as GroupMember;
        isGroupAdmin = membership.role === 'admin';
      }
    }

    // Permission check: site admin or group admin
    if (!isSiteAdmin && !isGroupAdmin) {
      res.status(403).json({ success: false, error: 'You do not have permission to manage bans for this market' });
      return;
    }

    const banId = `${request.marketId}_${request.userId}`;

    if (request.action === 'ban') {
      // Check if the user to ban exists
      const userToBanDoc = await db.collection('users').doc(request.userId).get();
      if (!userToBanDoc.exists) {
        res.status(404).json({ success: false, error: 'User to ban not found' });
        return;
      }

      // Check if user is already banned from this market
      const existingBanDoc = await db.collection('marketBannedUsers').doc(banId).get();
      if (existingBanDoc.exists) {
        res.status(400).json({ success: false, error: 'User is already banned from this market' });
        return;
      }

      // Create the ban
      const bannedUser: MarketBannedUser = {
        id: banId,
        marketId: request.marketId,
        userId: request.userId,
        bannedBy: adminUserId,
        reason: request.reason!.trim(),
        bannedAt: Date.now(),
      };

      await db.collection('marketBannedUsers').doc(banId).set(bannedUser);
      res.status(200).json({ success: true });
    } else {
      // Unban
      const existingBanDoc = await db.collection('marketBannedUsers').doc(banId).get();
      if (!existingBanDoc.exists) {
        res.status(400).json({ success: false, error: 'User is not banned from this market' });
        return;
      }

      await db.collection('marketBannedUsers').doc(banId).delete();
      res.status(200).json({ success: true });
    }
  } catch (error) {
    console.error('Error managing market ban:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

module.exports = handler;
