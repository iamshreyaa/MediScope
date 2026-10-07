import React, { useState, useEffect } from "react";
import { getAuth, signOut } from "firebase/auth";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";

import { Plus, LogOut, Users } from "lucide-react";
import PatientList from "./PatientList";
import AddPatientForm from "./AddPatientForm";
import styles from "./Doctor.module.css";

export default function DoctorDashboard() {
  const auth = getAuth();

  const [activeTab, setActiveTab] = useState("patients");
  const [doctorInfo, setDoctorInfo] = useState(null);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDoctorProfile = async (user) => {
    const doctorRef = doc(db, "doctors", user.uid);
    const doctorDoc = await getDoc(doctorRef);

    if (doctorDoc.exists()) {
      setDoctorInfo({ id: doctorDoc.id, ...doctorDoc.data() });
    }
  };

  const fetchMyPatients = async (doctorId) => {
    try {
      const subCollectionRef = collection(db, "doctors", doctorId, "patients");
      const subCollectionSnapshot = await getDocs(subCollectionRef);
      let patientData = subCollectionSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (!patientData.length) {
        const legacyQuery = query(collection(db, "patients"), where("doctorId", "==", doctorId));
        const legacySnapshot = await getDocs(legacyQuery);
        patientData = legacySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      }

      setPatients(patientData);
    } catch (error) {
      console.error("Failed to fetch doctor patients:", error);
      setPatients([]);
    }
  };

  const handlePatientAdded = async () => {
    if (!auth.currentUser) return;
    await fetchMyPatients(auth.currentUser.uid);
    setActiveTab("patients");
  };

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/login";
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) return;

      try {
        await fetchDoctorProfile(user);
        await fetchMyPatients(user.uid);
        setLoading(false);
      } catch (error) {
        console.error("DOCTOR DASHBOARD ERROR:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [auth]);

  if (loading) return <div className={styles.loading}>Loading...</div>;

  return (
    <div className={styles.dashboardContainer}>
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

      <nav className={styles.tabNav}>
        <button
          className={`${styles.tabBtn} ${activeTab === "patients" ? styles.active : ""}`}
          onClick={() => setActiveTab("patients")}
        >
          <Users size={18} />
          My Patients ({patients.length})
        </button>

        <button
          className={`${styles.tabBtn} ${activeTab === "add" ? styles.active : ""}`}
          onClick={() => setActiveTab("add")}
        >
          <Plus size={18} />
          Add Patient
        </button>
      </nav>

      <main className={styles.mainContent}>
        {activeTab === "patients" && <PatientList patients={patients} />}

        {activeTab === "add" && (
          <AddPatientForm
            doctorId={auth.currentUser?.uid}
            onSuccess={handlePatientAdded}
          />
        )}
      </main>
    </div>
  );
}

