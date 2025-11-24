import React, { useState } from 'react'
import { auth, db } from '../../firebaseConfig'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { Plus, Loader } from 'lucide-react'
import styles from './Doctor.module.css'

const AddPatientForm = ({ doctorId, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    age: '',
    gender: '',
    medical_history: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
  e.preventDefault()
  setError('')

  if (!formData.name || !formData.email || !formData.password) {
    setError('Name, email and password are required')
    return
  }

  setLoading(true)

  try {
    const tempPassword = formData.password

    const userCredential = await createUserWithEmailAndPassword(
      auth,
      formData.email,
      tempPassword
    )

    const uid = userCredential.user.uid

    await setDoc(doc(db, 'patients', uid), {
      uid,
      doctorId,
      name: formData.name,
      email: formData.email,
      age: formData.age ? parseInt(formData.age) : null,
      gender: formData.gender || null,
      medical_history: formData.medical_history || '',
      role: 'patient',
    })

    setFormData({
      name: '',
      email: '',
      password: '',
      age: '',
      gender: '',
      medical_history: '',
    })

    alert(`✅ Patient added successfully!`)
    onSuccess()

  } catch (err) {
    setError(err.message || 'Failed to add patient')
  } finally {
    setLoading(false)
  }
}


  return (
    <div className={styles.formContainer}>
      <h2>Add New Patient</h2>

      {error && <div className={styles.error}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label>Full Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Patient full name"
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label>Email *</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="patient@email.com"
            required
          />
        </div>
        <div className={styles.formGroup}>
          <label>Password *</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="password"
            required
          />
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Age</label>
            <input
              type="number"
              name="age"
              value={formData.age}
              onChange={handleChange}
              placeholder="Age"
              min="0"
              max="150"
            />
          </div>

          <div className={styles.formGroup}>
            <label>Gender</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label>Medical History</label>
          <textarea
            name="medical_history"
            value={formData.medical_history}
            onChange={handleChange}
            placeholder="Enter patient's medical history..."
            rows="4"
          />
        </div>

        <button type="submit" className={styles.primaryBtn} disabled={loading}>
          {loading ? (
            <>
              <Loader size={18} className={styles.spinner} />
              Adding Patient...
            </>
          ) : (
            <>
              <Plus size={18} />
              Add Patient
            </>
          )}
        </button>
      </form>
    </div>
  )
}

export default AddPatientForm
