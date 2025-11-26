/**
 * Vercel Serverless Function: Request to Join Group
 * Allows users to request to join a group. Admins must approve.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { GroupJoinRequest } from '../src/types/firestore';

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

interface RequestToJoinGroupRequest {
  groupId: string;
  message: string;
}

interface RequestToJoinGroupResponse {
  success: boolean;
  error?: string;
  request?: GroupJoinRequest;
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

    const { groupId, message } = req.body as RequestToJoinGroupRequest;

    if (!groupId) {
      res.status(400).json({ success: false, error: 'Group ID is required' });
      return;
    }

    if (!message || message.trim().length === 0) {
      res.status(400).json({ success: false, error: 'Message is required' });
      return;
    }

    if (message.length > 500) {
      res.status(400).json({ success: false, error: 'Message must be 500 characters or less' });
      return;
    }

    // Check if group exists
    const groupDoc = await db.collection('groups').doc(groupId).get();
    if (!groupDoc.exists) {
      res.status(404).json({ success: false, error: 'Group not found' });
      return;
    }

    // Check if user is already a member
    const memberDoc = await db.collection('groupMembers').doc(`${groupId}_${userId}`).get();
    if (memberDoc.exists) {
      res.status(400).json({ success: false, error: 'You are already a member of this group' });
      return;
    }

    // Check if there's already a pending request
    const existingRequestDoc = await db.collection('groupJoinRequests').doc(`${groupId}_${userId}`).get();
    if (existingRequestDoc.exists) {
      const existingRequest = existingRequestDoc.data() as GroupJoinRequest;
      if (existingRequest.status === 'pending') {
        res.status(400).json({ success: false, error: 'You already have a pending request for this group' });
        return;
      }
    }

    const now = Date.now();
    const joinRequest: GroupJoinRequest = {
      id: `${groupId}_${userId}`,
      groupId,
      userId,
      message: message.trim(),
      status: 'pending',
      requestedAt: now,
      reviewedBy: null,
      reviewedAt: null,
    };

    await db.collection('groupJoinRequests').doc(`${groupId}_${userId}`).set(joinRequest);

    res.status(200).json({
      success: true,
      request: joinRequest,
    });
  } catch (error) {
    console.error('Error requesting to join group:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

module.exports = handler;
