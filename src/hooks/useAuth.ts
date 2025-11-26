/**
 * Authentication Hook
 * Manages user authentication state and provides auth methods
 */

import { useState, useEffect } from "react";
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, googleProvider, db } from "../lib/firebase";
import type { User } from "../types/firestore";

const INITIAL_BALANCE = 1000; // $1000 starting balance

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // console.log('Auth state changed:', firebaseUser?.email || 'null');
      if (firebaseUser) {
        await handleUserLogin(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleUserLogin = async (firebaseUser: FirebaseUser) => {
    try {
      // console.log("Handling user login for:", firebaseUser.email);
      const userRef = doc(db, "users", firebaseUser.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        console.log("Creating new user document...");
        // Create new user with initial balance
        const newUser: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || "",
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          balance: INITIAL_BALANCE,
          portfolioValue: 0,
          createdAt: Date.now(),
          isAdmin: false,
        };

        await setDoc(userRef, newUser);
        // console.log("New user created:", newUser);
        setUser(newUser);
      } else {
        // console.log("Existing user found:", userDoc.data());
        setUser(userDoc.data() as User);
      }
    } catch (err: any) {
      console.error("Error handling user login:", err);
      console.error("Error details:", err.code, err.message);
      setError("Failed to load user data: " + err.message);
    }
  };

  const signInWithGoogle = async () => {
    try {
      console.log("Starting Google sign-in with popup...");
      setError(null);
      // Use popup (COOP warning is harmless, just a console warning)
      const result = await signInWithPopup(auth, googleProvider);
      console.log("Sign-in successful:", result.user.email);
    } catch (err: any) {
      console.error("Error signing in:", err);
      // Ignore popup-closed-by-user error (user cancelled)
      if (
        err.code !== "auth/popup-closed-by-user" &&
        err.code !== "auth/cancelled-popup-request"
      ) {
        setError(err.message || "Failed to sign in with Google");
      }
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
    } catch (err) {
      console.error("Error signing out:", err);
      setError("Failed to sign out");
      throw err;
    }
  };

  return {
    user,
    loading,
    error,
    signInWithGoogle,
    signOut,
  };
}
