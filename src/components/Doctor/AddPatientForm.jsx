import React, { useState } from 'react'
import { addPatient } from '../../lib/api'
import { Plus, Loader } from 'lucide-react'
import styles from './Doctor.module.css'
import VoiceNotes from './VoiceNotes'

// Guided questions the doctor answers instead of one free-text box.
// medical_history is saved on the patient; the rest become their first condition.
const NOTE_FIELDS = [
  { name: 'diagnosis', label: "What is the patient's issue?", placeholder: 'e.g. Type 2 diabetes', input: true },
  { name: 'description', label: 'What symptoms or details should be noted?', placeholder: 'e.g. Fatigue and frequent thirst for 3 months' },
  { name: 'medication_instructions', label: 'What medication should they take, and how?', placeholder: 'e.g. Metformin 500mg twice a day after meals' },
  { name: 'lifestyle_recommendations', label: 'What lifestyle changes should they make?', placeholder: 'e.g. 30 minute walk daily, cut down on sugar' },
  { name: 'follow_up_guidelines', label: 'When and how should they follow up?', placeholder: 'e.g. Blood test and review in 4 weeks' },
  { name: 'warning_symptoms', label: 'Which warning symptoms need urgent attention?', placeholder: 'e.g. Blurred vision, chest pain, fainting' },
  { name: 'medical_history', label: 'Any past conditions, surgeries or allergies?', placeholder: 'e.g. Asthma since childhood, allergic to penicillin' },
  { name: 'other_notes', label: 'Other: any other comments?', placeholder: 'Anything else the patient should know' },
]

const CONDITION_FIELDS = NOTE_FIELDS.map(field => field.name).filter(name => name !== 'medical_history')

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  age: '',
  gender: '',
  ...Object.fromEntries(NOTE_FIELDS.map(field => [field.name, ''])),
}

const AddPatientForm = ({ onSuccess }) => {
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Add the dictated notes to the matching fields, keeping anything already typed
  const handleDictation = (fields) => {
    setFormData(prev => {
      const next = { ...prev }
      NOTE_FIELDS.forEach(({ name }) => {
        if (fields[name]) next[name] = [prev[name], fields[name]].filter(Boolean).join(' ')
      })
      return next
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.name || !formData.email || !formData.password) {
      setError('Name, email and password are required')
      return
    }

    const condition = Object.fromEntries(CONDITION_FIELDS.map(name => [name, (formData[name] || '').trim()]))
    const hasConditionNotes = Object.values(condition).some(Boolean)
    if (hasConditionNotes && !condition.diagnosis) {
      setError("Please fill in the patient's issue to save the other notes")
      return
    }

    setLoading(true)

    try {
      // The backend creates the patient's login and saves their profile in Postgres
      await addPatient({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        age: formData.age ? parseInt(formData.age) : null,
        gender: formData.gender || null,
        medical_history: formData.medical_history || '',
        condition: hasConditionNotes ? condition : null,
      })

      setFormData(EMPTY_FORM)

      alert('✅ Patient added successfully!')
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to add patient')
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

        <h3 className={styles.formSectionTitle}>Medical Notes</h3>

        <VoiceNotes onResult={handleDictation} />

        {NOTE_FIELDS.map(field => (
          <div key={field.name} className={styles.formGroup}>
            <label htmlFor={field.name}>{field.label}</label>
            {field.input ? (
              <input
                id={field.name}
                type="text"
                name={field.name}
                value={formData[field.name] || ''}
                onChange={handleChange}
                placeholder={field.placeholder}
              />
            ) : (
              <textarea
                id={field.name}
                name={field.name}
                value={formData[field.name] || ''}
                onChange={handleChange}
                placeholder={field.placeholder}
                rows="2"
              />
            )}
          </div>
        ))}

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
