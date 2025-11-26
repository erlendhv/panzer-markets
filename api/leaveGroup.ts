/**
 * Vercel Serverless Function: Leave Group
 * Allows a user to leave a group.
 * If the last admin leaves, the oldest member becomes admin.
 * If the last member leaves, the group is deleted.
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

interface LeaveGroupRequest {
  groupId: string;
}

interface LeaveGroupResponse {
  success: boolean;
  error?: string;
  groupDeleted?: boolean;
  newAdminUserId?: string;
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

    const { groupId } = req.body as LeaveGroupRequest;

    if (!groupId) {
      res.status(400).json({ success: false, error: 'Group ID is required' });
      return;
    }

    const result = await leaveGroup(userId, groupId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error leaving group:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

async function leaveGroup(
  userId: string,
  groupId: string
): Promise<LeaveGroupResponse> {
  return await db.runTransaction(async (transaction) => {
    // Get the group
    const groupRef = db.collection('groups').doc(groupId);
    const groupDoc = await transaction.get(groupRef);

    if (!groupDoc.exists) {
      throw new Error('Group not found');
    }

    const group = groupDoc.data() as Group;

    // Get the user's membership
    const memberRef = db.collection('groupMembers').doc(`${groupId}_${userId}`);
    const memberDoc = await transaction.get(memberRef);

    if (!memberDoc.exists) {
      throw new Error('You are not a member of this group');
    }

    const membership = memberDoc.data() as GroupMember;

    // Check if this is the last member
    if (group.memberCount <= 1) {
      // Delete the group and membership
      transaction.delete(memberRef);
      transaction.delete(groupRef);

      return {
        success: true,
        groupDeleted: true,
      };
    }

    // If leaving user is an admin, check if there are other admins
    let newAdminUserId: string | undefined;

    if (membership.role === 'admin') {
      // Get all admins in the group
      const adminsSnapshot = await db
        .collection('groupMembers')
        .where('groupId', '==', groupId)
        .where('role', '==', 'admin')
        .get();

      const otherAdmins = adminsSnapshot.docs.filter(doc => doc.data().userId !== userId);

      if (otherAdmins.length === 0) {
        // No other admins - promote oldest member
        const membersSnapshot = await db
          .collection('groupMembers')
          .where('groupId', '==', groupId)
          .orderBy('joinedAt', 'asc')
          .get();

        // Find the oldest member who is not the leaving user
        const oldestMember = membersSnapshot.docs.find(doc => doc.data().userId !== userId);

        if (oldestMember) {
          newAdminUserId = oldestMember.data().userId;
          transaction.update(oldestMember.ref, { role: 'admin' });
        }
      }
    }

    // Remove the user's membership
    transaction.delete(memberRef);

    // Decrement the member count
    transaction.update(groupRef, {
      memberCount: FieldValue.increment(-1),
    });

    return {
      success: true,
      groupDeleted: false,
      newAdminUserId,
    };
  });
}

module.exports = handler;
