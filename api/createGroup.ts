/**
 * Vercel Serverless Function: Create Group
 * Allows users to create a new group. Creator becomes the first admin.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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

interface CreateGroupRequest {
  name: string;
  description: string;
  isOpen?: boolean;
}

interface CreateGroupResponse {
  success: boolean;
  error?: string;
  group?: Group;
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

    const { name, description, isOpen } = req.body as CreateGroupRequest;

    if (!name || name.trim().length < 3 || name.trim().length > 50) {
      res.status(400).json({ success: false, error: 'Group name must be 3-50 characters' });
      return;
    }

    const result = await createGroup(userId, name.trim(), description?.trim() || '', isOpen ?? false);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

async function createGroup(
  userId: string,
  name: string,
  description: string,
  isOpen: boolean
): Promise<CreateGroupResponse> {
  const now = Date.now();

  // Create the group document
  const groupRef = db.collection('groups').doc();
  const groupId = groupRef.id;

  const group: Group = {
    id: groupId,
    name,
    description,
    createdAt: now,
    createdBy: userId,
    memberCount: 1,
    isOpen,
  };

  // Create the membership document for the creator as admin
  const memberRef = db.collection('groupMembers').doc(`${groupId}_${userId}`);
  const membership: GroupMember = {
    id: `${groupId}_${userId}`,
    groupId,
    userId,
    role: 'admin',
    joinedAt: now,
    invitedBy: userId, // Self-invited (creator)
  };

  // Write both in a batch
  const batch = db.batch();
  batch.set(groupRef, group);
  batch.set(memberRef, membership);
  await batch.commit();

  return {
    success: true,
    group,
  };
}

module.exports = handler;
