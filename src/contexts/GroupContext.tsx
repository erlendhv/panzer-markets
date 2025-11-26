import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import type { Group, GroupMember, GroupJoinRequest } from '../types/firestore';

interface GroupContextType {
  allGroups: Group[]; // All groups in the system
  myGroups: Group[]; // Groups user is a member of
  selectedGroupId: string | null; // null = "All Markets", 'public' = public only, otherwise group ID
  setSelectedGroupId: (id: string | null) => void;
  loading: boolean;
  memberships: Map<string, GroupMember>; // groupId -> membership
  pendingRequests: Map<string, GroupJoinRequest>; // groupId -> pending request
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

export function GroupProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [memberships, setMemberships] = useState<Map<string, GroupMember>>(new Map());
  const [pendingRequests, setPendingRequests] = useState<Map<string, GroupJoinRequest>>(new Map());
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch all groups
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'groups'), (snapshot) => {
      const groups = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Group[];
      groups.sort((a, b) => a.name.localeCompare(b.name));
      setAllGroups(groups);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch user's memberships
  useEffect(() => {
    if (!user) {
      setMemberships(new Map());
      return;
    }

    const membershipsQuery = query(
      collection(db, 'groupMembers'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(membershipsQuery, (snapshot) => {
      const membershipMap = new Map<string, GroupMember>();
      snapshot.docs.forEach((doc) => {
        const membership = { id: doc.id, ...doc.data() } as GroupMember;
        membershipMap.set(membership.groupId, membership);
      });
      setMemberships(membershipMap);
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch user's pending join requests
  useEffect(() => {
    if (!user) {
      setPendingRequests(new Map());
      return;
    }

    const requestsQuery = query(
      collection(db, 'groupJoinRequests'),
      where('userId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
      const requestsMap = new Map<string, GroupJoinRequest>();
      snapshot.docs.forEach((doc) => {
        const request = { id: doc.id, ...doc.data() } as GroupJoinRequest;
        requestsMap.set(request.groupId, request);
      });
      setPendingRequests(requestsMap);
    });

    return () => unsubscribe();
  }, [user]);

  // Filter groups user is a member of
  const myGroups = allGroups.filter(g => memberships.has(g.id));

  return (
    <GroupContext.Provider
      value={{
        allGroups,
        myGroups,
        selectedGroupId,
        setSelectedGroupId,
        loading,
        memberships,
        pendingRequests,
      }}
    >
      {children}
    </GroupContext.Provider>
  );
}

export function useGroups() {
  const context = useContext(GroupContext);
  if (context === undefined) {
    throw new Error('useGroups must be used within a GroupProvider');
  }
  return context;
}
