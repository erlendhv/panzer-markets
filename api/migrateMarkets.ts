/**
 * Vercel Serverless Function: Migrate Markets
 * One-time migration to add groupId: null to existing markets.
 * Only site admins can run this.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { User } from '../src/types/firestore';

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

    // Check if user is site admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || !(userDoc.data() as User).isAdmin) {
      res.status(403).json({ success: false, error: 'Only site admins can run migrations' });
      return;
    }

    // Get all markets without groupId
    const marketsSnapshot = await db.collection('markets').get();

    let updated = 0;
    const batch = db.batch();

    for (const doc of marketsSnapshot.docs) {
      const data = doc.data();
      // Only update if groupId doesn't exist
      if (data.groupId === undefined) {
        batch.update(doc.ref, { groupId: null });
        updated++;
      }
    }

    if (updated > 0) {
      await batch.commit();
    }

    res.status(200).json({
      success: true,
      message: `Migration complete. Updated ${updated} markets.`,
    });
  } catch (error) {
    console.error('Error running migration:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

module.exports = handler;
