import { useState, forwardRef, useImperativeHandle, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useComments } from '../../hooks/useComments';

interface CommentsSectionProps {
  marketId: string;
  selectedTimestamp?: number | null;
  clearSelectedTimestamp?: () => void;
  onTimestampClick?: (ts: number) => void;
}

export interface CommentsSectionRef {
  scrollIntoView: () => void;
  setAttachedTimestamp: (ts: number) => void;
}

export const CommentsSection = forwardRef<CommentsSectionRef, CommentsSectionProps>(
  ({ marketId, selectedTimestamp: _, clearSelectedTimestamp, onTimestampClick }, ref) => {
    const { user } = useAuth();
    const { comments, loading, addComment, deleteComment } = useComments(marketId);
    const [newComment, setNewComment] = useState('');
    const [attachedTimestamp, setAttachedTimestamp] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const divRef = useRef<HTMLDivElement>(null);

    // Expose scroll and attachTimestamp to parent
    useImperativeHandle(ref, () => ({
      scrollIntoView: () => divRef.current?.scrollIntoView({ behavior: 'smooth' }),
      setAttachedTimestamp: (ts: number) => setAttachedTimestamp(ts),
    }));

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user || !newComment.trim()) return;

      setSubmitting(true);
      try {
        await addComment(
          marketId,
          user.uid,
          user.displayName,
          user.photoURL,
          newComment.trim(),
          attachedTimestamp ?? null
        );
        setNewComment('');
        setAttachedTimestamp(null);
        if (clearSelectedTimestamp) clearSelectedTimestamp();
      } catch (err) {
        console.error('Error adding comment:', err);
      } finally {
        setSubmitting(false);
      }
    };

    const handleDelete = async (commentId: string) => {
      setDeletingId(commentId);
      try {
        await deleteComment(commentId);
      } catch (err) {
        console.error('Error deleting comment:', err);
      } finally {
        setDeletingId(null);
      }
    };

    const formatTimeAgo = (timestamp: number) => {
      const seconds = Math.floor((Date.now() - timestamp) / 1000);
      if (seconds < 60) return 'akkurat nå';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m siden`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}t siden`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d siden`;
      return new Date(timestamp).toLocaleDateString('nb-NO', { month: 'short', day: 'numeric' });
    };

    return (
      <div ref={divRef} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Kommentarer ({comments.length})
        </h2>

        {user ? (
          <form onSubmit={handleSubmit} className="mb-6">
            <div className="flex gap-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Bruker'}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                  <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">
                    {user.displayName?.charAt(0) || user.email?.charAt(0) || '?'}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Skriv noe slemt..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                />

                {/* Attached timestamp display with remove button */}
                {attachedTimestamp && (
                  <div className="mt-1 flex items-center justify-between bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 px-2 py-1 rounded text-green-800 dark:text-green-300 text-sm">
                    <span>
                      {new Date(attachedTimestamp).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachedTimestamp(null)}
                      className="ml-2 text-green-700 dark:text-green-400 font-bold hover:text-green-900 dark:hover:text-green-200"
                    >
                      ×
                    </button>
                  </div>
                )}

                <div className="mt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={!newComment.trim() || submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Poster...' : 'Legg til kommentar'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
            <p className="text-gray-600 dark:text-gray-400">Logg inn for å skrive noe slemt</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">Ingen kommentarer ennå. Skriv noe</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                {comment.userPhotoURL ? (
                  <img
                    src={comment.userPhotoURL}
                    alt={comment.userDisplayName || 'Bruker'}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">
                      {comment.userDisplayName?.charAt(0) || '?'}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {comment.userDisplayName || 'Anonym'}
                    </span>
                    <span
                      className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:underline"
                      onClick={() => {
                        if (comment.referencedTimestamp && onTimestampClick) {
                          onTimestampClick(comment.referencedTimestamp);
                        }
                      }}
                    >
                      {formatTimeAgo(comment.createdAt)}
                    </span>
                  </div>

                  {/* Show referenced timestamp inside comment in green and clickable */}
                {comment.referencedTimestamp && (
                <div
                    className="text-green-700 dark:text-green-400 text-sm cursor-pointer hover:underline mt-1"
                    onClick={() => onTimestampClick?.(comment.referencedTimestamp!)}
                >
                    {comment.referencedTimestamp && (
                        <div
                            className="text-green-700 dark:text-green-400 text-sm cursor-pointer hover:underline mt-1"
                            onClick={() => onTimestampClick?.(comment.referencedTimestamp!)}
                        >
                            {new Date(comment.referencedTimestamp).toLocaleString()}
                        </div>
                    )}
                </div>
                )}

                  <p className="mt-1 text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                    {comment.content}
                  </p>

                  {(user?.uid === comment.userId || user?.isAdmin) && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      disabled={deletingId === comment.id}
                      className="mt-1 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50"
                    >
                      {deletingId === comment.id ? 'Sletter...' : 'Slett'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);
