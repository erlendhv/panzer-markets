import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Comment } from '../types/firestore';

export function useComments(marketId: string | undefined) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!marketId) {
      setComments([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'comments'),
      where('marketId', '==', marketId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const commentData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Comment[];

        setComments(commentData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching comments:', err);
        setError('Failed to load comments');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [marketId]);

    const addComment = async (
    marketId: string,
    userId: string,
    userDisplayName: string | null,
    userPhotoURL: string | null,
    content: string,
    referencedTimestamp: number | null
    ) => {
    const newComment: Omit<Comment, 'id'> = {
      marketId,
      userId,
      userDisplayName,
      userPhotoURL,
      content,
      createdAt: Date.now(),
      updatedAt: null,
      referencedTimestamp: referencedTimestamp || null,
    };

    await addDoc(collection(db, 'comments'), newComment);
  };

  const deleteComment = async (commentId: string) => {
    await deleteDoc(doc(db, 'comments', commentId));
  };

  return { comments, loading, error, addComment, deleteComment };
}
