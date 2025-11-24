import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../../contexts/AuthContext";
import { getAuth } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";

import { Plus, LogOut, Users } from "lucide-react";
import PatientList from "./PatientList";
import AddPatientForm from "./AddPatientForm";
import styles from "./Doctor.module.css";
import { signOut } from "firebase/auth";

const API_BASE = "http://127.0.0.1:8000";

export default function DoctorDashboard() {
  
  const auth = getAuth();

  const [activeTab, setActiveTab] = useState("patients");
  const [doctorInfo, setDoctorInfo] = useState(null);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔹 Fetch doctor's own Firestore profile
  const fetchDoctorProfile = async (user) => {
    const q = query(collection(db, "doctors"), where("uid", "==", user.uid));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      setDoctorInfo({ id: doc.id, ...doc.data() });
    }
  };

  // 🔹 Fetch patients linked to this doctor
  const fetchMyPatients = async (doctorId) => {
    const q = query(collection(db, "patients"), where("doctorId", "==", doctorId));
    const snapshot = await getDocs(q);
    const pts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setPatients(pts);
  };

  const handlePatientAdded = async () => {
    if (!auth.currentUser) return;
    await fetchMyPatients(auth.currentUser.uid);
    setActiveTab("patients");
  };

  

const handleLogout = async () => {
  const authInstance = getAuth();
  await signOut(authInstance);
  window.location.href = "/login";
};


  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) return;

      await fetchDoctorProfile(user);
      await fetchMyPatients(user.uid);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  if (loading) return <div className={styles.loading}>Loading...</div>;

  return (
    <div className={styles.dashboardContainer}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Doctor Dashboard</h1>

          {doctorInfo && (
            <div className={styles.doctorInfo}>
              <p className={styles.name}>{doctorInfo.name}</p>
              <p className={styles.specialization}>{doctorInfo.specialization}</p>
            </div>
          )}
        </div>

        <button onClick={handleLogout} className={styles.logoutBtn}>
          <LogOut size={18} />
          Logout
        </button>
      </header>

      {/* TABS */}
      <nav className={styles.tabNav}>
        <button
          className={`${styles.tabBtn} ${
            activeTab === "patients" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("patients")}
        >
          <Users size={18} />
          My Patients ({patients.length})
        </button>

        <button
          className={`${styles.tabBtn} ${
            activeTab === "add" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("add")}
        >
          <Plus size={18} />
          Add Patient
        </button>
      </nav>

      {/* MAIN CONTENT */}
      <main className={styles.mainContent}>
        {activeTab === "patients" && (
          <PatientList patients={patients} />
        )}

        {activeTab === "add" && (
          <AddPatientForm
            doctorId={auth.currentUser.uid}
            onSuccess={handlePatientAdded}
          />
        )}
      </main>
    </div>
  );
}

