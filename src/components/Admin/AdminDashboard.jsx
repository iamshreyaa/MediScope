import React, { useState, useEffect } from "react";
import { Plus, LogOut, Stethoscope, Users, UserX, Trash2, Loader } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { getAdminOverview, addDoctor, removeDoctor, assignPatient } from "../../lib/api";
import styles from "../Doctor/Doctor.module.css";

const EMPTY_DOCTOR = {
  name: "",
  email: "",
  password: "",
  specialization: "",
  license_number: "",
  hospital_name: "",
};

const initials = (name) =>
  (name || "?")
    .replace(/^dr\.?\s+/i, "")
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export default function AdminDashboard() {
  const { userData: adminInfo, logout } = useAuth();

  const [activeTab, setActiveTab] = useState("doctors");
  const [overview, setOverview] = useState({ doctors: [], unassigned_patients: [], patient_count: 0 });
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(EMPTY_DOCTOR);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchOverview = async () => {
    try {
      setOverview(await getAdminOverview());
    } catch (err) {
      console.error("Failed to fetch admin overview:", err);
    }
  };

  useEffect(() => {
    fetchOverview().finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddDoctor = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await addDoctor(formData);
      setFormData(EMPTY_DOCTOR);
      await fetchOverview();
      setActiveTab("doctors");
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to add doctor");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveDoctor = async (doctor) => {
    const patientNote = doctor.patient_count
      ? ` Their ${doctor.patient_count} patient${doctor.patient_count > 1 ? "s" : ""} will be kept and become unassigned.`
      : "";
    if (!window.confirm(`Remove ${doctor.name}? They will no longer be able to sign in.${patientNote}`)) return;
    try {
      await removeDoctor(doctor.id);
      await fetchOverview();
    } catch (err) {
      console.error("Error removing doctor:", err);
      alert("Failed to remove doctor");
    }
  };

  const handleAssign = async (patientId, doctorId) => {
    if (!doctorId) return;
    try {
      await assignPatient(patientId, doctorId);
      await fetchOverview();
    } catch (err) {
      console.error("Error assigning patient:", err);
      alert("Failed to assign patient");
    }
  };

  if (loading) return <div className={styles.loading}>Loading...</div>;

  const { doctors, unassigned_patients: unassigned } = overview;
  const stats = [
    { icon: Stethoscope, label: "Doctors", value: doctors.length },
    { icon: Users, label: "Patients", value: overview.patient_count },
    { icon: UserX, label: "Patients without a doctor", value: unassigned.length, urgent: true },
  ];

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Admin Dashboard</h1>

          {adminInfo && (
            <div className={styles.doctorInfo}>
              <p className={styles.name}>{adminInfo.name}</p>
              <p className={styles.specialization}>Clinic administrator</p>
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
          className={`${styles.tabBtn} ${activeTab === "doctors" ? styles.active : ""}`}
          onClick={() => setActiveTab("doctors")}
        >
          <Stethoscope size={18} />
          Doctors ({doctors.length})
        </button>

        <button
          className={`${styles.tabBtn} ${activeTab === "add" ? styles.active : ""}`}
          onClick={() => setActiveTab("add")}
        >
          <Plus size={18} />
          Add Doctor
        </button>
      </nav>

      <main className={styles.mainContent}>
        {activeTab === "doctors" && (
          <>
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

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>Doctors</h2>
                  <p>Doctors sign in with the email and password you set, and add their own patients.</p>
                </div>
                <button className={styles.primaryBtn} style={{ marginTop: 0 }} onClick={() => setActiveTab("add")}>
                  <Plus size={18} />
                  Add Doctor
                </button>
              </div>

              {doctors.length === 0 ? (
                <p className={styles.tableEmpty}>No doctors yet. Add a doctor to get started.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Doctor</th>
                        <th>Specialization</th>
                        <th>Hospital</th>
                        <th>License</th>
                        <th>Patients</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {doctors.map((doctor) => (
                        <tr key={doctor.id}>
                          <td>
                            <div className={styles.person}>
                              <span className={styles.avatar}>{initials(doctor.name)}</span>
                              <div>
                                <p className={styles.personName}>{doctor.name || "Unnamed"}</p>
                                <p className={styles.personSub}>{doctor.email}</p>
                              </div>
                            </div>
                          </td>
                          <td>{doctor.specialization || "—"}</td>
                          <td>{doctor.hospital_name || "—"}</td>
                          <td>{doctor.license_number || "—"}</td>
                          <td><span className={styles.badge}>{doctor.patient_count}</span></td>
                          <td>
                            <button className={styles.dangerBtn} onClick={() => handleRemoveDoctor(doctor)}>
                              <Trash2 size={14} />
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {unassigned.length > 0 && (
              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <h2>Patients without a doctor</h2>
                    <p>These patients can sign in, but no doctor can see them until you assign one.</p>
                  </div>
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Patient</th>
                        <th>Assign to</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unassigned.map((patient) => (
                        <tr key={patient.id}>
                          <td>
                            <div className={styles.person}>
                              <span className={styles.avatar}>{initials(patient.name)}</span>
                              <div>
                                <p className={styles.personName}>{patient.name || "Unnamed"}</p>
                                <p className={styles.personSub}>{patient.email}</p>
                              </div>
                            </div>
                          </td>
                          <td>
                            <select
                              className={styles.assignSelect}
                              value=""
                              onChange={(e) => handleAssign(patient.id, e.target.value)}
                              disabled={doctors.length === 0}
                            >
                              <option value="">{doctors.length ? "Choose a doctor" : "Add a doctor first"}</option>
                              {doctors.map((doctor) => (
                                <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        {activeTab === "add" && (
          <div className={styles.formContainer}>
            <h2>Add New Doctor</h2>

            {error && <div className={styles.error}>{error}</div>}

            <form onSubmit={handleAddDoctor} className={styles.form}>
              <div className={styles.formGroup}>
                <label>Full Name *</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Dr. full name" required />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Email *</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="doctor@clinic.com" required />
                </div>

                <div className={styles.formGroup}>
                  <label>Temporary Password *</label>
                  <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="At least 6 characters" minLength={6} required />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Specialization</label>
                  <input type="text" name="specialization" value={formData.specialization} onChange={handleChange} placeholder="e.g. Dermatology" />
                </div>

                <div className={styles.formGroup}>
                  <label>License Number</label>
                  <input type="text" name="license_number" value={formData.license_number} onChange={handleChange} placeholder="Registration number" />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Hospital or Clinic</label>
                <input type="text" name="hospital_name" value={formData.hospital_name} onChange={handleChange} placeholder="Where they practise" />
              </div>

              <button type="submit" className={styles.primaryBtn} disabled={saving}>
                {saving ? (
                  <>
                    <Loader size={18} className={styles.spinner} />
                    Adding Doctor...
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    Add Doctor
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
