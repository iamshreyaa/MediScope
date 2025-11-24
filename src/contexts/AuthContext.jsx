// import { createContext, useContext, useEffect, useState } from "react";
// import { auth, db } from "../firebaseConfig";
// import {
//   createUserWithEmailAndPassword,
//   signInWithEmailAndPassword,
//   signOut,
//   onAuthStateChanged,
// } from "firebase/auth";
// import { doc, setDoc, getDoc } from "firebase/firestore";

// const AuthContext = createContext();

// export function useAuth() {
//   return useContext(AuthContext);
// }

// export function AuthProvider({ children }) {
//   const [currentUser, setCurrentUser] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [userData, setUserData] = useState(null); // store role & info

//   // SIGN UP
//   // SIGN UP
// const signUp = async (email, password, role = "patient", additionalData = {}) => {
//   const userCredential = await createUserWithEmailAndPassword(auth, email, password);
//   const user = userCredential.user;

//   // Save profile in Firestore (doctors/patients collection)
//   await setDoc(doc(db, role === "doctor" ? "doctors" : "patients", user.uid), {
//     uid: user.uid,
//     email,
//     role,
//     ...additionalData,
//   });

//   // Do NOT log in the user here
//   return user; // just return user info if needed
// };


//   // LOGIN
//   const signIn = async (email, password) => {
//     const userCredential = await signInWithEmailAndPassword(auth, email, password);
//     const uid = userCredential.user.uid;

//     let userDoc = null;
//     let role = null;

//     const doctorDoc = await getDoc(doc(db, "doctors", uid));
//     if (doctorDoc.exists()) {
//       userDoc = doctorDoc.data();
//       role = "doctor";
//     }

//     const patientDoc = await getDoc(doc(db, "patients", uid));
//     if (patientDoc.exists()) {
//       userDoc = patientDoc.data();
//       role = "patient";
//     }

//     if (!userDoc) throw new Error("User data not found in Firestore!");

//     const loggedInUser = { ...userDoc, role };
//     setUserData(loggedInUser);
//     localStorage.setItem("userType", role);

//     return loggedInUser;
//   };

//   // LOGOUT
//   const logout = () => {
//     setUserData(null);
//     return signOut(auth);
//   };

//   // Auth listener
//   useEffect(() => {
//     const unsubscribe = onAuthStateChanged(auth, (user) => {
//       setCurrentUser(user || null);
//       setLoading(false);
//     });
//     return unsubscribe;
//   }, []);

//   return (
//     <AuthContext.Provider value={{ currentUser, userData, signUp, signIn, logout }}>
//       {!loading ? children : <p>Loading...</p>}
//     </AuthContext.Provider>
//   );
// }

// export { AuthContext };


import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebaseConfig";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true); // auth listener loading
  const [userData, setUserData] = useState(null); // store Firestore info

  // SIGN UP
  const signUp = async (email, password, role = "patient", additionalData = {}) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Save profile in Firestore (doctors/patients collection)
    await setDoc(doc(db, role === "doctor" ? "doctors" : "patients", user.uid), {
      uid: user.uid,
      email,
      role,
      ...additionalData,
    });

    return user;
  };

  // LOGIN
  const signIn = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    let userDoc = null;
    let role = null;

    const doctorDoc = await getDoc(doc(db, "doctors", uid));
    if (doctorDoc.exists()) {
      userDoc = doctorDoc.data();
      role = "doctor";
    }

    const patientDoc = await getDoc(doc(db, "patients", uid));
    if (patientDoc.exists()) {
      userDoc = patientDoc.data();
      role = "patient";
    }

    if (!userDoc) throw new Error("User data not found in Firestore!");

    const loggedInUser = { ...userDoc, role };
    setUserData(loggedInUser);
    localStorage.setItem("userType", role);

    return loggedInUser;
  };

  // LOGOUT
  const logout = async () => {
    setUserData(null);
    await firebaseSignOut(auth);
  };

  // Auth listener + auto-fetch Firestore data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user || null);

      if (user) {
        try {
          const uid = user.uid;

          let userDoc = null;
          let role = null;

          const doctorDoc = await getDoc(doc(db, "doctors", uid));
          if (doctorDoc.exists()) {
            userDoc = doctorDoc.data();
            role = "doctor";
          }

          const patientDoc = await getDoc(doc(db, "patients", uid));
          if (patientDoc.exists()) {
            userDoc = patientDoc.data();
            role = "patient";
          }

          if (userDoc) {
            setUserData({ ...userDoc, role });
            localStorage.setItem("userType", role);
          } else {
            setUserData(null);
            localStorage.removeItem("userType");
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
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
    <AuthContext.Provider value={{ currentUser, userData, loading, signUp, signIn, logout }}>
      {!loading ? children : <p>Loading...</p>}
    </AuthContext.Provider>
  );
}

export { AuthContext };
