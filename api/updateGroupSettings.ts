/**
 * Vercel Serverless Function: Update Group Settings
 * Allows group admins to update group settings like isOpen.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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

interface UpdateGroupSettingsRequest {
  groupId: string;
  isOpen?: boolean;
}

interface UpdateGroupSettingsResponse {
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

    const { groupId, isOpen } = req.body as UpdateGroupSettingsRequest;

    if (!groupId) {
      res.status(400).json({ success: false, error: 'Group ID is required' });
      return;
    }

    // Check if group exists
    const groupDoc = await db.collection('groups').doc(groupId).get();
    if (!groupDoc.exists) {
      res.status(404).json({ success: false, error: 'Group not found' });
      return;
    }

    // Check if user is a site admin
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data() as User | undefined;
    const isSiteAdmin = userData?.isAdmin === true;

    // Check if user is a group admin
    const memberDoc = await db.collection('groupMembers').doc(`${groupId}_${userId}`).get();
    const memberData = memberDoc.data() as GroupMember | undefined;
    const isGroupAdmin = memberData?.role === 'admin';

    if (!isSiteAdmin && !isGroupAdmin) {
      res.status(403).json({ success: false, error: 'Only group admins can update settings' });
      return;
    }

    // Update the group settings
    const updates: Partial<Group> = {};
    if (typeof isOpen === 'boolean') {
      updates.isOpen = isOpen;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, error: 'No settings to update' });
      return;
    }

    await db.collection('groups').doc(groupId).update(updates);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating group settings:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

module.exports = handler;
