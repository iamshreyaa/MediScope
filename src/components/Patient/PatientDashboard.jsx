import React, { useState, useEffect, useContext } from 'react'
import { AuthContext } from '../../contexts/AuthContext'
import { LogOut, MessageCircle, FileText } from 'lucide-react'
import styles from './Patient.module.css'
import ChatInterface from './ChatInterface'
import PatientInfo from './PatientInfo'
import { getPatientDetails } from '../../lib/api'

const PatientDashboard = () => {
  const { userData: user, loading: authLoading, logout } = useContext(AuthContext)
  const [activeTab, setActiveTab] = useState('chat')
  const [patientData, setPatientData] = useState(null)
  const [conditions, setConditions] = useState([])
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true) // local data fetch loading

  useEffect(() => {
    const fetchPatientData = async () => {
      if (!user) return

      try {
        // Fetch profile, conditions and reports from the backend
        const { conditions, reports, ...patient } = await getPatientDetails(user.uid)
        setPatientData(patient)
        setConditions(conditions)
        setReports(reports)
      } catch (error) {
        console.error('Error fetching patient data:', error)
        setPatientData(null)
      } finally {
        setLoading(false)
      }
    }

    if (!authLoading && user) {
      fetchPatientData()
    }
    // Re-run on tab change so questions and doctor replies stay up to date
  }, [authLoading, user, activeTab])

  const handleLogout = async () => {
    await logout()
    window.location.href = '/'
  }

  // Wait for authentication first
  if (authLoading) {
    return <div className={styles.loading}>Waiting for authentication...</div>
  }

  if (!user) {
    return <div className={styles.loading}>You must be logged in</div>
  }

  // Show local data loading
  if (loading) {
    return <div className={styles.loading}>Loading patient data...</div>
  }

  if (!patientData) {
    return <div className={styles.loading}>Patient data not found</div>
  }

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Patient Portal</h1>
          <div className={styles.patientInfo}>
            <p className={styles.name}>{patientData.name}</p>
            <p className={styles.email}>{patientData.email}</p>
          </div>
        </div>
        <button onClick={handleLogout} className={styles.logoutBtn}>
          <LogOut size={18} />
          Logout
        </button>
      </header>

      <nav className={styles.tabNav}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'chat' ? styles.active : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageCircle size={18} />
          Health Assistant
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'info' ? styles.active : ''}`}
          onClick={() => setActiveTab('info')}
        >
          <FileText size={18} />
          My Health Info
        </button>
      </nav>

      <main className={styles.mainContent}>
        {activeTab === 'chat' && <ChatInterface patient={patientData} />}
        {activeTab === 'info' && (
          <PatientInfo
            patientData={patientData}
            conditions={conditions}
            reports={reports}
            questions={patientData.questions}
          />
        )}
      </main>
    </div>
  )
}

export default PatientDashboard
