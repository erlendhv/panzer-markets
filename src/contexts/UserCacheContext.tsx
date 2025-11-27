import { createContext, useContext, useRef, useCallback, ReactNode } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { User } from '../types/firestore';

interface UserCacheContextType {
  getUsers: (userIds: string[]) => Promise<Map<string, User>>;
}

const UserCacheContext = createContext<UserCacheContextType | undefined>(undefined);

export function UserCacheProvider({ children }: { children: ReactNode }) {
  // Use ref for synchronous cache updates (avoids race conditions)
  const cacheRef = useRef<Map<string, User>>(new Map());
  // Track in-flight requests to avoid duplicate fetches
  const pendingRef = useRef<Map<string, Promise<User | null>>>(new Map());

  const getUsers = useCallback(async (userIds: string[]): Promise<Map<string, User>> => {
    if (userIds.length === 0) {
      return new Map();
    }

    const uniqueIds = [...new Set(userIds)];
    const result = new Map<string, User>();
    const idsToFetch: string[] = [];

    // Check cache and pending requests
    for (const id of uniqueIds) {
      const cached = cacheRef.current.get(id);
      if (cached) {
        result.set(id, cached);
      } else if (!pendingRef.current.has(id)) {
        idsToFetch.push(id);
      }
    }

    // Wait for any pending requests for IDs we need
    const pendingPromises: Promise<void>[] = [];
    for (const id of uniqueIds) {
      const pending = pendingRef.current.get(id);
      if (pending && !result.has(id)) {
        pendingPromises.push(
          pending.then((user) => {
            if (user) result.set(id, user);
          })
        );
      }
    }

    // Fetch missing users in batches of 30
    if (idsToFetch.length > 0) {
      // Create promises for each ID we're fetching
      const fetchPromises: Promise<void>[] = [];

      for (let i = 0; i < idsToFetch.length; i += 30) {
        const chunk = idsToFetch.slice(i, i + 30);

        // Create a shared promise for this batch
        const batchPromise = (async () => {
          const usersQuery = query(
            collection(db, 'users'),
            where('__name__', 'in', chunk)
          );
          const snapshot = await getDocs(usersQuery);
          const fetchedUsers = new Map<string, User>();

          snapshot.docs.forEach((doc) => {
            const user = { uid: doc.id, ...doc.data() } as User;
            fetchedUsers.set(doc.id, user);
          });

          return fetchedUsers;
        })();

        // Register pending promises for each ID in chunk
        for (const id of chunk) {
          const individualPromise = batchPromise.then((users) => users.get(id) || null);
          pendingRef.current.set(id, individualPromise);
        }

        // Add to our fetch list
        fetchPromises.push(
          batchPromise.then((users) => {
            users.forEach((user, id) => {
              cacheRef.current.set(id, user);
              result.set(id, user);
              pendingRef.current.delete(id);
            });
            // Clean up IDs that weren't found
            for (const id of chunk) {
              if (!users.has(id)) {
                pendingRef.current.delete(id);
              }
            }
          })
        );
      }

      await Promise.all(fetchPromises);
    }

    // Wait for any pending requests
    if (pendingPromises.length > 0) {
      await Promise.all(pendingPromises);
    }

    return result;
  }, []);

  return (
    <UserCacheContext.Provider value={{ getUsers }}>
      {children}
    </UserCacheContext.Provider>
  );
}

export function useUserCache() {
  const context = useContext(UserCacheContext);
  if (context === undefined) {
    throw new Error('useUserCache must be used within a UserCacheProvider');
  }
  return context;
}
