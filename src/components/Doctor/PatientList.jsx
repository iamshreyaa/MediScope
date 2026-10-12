import React, { useState } from 'react'
import { Edit2, Trash2, ChevronDown } from 'lucide-react'
import { deletePatient } from '../../lib/api'
import styles from './Doctor.module.css'
import PatientDetail from './PatientDetail'

const openQuestions = (patient) => (patient.questions || []).filter(q => !q.resolved)

// The dashboard owns the patient list; onUpdate asks it to reload from the backend
const PatientList = ({ patients, onUpdate }) => {
  const [expandedPatient, setExpandedPatient] = useState(null)
  const [editingPatient, setEditingPatient] = useState(null)

  const handleDelete = async (patientId) => {
    if (window.confirm('Are you sure you want to delete this patient?')) {
      try {
        await deletePatient(patientId)
        onUpdate()
      } catch (error) {
        console.error('Error deleting patient:', error)
        alert('Failed to delete patient')
      }
    }
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
          onUpdate={onUpdate}
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
              {openQuestions(patient).some(q => q.urgent) && (
                <span className={`${styles.badge} ${styles.badgeUrgent}`}>Urgent symptom reported</span>
              )}
              {openQuestions(patient).length > 0 && (
                <span className={`${styles.badge} ${styles.badgeInfo}`}>
                  {openQuestions(patient).length} open question{openQuestions(patient).length > 1 ? 's' : ''}
                </span>
              )}
              {patient.checkins?.[0] && (
                <span className={`${styles.badge} ${patient.checkins[0].feeling === 'worse' ? styles.badgeUrgent : ''}`}>
                  Last check-in: {patient.checkins[0].feeling === 'same' ? 'about the same' : patient.checkins[0].feeling}
                </span>
              )}
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
