/**
 * Vercel Serverless Function: Group Admin Actions
 * Combined endpoint for group admin operations:
 * - updateRole: Promote/demote members
 * - updateSettings: Update group settings (isOpen)
 * - removeMember: Remove a member from the group
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Group, GroupMember, GroupRole, User } from '../src/types/firestore';

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

type GroupAdminAction = 'updateRole' | 'updateSettings' | 'removeMember';

interface GroupAdminRequest {
  action: GroupAdminAction;
  groupId: string;
  // For updateRole and removeMember
  targetUserId?: string;
  newRole?: GroupRole;
  // For updateSettings
  isOpen?: boolean;
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

    const request = req.body as GroupAdminRequest;

    if (!request.action || !request.groupId) {
      res.status(400).json({ success: false, error: 'Action and group ID are required' });
      return;
    }

    let result;
    switch (request.action) {
      case 'updateRole':
        if (!request.targetUserId || !request.newRole) {
          res.status(400).json({ success: false, error: 'Target user ID and new role are required' });
          return;
        }
        if (request.newRole !== 'admin' && request.newRole !== 'member') {
          res.status(400).json({ success: false, error: 'Invalid role. Must be "admin" or "member"' });
          return;
        }
        result = await updateGroupRole(userId, request.groupId, request.targetUserId, request.newRole);
        break;

      case 'updateSettings':
        if (typeof request.isOpen !== 'boolean') {
          res.status(400).json({ success: false, error: 'isOpen setting is required' });
          return;
        }
        result = await updateGroupSettings(userId, request.groupId, request.isOpen);
        break;

      case 'removeMember':
        if (!request.targetUserId) {
          res.status(400).json({ success: false, error: 'Target user ID is required' });
          return;
        }
        result = await removeFromGroup(userId, request.groupId, request.targetUserId);
        break;

      default:
        res.status(400).json({ success: false, error: 'Invalid action' });
        return;
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Error in group admin action:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

async function checkAdminPermissions(
  transaction: FirebaseFirestore.Transaction,
  requesterId: string,
  groupId: string
): Promise<{ isSiteAdmin: boolean; isGroupAdmin: boolean }> {
  const requesterRef = db.collection('users').doc(requesterId);
  const requesterDoc = await transaction.get(requesterRef);
  const requester = requesterDoc.data() as User | undefined;
  const isSiteAdmin = requester?.isAdmin === true;

  const requesterMemberRef = db.collection('groupMembers').doc(`${groupId}_${requesterId}`);
  const requesterMemberDoc = await transaction.get(requesterMemberRef);
  const requesterMembership = requesterMemberDoc.data() as GroupMember | undefined;
  const isGroupAdmin = requesterMembership?.role === 'admin';

  return { isSiteAdmin, isGroupAdmin };
}

async function updateGroupRole(
  requesterId: string,
  groupId: string,
  targetUserId: string,
  newRole: GroupRole
): Promise<{ success: boolean }> {
  return await db.runTransaction(async (transaction) => {
    const groupRef = db.collection('groups').doc(groupId);
    const groupDoc = await transaction.get(groupRef);

    if (!groupDoc.exists) {
      throw new Error('Group not found');
    }

    const { isSiteAdmin, isGroupAdmin } = await checkAdminPermissions(transaction, requesterId, groupId);

    if (!isSiteAdmin && !isGroupAdmin) {
      throw new Error('Only group admins or site admins can update roles');
    }

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

    transaction.update(targetMemberRef, { role: newRole });

    return { success: true };
  });
}

async function updateGroupSettings(
  requesterId: string,
  groupId: string,
  isOpen: boolean
): Promise<{ success: boolean }> {
  const groupRef = db.collection('groups').doc(groupId);
  const groupDoc = await groupRef.get();

  if (!groupDoc.exists) {
    throw new Error('Group not found');
  }

  // Check permissions
  const userDoc = await db.collection('users').doc(requesterId).get();
  const userData = userDoc.data() as User | undefined;
  const isSiteAdmin = userData?.isAdmin === true;

  const memberDoc = await db.collection('groupMembers').doc(`${groupId}_${requesterId}`).get();
  const memberData = memberDoc.data() as GroupMember | undefined;
  const isGroupAdmin = memberData?.role === 'admin';

  if (!isSiteAdmin && !isGroupAdmin) {
    throw new Error('Only group admins can update settings');
  }

  await groupRef.update({ isOpen });

  return { success: true };
}

async function removeFromGroup(
  requesterId: string,
  groupId: string,
  targetUserId: string
): Promise<{ success: boolean }> {
  return await db.runTransaction(async (transaction) => {
    const groupRef = db.collection('groups').doc(groupId);
    const groupDoc = await transaction.get(groupRef);

    if (!groupDoc.exists) {
      throw new Error('Group not found');
    }

    const { isSiteAdmin, isGroupAdmin } = await checkAdminPermissions(transaction, requesterId, groupId);

    if (!isSiteAdmin && !isGroupAdmin) {
      throw new Error('Only group admins or site admins can remove members');
    }

    const targetMemberRef = db.collection('groupMembers').doc(`${groupId}_${targetUserId}`);
    const targetMemberDoc = await transaction.get(targetMemberRef);

    if (!targetMemberDoc.exists) {
      throw new Error('Target user is not a member of this group');
    }

    if (targetUserId === requesterId) {
      throw new Error('Cannot remove yourself. Use leave group instead.');
    }

    transaction.delete(targetMemberRef);
    transaction.update(groupRef, {
      memberCount: FieldValue.increment(-1),
    });

    return { success: true };
  });
}

module.exports = handler;
