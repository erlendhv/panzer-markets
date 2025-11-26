/**
 * Vercel Serverless Function: Remove from Group
 * Allows group admins or site admins to remove a member from a group.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Group, GroupMember, User } from '../src/types/firestore';

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

interface RemoveFromGroupRequest {
  groupId: string;
  targetUserId: string;
}

interface RemoveFromGroupResponse {
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

    const { groupId, targetUserId } = req.body as RemoveFromGroupRequest;

    if (!groupId || !targetUserId) {
      res.status(400).json({ success: false, error: 'Group ID and target user ID are required' });
      return;
    }

    const result = await removeFromGroup(userId, groupId, targetUserId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error removing from group:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

async function removeFromGroup(
  requesterId: string,
  groupId: string,
  targetUserId: string
): Promise<RemoveFromGroupResponse> {
  return await db.runTransaction(async (transaction) => {
    // Get the group
    const groupRef = db.collection('groups').doc(groupId);
    const groupDoc = await transaction.get(groupRef);

    if (!groupDoc.exists) {
      throw new Error('Group not found');
    }

    // Check if requester is a site admin
    const requesterRef = db.collection('users').doc(requesterId);
    const requesterDoc = await transaction.get(requesterRef);
    const requester = requesterDoc.data() as User | undefined;
    const isSiteAdmin = requester?.isAdmin === true;

    // Check if requester is a group admin
    const requesterMemberRef = db.collection('groupMembers').doc(`${groupId}_${requesterId}`);
    const requesterMemberDoc = await transaction.get(requesterMemberRef);
    const requesterMembership = requesterMemberDoc.data() as GroupMember | undefined;
    const isGroupAdmin = requesterMembership?.role === 'admin';

    if (!isSiteAdmin && !isGroupAdmin) {
      throw new Error('Only group admins or site admins can remove members');
    }

    // Get the target's membership
    const targetMemberRef = db.collection('groupMembers').doc(`${groupId}_${targetUserId}`);
    const targetMemberDoc = await transaction.get(targetMemberRef);

    if (!targetMemberDoc.exists) {
      throw new Error('Target user is not a member of this group');
    }

    // Cannot remove yourself (use leave instead)
    if (targetUserId === requesterId) {
      throw new Error('Cannot remove yourself. Use leave group instead.');
    }

    // Remove the target's membership
    transaction.delete(targetMemberRef);

    // Decrement the member count
    transaction.update(groupRef, {
      memberCount: FieldValue.increment(-1),
    });

    return {
      success: true,
    };
  });
}

module.exports = handler;
