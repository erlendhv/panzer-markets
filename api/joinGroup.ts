/**
 * Vercel Serverless Function: Join Group
 * Allows users to directly join an open group without approval.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Group, GroupMember } from '../src/types/firestore';

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

interface JoinGroupRequest {
  groupId: string;
}

interface JoinGroupResponse {
  success: boolean;
  error?: string;
  membership?: GroupMember;
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

    const { groupId } = req.body as JoinGroupRequest;

    if (!groupId) {
      res.status(400).json({ success: false, error: 'Group ID is required' });
      return;
    }

    const result = await joinGroup(userId, groupId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error joining group:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

async function joinGroup(
  userId: string,
  groupId: string
): Promise<JoinGroupResponse> {
  return await db.runTransaction(async (transaction) => {
    // Check that the group exists
    const groupRef = db.collection('groups').doc(groupId);
    const groupDoc = await transaction.get(groupRef);

    if (!groupDoc.exists) {
      throw new Error('Group not found');
    }

    const groupData = groupDoc.data() as Group;

    // Check if user is a site admin
    const userRef = db.collection('users').doc(userId);
    const userDoc = await transaction.get(userRef);
    const isSiteAdmin = userDoc.exists && userDoc.data()?.isAdmin === true;

    // Check if the group is open or user is a site admin
    if (!groupData.isOpen && !isSiteAdmin) {
      throw new Error('This group requires approval to join');
    }

    // Check if user is already a member
    const memberRef = db.collection('groupMembers').doc(`${groupId}_${userId}`);
    const memberDoc = await transaction.get(memberRef);

    if (memberDoc.exists) {
      throw new Error('You are already a member of this group');
    }

    const now = Date.now();

    // Create the membership
    const membership: GroupMember = {
      id: `${groupId}_${userId}`,
      groupId,
      userId,
      role: 'member',
      joinedAt: now,
      invitedBy: userId, // Self-joined
    };

    transaction.set(memberRef, membership);

    // Increment the group member count
    transaction.update(groupRef, {
      memberCount: FieldValue.increment(1),
    });

    return {
      success: true,
      membership,
    };
  });
}

module.exports = handler;
