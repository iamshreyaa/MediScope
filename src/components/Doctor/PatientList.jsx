import React, { useState, useEffect, useCallback } from 'react'
import { Edit2, Trash2, ChevronDown } from 'lucide-react'
import { db } from '../../firebaseConfig'
import { collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore'
import styles from './Doctor.module.css'
import PatientDetail from './PatientDetail'

const PatientList = ({ doctorId, onUpdate, patients: patientsProp }) => {
  const [patients, setPatients] = useState(patientsProp || [])
  const [expandedPatient, setExpandedPatient] = useState(null)
  const [editingPatient, setEditingPatient] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch patients for this doctor
  const fetchPatients = useCallback(async () => {
    setLoading(true)
    try {
      const q = query(collection(db, 'patients'), where('doctorId', '==', doctorId))
      const snapshot = await getDocs(q)
      const patientData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setPatients(patientData)
    } catch (err) {
      console.error('Error fetching patients:', err)
    } finally {
      setLoading(false)
    }
  }, [doctorId])

  useEffect(() => {
    if (patientsProp && Array.isArray(patientsProp)) {
      // If parent passed patients, use them and skip fetching
      setPatients(patientsProp)
      setLoading(false)
      return
    }

    if (doctorId) {
      fetchPatients()
    } else {
      setLoading(false)
    }
  }, [doctorId, fetchPatients, patientsProp])

  const handleDelete = async (patientId) => {
    if (window.confirm('Are you sure you want to delete this patient?')) {
      try {
        await deleteDoc(doc(db, 'patients', patientId))
        fetchPatients()
        onUpdate()
      } catch (error) {
        console.error('Error deleting patient:', error)
        alert('Failed to delete patient')
      }
    }
  }

  if (loading) {
    return <div className={styles.loading}>Loading patients...</div>
  }

  if (patients.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No patients yet. Add a patient to get started.</p>
      </div>
    )
  }

  return (
    <div className={styles.patientListContainer}>
      {editingPatient && (
        <PatientDetail
          patient={editingPatient}
          onClose={() => setEditingPatient(null)}
          onUpdate={fetchPatients}
        />
      )}

      <div className={styles.patientGrid}>
        {patients.map(patient => (
          <div key={patient.id} className={styles.patientCard}>
            <div className={styles.cardHeader}>
              <div>
                <h3>{patient.name}</h3>
                <p className={styles.patientEmail}>{patient.email}</p>
              </div>
              <button
                className={styles.expandBtn}
                onClick={() => setExpandedPatient(expandedPatient === patient.id ? null : patient.id)}
              >
                <ChevronDown size={20} />
              </button>
            </div>

            <div className={styles.cardMeta}>
              <span className={styles.badge}>{patient.age || 'N/A'} years</span>
              <span className={styles.badge}>{patient.gender || 'N/A'}</span>
            </div>

            {expandedPatient === patient.id && (
              <div className={styles.cardExpanded}>
                {patient.conditions?.length > 0 && (
                  <div className={styles.section}>
                    <h4>Conditions</h4>
                    <ul>
                      {patient.conditions.map(cond => (
                        <li key={cond.id}>{cond.diagnosis}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {patient.reports?.length > 0 && (
                  <div className={styles.section}>
                    <h4>Reports</h4>
                    <ul>
                      {patient.reports.map(report => (
                        <li key={report.id}>{report.report_name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className={styles.cardActions}>
              <button
                className={styles.actionBtn}
                onClick={() => setEditingPatient(patient)}
              >
                <Edit2 size={16} />
                Edit
              </button>
              <button
                className={styles.actionBtn}
                onClick={() => handleDelete(patient.id)}
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PatientList
