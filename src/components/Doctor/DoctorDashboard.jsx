import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { getMyPatients } from "../../lib/api";

import { Plus, LogOut, Users, MessageCircleQuestion, AlertTriangle, CalendarCheck } from "lucide-react";
import PatientList from "./PatientList";
import AddPatientForm from "./AddPatientForm";
import styles from "./Doctor.module.css";

export default function DoctorDashboard() {
  // The doctor's profile comes from the backend via AuthContext
  const { userData: doctorInfo, logout } = useAuth();

  const [activeTab, setActiveTab] = useState("patients");
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMyPatients = async () => {
    try {
      setPatients(await getMyPatients());
    } catch (error) {
      console.error("Failed to fetch doctor patients:", error);
      setPatients([]);
    }
  };

  const handlePatientAdded = async () => {
    await fetchMyPatients();
    setActiveTab("patients");
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  useEffect(() => {
    fetchMyPatients().finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.loading}>Loading...</div>;

  // Numbers for the summary row
  const openQuestions = patients.flatMap((p) => (p.questions || []).filter((q) => !q.resolved));
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const checkedIn = patients.filter((p) => p.checkins?.[0] && new Date(p.checkins[0].created_at).getTime() >= weekAgo).length;
  const stats = [
    { icon: Users, label: "Patients", value: patients.length },
    { icon: MessageCircleQuestion, label: "Open questions", value: openQuestions.length },
    { icon: AlertTriangle, label: "Urgent flags", value: openQuestions.filter((q) => q.urgent).length, urgent: true },
    { icon: CalendarCheck, label: "Checked in this week", value: checkedIn },
  ];

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
        {activeTab === "patients" && (
          <div className={styles.statGrid}>
            {stats.map(({ icon: Icon, label, value, urgent }) => (
              <div key={label} className={`${styles.statCard} ${urgent && value > 0 ? styles.statUrgent : ""}`}>
                <span className={styles.statIcon}><Icon size={20} /></span>
                <div>
                  <p className={styles.statValue}>{value}</p>
                  <p className={styles.statLabel}>{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "patients" && <PatientList patients={patients} onUpdate={fetchMyPatients} />}

        {activeTab === "add" && (
          <AddPatientForm onSuccess={handlePatientAdded} />
        )}
      </main>
    </div>
  );
}

