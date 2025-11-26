/**
 * Vercel Serverless Function: Handle Join Request
 * Allows group admins to approve or deny join requests.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { GroupJoinRequest, GroupMember, User } from '../src/types/firestore';

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

interface HandleJoinRequestRequest {
  groupId: string;
  targetUserId: string;
  action: 'approve' | 'deny';
}

interface HandleJoinRequestResponse {
  success: boolean;
  error?: string;
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
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { groupId, targetUserId, action } = req.body as HandleJoinRequestRequest;

    if (!groupId || !targetUserId || !action) {
      res.status(400).json({ success: false, error: 'Group ID, target user ID, and action are required' });
      return;
    }

    if (action !== 'approve' && action !== 'deny') {
      res.status(400).json({ success: false, error: 'Action must be "approve" or "deny"' });
      return;
    }

    const result = await handleJoinRequest(userId, groupId, targetUserId, action);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error handling join request:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

async function handleJoinRequest(
  adminUserId: string,
  groupId: string,
  targetUserId: string,
  action: 'approve' | 'deny'
): Promise<HandleJoinRequestResponse> {
  return await db.runTransaction(async (transaction) => {
    // Check if admin is a site admin
    const adminUserRef = db.collection('users').doc(adminUserId);
    const adminUserDoc = await transaction.get(adminUserRef);
    const adminUser = adminUserDoc.data() as User | undefined;
    const isSiteAdmin = adminUser?.isAdmin === true;

    // Check if admin is a group admin
    const adminMemberRef = db.collection('groupMembers').doc(`${groupId}_${adminUserId}`);
    const adminMemberDoc = await transaction.get(adminMemberRef);
    const adminMembership = adminMemberDoc.data() as GroupMember | undefined;
    const isGroupAdmin = adminMembership?.role === 'admin';

    if (!isSiteAdmin && !isGroupAdmin) {
      throw new Error('Only group admins or site admins can handle join requests');
    }

    // Get the join request
    const requestRef = db.collection('groupJoinRequests').doc(`${groupId}_${targetUserId}`);
    const requestDoc = await transaction.get(requestRef);

    if (!requestDoc.exists) {
      throw new Error('Join request not found');
    }

    const joinRequest = requestDoc.data() as GroupJoinRequest;

    if (joinRequest.status !== 'pending') {
      throw new Error('This request has already been handled');
    }

    const now = Date.now();

    if (action === 'approve') {
      // Create membership
      const memberRef = db.collection('groupMembers').doc(`${groupId}_${targetUserId}`);
      const membership: GroupMember = {
        id: `${groupId}_${targetUserId}`,
        groupId,
        userId: targetUserId,
        role: 'member',
        joinedAt: now,
        invitedBy: adminUserId,
      };
      transaction.set(memberRef, membership);

      // Increment group member count
      const groupRef = db.collection('groups').doc(groupId);
      transaction.update(groupRef, {
        memberCount: FieldValue.increment(1),
      });
    }

    // Update the request status
    transaction.update(requestRef, {
      status: action === 'approve' ? 'approved' : 'denied',
      reviewedBy: adminUserId,
      reviewedAt: now,
    });

    return { success: true };
  });
}

module.exports = handler;
