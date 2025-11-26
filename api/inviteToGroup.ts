/**
 * Vercel Serverless Function: Invite to Group
 * Allows any group member to invite another user to the group.
 * The invited user is added immediately (no acceptance needed).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { GroupMember, User } from '../src/types/firestore';

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

interface InviteToGroupRequest {
  groupId: string;
  inviteeUserId: string;
}

interface InviteToGroupResponse {
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

    const { groupId, inviteeUserId } = req.body as InviteToGroupRequest;

    if (!groupId || !inviteeUserId) {
      res.status(400).json({ success: false, error: 'Group ID and invitee user ID are required' });
      return;
    }

    const result = await inviteToGroup(userId, groupId, inviteeUserId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error inviting to group:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

async function inviteToGroup(
  inviterId: string,
  groupId: string,
  inviteeUserId: string
): Promise<InviteToGroupResponse> {
  return await db.runTransaction(async (transaction) => {
    // Check that the group exists
    const groupRef = db.collection('groups').doc(groupId);
    const groupDoc = await transaction.get(groupRef);

    if (!groupDoc.exists) {
      throw new Error('Group not found');
    }

    // Check that the inviter is a member of the group
    const inviterMemberRef = db.collection('groupMembers').doc(`${groupId}_${inviterId}`);
    const inviterMemberDoc = await transaction.get(inviterMemberRef);

    if (!inviterMemberDoc.exists) {
      throw new Error('You are not a member of this group');
    }

    // Check that the invitee exists
    const inviteeRef = db.collection('users').doc(inviteeUserId);
    const inviteeDoc = await transaction.get(inviteeRef);

    if (!inviteeDoc.exists) {
      throw new Error('User not found');
    }

    // Check if the invitee is already a member
    const inviteeMemberRef = db.collection('groupMembers').doc(`${groupId}_${inviteeUserId}`);
    const inviteeMemberDoc = await transaction.get(inviteeMemberRef);

    if (inviteeMemberDoc.exists) {
      throw new Error('User is already a member of this group');
    }

    const now = Date.now();

    // Create the membership for the invitee
    const membership: GroupMember = {
      id: `${groupId}_${inviteeUserId}`,
      groupId,
      userId: inviteeUserId,
      role: 'member',
      joinedAt: now,
      invitedBy: inviterId,
    };

    transaction.set(inviteeMemberRef, membership);

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
