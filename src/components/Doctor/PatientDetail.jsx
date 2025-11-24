import React, { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { db, storage } from '../../firebaseConfig'
import { collection, doc, setDoc, getDocs, query, where, deleteDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import styles from './Doctor.module.css'

const PatientDetail = ({ patient, onClose, onUpdate }) => {
  const [conditions, setConditions] = useState([])
  const [reports, setReports] = useState([])
  const [newCondition, setNewCondition] = useState({
    diagnosis: '',
    description: '',
    medication_instructions: '',
    follow_up_guidelines: '',
    lifestyle_recommendations: '',
    warning_symptoms: '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch conditions
        const condSnapshot = await getDocs(
          query(collection(db, 'patient_conditions'), where('patientId', '==', patient.uid))
        )
        const condData = condSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setConditions(condData)

        // Fetch reports
        const repSnapshot = await getDocs(
          query(collection(db, 'patient_reports'), where('patientId', '==', patient.uid))
        )
        const repData = repSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setReports(repData)
      } catch (error) {
        console.error('Error fetching patient details:', error)
      }
    }

    fetchData()
  }, [patient.uid])

  const handleAddCondition = async () => {
    if (!newCondition.diagnosis) {
      alert('Please enter a diagnosis')
      return
    }

    setLoading(true)
    try {
      const docRef = doc(collection(db, 'patient_conditions'))
      await setDoc(docRef, {
        patientId: patient.uid,
        ...newCondition,
      })

      setNewCondition({
        diagnosis: '',
        description: '',
        medication_instructions: '',
        follow_up_guidelines: '',
        lifestyle_recommendations: '',
        warning_symptoms: '',
      })

      // Refresh conditions
      const condSnapshot = await getDocs(
        query(collection(db, 'patient_conditions'), where('patientId', '==', patient.uid))
      )
      setConditions(condSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      onUpdate()
    } catch (error) {
      console.error('Error adding condition:', error)
      alert('Failed to add condition')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCondition = async (conditionId) => {
    if (window.confirm('Delete this condition?')) {
      try {
        await deleteDoc(doc(db, 'patient_conditions', conditionId))
        setConditions(conditions.filter(c => c.id !== conditionId))
        onUpdate()
      } catch (error) {
        console.error('Error deleting condition:', error)
      }
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    try {
      const fileRef = ref(storage, `patient_reports/${patient.uid}/${Date.now()}-${file.name}`)
      await uploadBytes(fileRef, file)
      const fileUrl = await getDownloadURL(fileRef)

      // Save metadata in Firestore
      const docRef = doc(collection(db, 'patient_reports'))
      await setDoc(docRef, {
        patientId: patient.uid,
        doctorId: patient.doctorId,
        reportType: file.type,
        reportName: file.name,
        fileUrl,
        uploadDate: new Date(),
      })

      // Refresh reports
      const repSnapshot = await getDocs(
        query(collection(db, 'patient_reports'), where('patientId', '==', patient.uid))
      )
      setReports(repSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      onUpdate()
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('Failed to upload file')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>{patient.name} - Details</h2>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={24} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <section className={styles.section}>
            <h3>Medical Conditions</h3>
            <div className={styles.conditionsList}>
              {conditions.map(condition => (
                <div key={condition.id} className={styles.conditionItem}>
                  <div>
                    <p className={styles.diagnosisTitle}>{condition.diagnosis}</p>
                    {condition.description && <p className={styles.small}>{condition.description}</p>}
                    {condition.medication_instructions && (
                      <p className={styles.small}><strong>Medication:</strong> {condition.medication_instructions}</p>
                    )}
                    {condition.follow_up_guidelines && (
                      <p className={styles.small}><strong>Follow-up:</strong> {condition.follow_up_guidelines}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteCondition(condition.id)}
                    className={styles.deleteBtn}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className={styles.addConditionForm}>
              <h4>Add New Condition</h4>
              <input
                type="text"
                placeholder="Diagnosis (required)"
                value={newCondition.diagnosis}
                onChange={(e) => setNewCondition({ ...newCondition, diagnosis: e.target.value })}
              />
              <textarea
                placeholder="Description"
                value={newCondition.description}
                onChange={(e) => setNewCondition({ ...newCondition, description: e.target.value })}
                rows="2"
              />
              <textarea
                placeholder="Medication Instructions"
                value={newCondition.medication_instructions}
                onChange={(e) => setNewCondition({ ...newCondition, medication_instructions: e.target.value })}
                rows="2"
              />
              <textarea
                placeholder="Follow-up Guidelines"
                value={newCondition.follow_up_guidelines}
                onChange={(e) => setNewCondition({ ...newCondition, follow_up_guidelines: e.target.value })}
                rows="2"
              />
              <textarea
                placeholder="Lifestyle Recommendations"
                value={newCondition.lifestyle_recommendations}
                onChange={(e) => setNewCondition({ ...newCondition, lifestyle_recommendations: e.target.value })}
                rows="2"
              />
              <textarea
                placeholder="Warning Symptoms to Watch For"
                value={newCondition.warning_symptoms}
                onChange={(e) => setNewCondition({ ...newCondition, warning_symptoms: e.target.value })}
                rows="2"
              />
              <button
                onClick={handleAddCondition}
                className={styles.primaryBtn}
                disabled={loading}
              >
                <Plus size={16} /> Add Condition
              </button>
            </div>
          </section>

          <section className={styles.section}>
            <h3>Medical Reports</h3>
            <div className={styles.reportsList}>
              {reports.map(report => (
                <div key={report.id} className={styles.reportItem}>
                  <p>{report.reportName}</p>
                  <small>{report.uploadDate?.toDate ? report.uploadDate.toDate().toLocaleDateString() : new Date(report.uploadDate).toLocaleDateString()}</small>
                </div>
              ))}
            </div>

            <div className={styles.uploadSection}>
              <label className={styles.uploadLabel}>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={loading}
                  style={{ display: 'none' }}
                />
                <span>Upload Medical Report</span>
              </label>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default PatientDetail
