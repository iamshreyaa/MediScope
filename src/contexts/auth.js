// src/services/auth.js
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { app } from "../firebaseConfig";

const auth = getAuth(app);
const db = getFirestore(app);

// Sign Up (Create User + Save Role/Profile in Firestore)
export const registerUser = async (email, password, role, additionalData) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Create user record in Firestore
  await setDoc(doc(db, "users", user.uid), {
    email,
    role,
    ...additionalData,
    created_at: new Date(),
  });

  return user;
};

// Sign In (returns user + role)
export const loginUser = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Fetch user role
  const userDoc = await getDoc(doc(db, "users", user.uid));
  return { user, role: userDoc.data().role };
};

// Logout
export const logoutUser = () => signOut(auth);
