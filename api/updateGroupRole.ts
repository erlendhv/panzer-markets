/**
 * Vercel Serverless Function: Update Group Role
 * Allows group admins or site admins to promote/demote members.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { GroupMember, GroupRole, User } from '../src/types/firestore';

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

interface UpdateGroupRoleRequest {
  groupId: string;
  targetUserId: string;
  newRole: GroupRole;
}

interface UpdateGroupRoleResponse {
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

    const { groupId, targetUserId, newRole } = req.body as UpdateGroupRoleRequest;

    if (!groupId || !targetUserId || !newRole) {
      res.status(400).json({ success: false, error: 'Group ID, target user ID, and new role are required' });
      return;
    }

    if (newRole !== 'admin' && newRole !== 'member') {
      res.status(400).json({ success: false, error: 'Invalid role. Must be "admin" or "member"' });
      return;
    }

    const result = await updateGroupRole(userId, groupId, targetUserId, newRole);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error updating group role:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

async function updateGroupRole(
  requesterId: string,
  groupId: string,
  targetUserId: string,
  newRole: GroupRole
): Promise<UpdateGroupRoleResponse> {
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
      throw new Error('Only group admins or site admins can update roles');
    }

    // Get the target's membership
    const targetMemberRef = db.collection('groupMembers').doc(`${groupId}_${targetUserId}`);
    const targetMemberDoc = await transaction.get(targetMemberRef);

    if (!targetMemberDoc.exists) {
      throw new Error('Target user is not a member of this group');
    }

    const targetMembership = targetMemberDoc.data() as GroupMember;

    // If demoting an admin, ensure there's at least one other admin
    if (targetMembership.role === 'admin' && newRole === 'member') {
      const adminsSnapshot = await db
        .collection('groupMembers')
        .where('groupId', '==', groupId)
        .where('role', '==', 'admin')
        .get();

      if (adminsSnapshot.size <= 1) {
        throw new Error('Cannot demote the last admin. Promote another member first.');
      }
    }

    // Update the role
    transaction.update(targetMemberRef, { role: newRole });

    return {
      success: true,
    };
  });
}

module.exports = handler;
