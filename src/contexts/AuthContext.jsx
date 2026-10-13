import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebaseConfig";
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { getMe } from "../lib/api";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true); // auth listener loading
  const [userData, setUserData] = useState(null); // store profile + role from the backend

  // LOGIN
  const signIn = async (email, password) => {
    await signInWithEmailAndPassword(auth, email, password);

    let loggedInUser;
    try {
      loggedInUser = await getMe();
    } catch (error) {
      if (error.response?.status === 404) throw new Error("User profile not found!");
      throw new Error(error.response?.data?.detail || "Unable to reach the server. Is the backend running?");
    }

    setUserData(loggedInUser);
    localStorage.setItem("userType", loggedInUser.role);

    return loggedInUser;
  };

  // LOGOUT
  const logout = async () => {
    setUserData(null);
    await firebaseSignOut(auth);
  };

  // Auth listener + auto-fetch profile from the backend
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user || null);

      if (user) {
        try {
          const profile = await getMe();
          setUserData(profile);
          localStorage.setItem("userType", profile.role);
        } catch (error) {
          if (error.response?.status === 404) {
            localStorage.removeItem("userType");
          } else {
            console.error("Error fetching user data:", error);
          }
          setUserData(null);
        }
      } else {
        setUserData(null);
        localStorage.removeItem("userType");
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userData, loading, signIn, logout }}>
      {!loading ? children : <p>Loading...</p>}
    </AuthContext.Provider>
  );
}

export { AuthContext };
