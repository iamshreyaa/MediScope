import React, { useState, useEffect } from 'react'
import { X, Plus, Trash2, AlertTriangle, Pencil, Check } from 'lucide-react'
import { getPatientDetails, updatePatient, addCondition, updateCondition, deleteCondition, uploadPatientReport, renameReport, deleteReport, openReportFile, answerQuestion } from '../../lib/api'
import styles from './Doctor.module.css'
import VoiceNotes from './VoiceNotes'

// The note fields of a condition, in the order they are shown and edited
const CONDITION_FIELDS = [
  { name: 'description', label: 'Description' },
  { name: 'medication_instructions', label: 'Medication' },
  { name: 'lifestyle_recommendations', label: 'Lifestyle' },
  { name: 'follow_up_guidelines', label: 'Follow-up' },
  { name: 'warning_symptoms', label: 'Warning symptoms' },
  { name: 'other_notes', label: 'Other' },
]

const PatientDetail = ({ patient, onClose, onUpdate }) => {
  const [profile, setProfile] = useState(patient)
  const [profileDraft, setProfileDraft] = useState(null) // set while the profile is being edited
  const [conditionDraft, setConditionDraft] = useState(null) // the condition being edited, if any
  const [reportDraft, setReportDraft] = useState(null) // the report being renamed, if any
  const [conditions, setConditions] = useState([])
  const [reports, setReports] = useState([])
  const [questions, setQuestions] = useState([])
  const [checkins, setCheckins] = useState([])
  const [answers, setAnswers] = useState({}) // draft replies, keyed by question id
  const [newCondition, setNewCondition] = useState({
    diagnosis: '',
    description: '',
    medication_instructions: '',
    follow_up_guidelines: '',
    lifestyle_recommendations: '',
    warning_symptoms: '',
    other_notes: '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const patientId = patient?.uid || patient?.id
        if (!patientId) return

        const details = await getPatientDetails(patientId)
        setProfile(details)
        setConditions(details.conditions)
        setReports(details.reports)
        setQuestions(details.questions)
        setCheckins(details.checkins)
      } catch (error) {
        console.error('Error fetching patient details:', error)
      }
    }

    fetchData()
  }, [patient])

  // Add the dictated notes to the matching fields, keeping anything already typed.
  // This form has no medical history field, so that part goes under other comments.
  const handleDictation = ({ medical_history, ...fields }) => {
    if (medical_history) {
      fields.other_notes = [fields.other_notes, `Past history: ${medical_history}`].filter(Boolean).join(' ')
    }
    setNewCondition(prev => {
      const next = { ...prev }
      Object.keys(prev).forEach(name => {
        if (fields[name]) next[name] = [prev[name], fields[name]].filter(Boolean).join(' ')
      })
      return next
    })
  }

  const handleSaveProfile = async () => {
    if (!profileDraft.name.trim()) {
      alert('Please enter the patient\'s name')
      return
    }
    try {
      const saved = await updatePatient(profile.id, {
        name: profileDraft.name,
        age: profileDraft.age === '' ? null : parseInt(profileDraft.age),
        gender: profileDraft.gender || null,
        medical_history: profileDraft.medical_history,
      })
      setProfile(saved)
      setProfileDraft(null)
      onUpdate()
    } catch (error) {
      console.error('Error updating patient:', error)
      alert('Failed to save the changes')
    }
  }

  const handleSaveCondition = async () => {
    if (!conditionDraft.diagnosis.trim()) {
      alert('Please enter a diagnosis')
      return
    }
    try {
      const { id, ...fields } = conditionDraft
      const saved = await updateCondition(id, fields)
      setConditions(conditions.map(c => (c.id === id ? saved : c)))
      setConditionDraft(null)
      onUpdate()
    } catch (error) {
      console.error('Error updating condition:', error)
      alert('Failed to save the changes')
    }
  }

  const startEditingCondition = (condition) => {
    const draft = { id: condition.id, diagnosis: condition.diagnosis || '' }
    CONDITION_FIELDS.forEach(({ name }) => { draft[name] = condition[name] || '' })
    setConditionDraft(draft)
  }

  const handleAddCondition = async () => {
    if (!newCondition.diagnosis) {
      alert('Please enter a diagnosis')
      return
    }

    setLoading(true)
    try {
      const patientId = patient?.uid || patient?.id
      if (!patientId) return

      const saved = await addCondition(patientId, newCondition)

      setNewCondition({
        diagnosis: '',
        description: '',
        medication_instructions: '',
        follow_up_guidelines: '',
        lifestyle_recommendations: '',
        warning_symptoms: '',
        other_notes: '',
      })

      setConditions([...conditions, saved])
      onUpdate()
    } catch (error) {
      console.error('Error adding condition:', error)
      alert('Failed to add condition')
    } finally {
      setLoading(false)
    }
  }

  // Send the typed reply, or just mark the question resolved when there is none
  const handleAnswerQuestion = async (questionId) => {
    try {
      const saved = await answerQuestion(questionId, answers[questionId] || '')
      setQuestions(questions.map(q => (q.id === questionId ? saved : q)))
      onUpdate()
    } catch (error) {
      console.error('Error answering question:', error)
      alert('Failed to save your reply')
    }
  }

  const handleDeleteCondition = async (conditionId) => {
    if (window.confirm('Delete this condition?')) {
      try {
        await deleteCondition(conditionId)
        setConditions(conditions.filter(c => c.id !== conditionId))
        onUpdate()
      } catch (error) {
        console.error('Error deleting condition:', error)
      }
    }
  }

  const handleRenameReport = async () => {
    if (!reportDraft.report_name.trim()) {
      alert('Please enter a name for the report')
      return
    }
    try {
      const saved = await renameReport(reportDraft.id, reportDraft.report_name)
      setReports(reports.map(r => (r.id === saved.id ? saved : r)))
      setReportDraft(null)
      onUpdate()
    } catch (error) {
      console.error('Error renaming report:', error)
      alert('Failed to rename the report')
    }
  }

  const handleDeleteReport = async (report) => {
    if (window.confirm(`Delete "${report.report_name}"? The file will be removed for you and the patient.`)) {
      try {
        await deleteReport(report.id)
        setReports(reports.filter(r => r.id !== report.id))
        onUpdate()
      } catch (error) {
        console.error('Error deleting report:', error)
        alert('Failed to delete the report')
      }
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    try {
      const patientId = patient?.uid || patient?.id
      if (!patientId) return

      const saved = await uploadPatientReport(patientId, file)
      setReports([...reports, saved])
      e.target.value = ''
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
          <h2>{profile.name} - Details</h2>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={24} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <section className={styles.section}>
            <div className={styles.sectionTitleRow}>
              <h3>Patient Profile</h3>
              {!profileDraft && (
                <button
                  className={styles.editBtn}
                  onClick={() => setProfileDraft({
                    name: profile.name || '',
                    age: profile.age ?? '',
                    gender: profile.gender || '',
                    medical_history: profile.medical_history || '',
                  })}
                >
                  <Pencil size={14} /> Edit
                </button>
              )}
            </div>

            {profileDraft ? (
              <div className={styles.addConditionForm}>
                <label className={styles.fieldLabel}>
                  Full name
                  <input
                    type="text"
                    placeholder="Full name (required)"
                    value={profileDraft.name}
                    onChange={(e) => setProfileDraft({ ...profileDraft, name: e.target.value })}
                  />
                </label>
                <div className={styles.formRow}>
                  <label className={styles.fieldLabel}>
                    Age
                    <input
                      type="number"
                      placeholder="Age"
                      min="0"
                      max="150"
                      value={profileDraft.age}
                      onChange={(e) => setProfileDraft({ ...profileDraft, age: e.target.value })}
                    />
                  </label>
                  <label className={styles.fieldLabel}>
                    Gender
                    <select
                      value={profileDraft.gender}
                      onChange={(e) => setProfileDraft({ ...profileDraft, gender: e.target.value })}
                    >
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>
                </div>
                <label className={styles.fieldLabel}>
                  Medical history
                  <textarea
                    placeholder="Past conditions, surgeries or allergies"
                    value={profileDraft.medical_history}
                    onChange={(e) => setProfileDraft({ ...profileDraft, medical_history: e.target.value })}
                    rows="2"
                  />
                </label>
                <div className={styles.editActions}>
                  <button onClick={handleSaveProfile} className={styles.saveBtn}><Check size={15} /> Save</button>
                  <button onClick={() => setProfileDraft(null)} className={styles.actionBtn}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className={styles.conditionItem}>
                <div>
                  <p className={styles.small}><strong>Email:</strong> {profile.email}</p>
                  <p className={styles.small}><strong>Age:</strong> {profile.age || 'Not specified'}</p>
                  <p className={styles.small}><strong>Gender:</strong> {profile.gender || 'Not specified'}</p>
                  <p className={styles.small}><strong>Medical history:</strong> {profile.medical_history || 'None recorded'}</p>
                </div>
              </div>
            )}
          </section>

          {questions.length > 0 && (
            <section className={styles.section}>
              <h3>Questions from the Patient</h3>
              <div className={styles.conditionsList}>
                {questions.map(question => (
                  <div key={question.id} className={`${styles.questionItem} ${question.urgent && !question.resolved ? styles.urgent : ''}`}>
                    <p className={styles.diagnosisTitle}>
                      {question.urgent && <AlertTriangle size={14} />} {question.question}
                    </p>
                    <p className={styles.small}>
                      {question.urgent ? 'Urgent symptom reported · ' : ''}
                      {new Date(question.created_at).toLocaleString()}
                    </p>
                    {question.resolved ? (
                      <p className={styles.small}>
                        <strong>{question.answer ? 'Your reply:' : 'Marked as resolved'}</strong> {question.answer}
                      </p>
                    ) : (
                      <>
                        <textarea
                          placeholder="Reply to the patient (the assistant will also use your reply)"
                          value={answers[question.id] || ''}
                          onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                          rows="2"
                        />
                        <button onClick={() => handleAnswerQuestion(question.id)} className={styles.actionBtn}>
                          {(answers[question.id] || '').trim() ? 'Send Reply' : 'Mark as Resolved'}
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {checkins.length > 0 && (
            <section className={styles.section}>
              <h3>Weekly Check-ins</h3>
              <div className={styles.conditionsList}>
                {checkins.map(checkin => (
                  <div key={checkin.id} className={styles.questionItem}>
                    <p className={styles.diagnosisTitle}>
                      Feeling {checkin.feeling === 'same' ? 'about the same' : checkin.feeling}
                    </p>
                    {checkin.note && <p className={styles.small}>{checkin.note}</p>}
                    <p className={styles.small}>{new Date(checkin.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className={styles.section}>
            <h3>Medical Conditions</h3>
            <div className={styles.conditionsList}>
              {conditions.map(condition => (
                conditionDraft?.id === condition.id ? (
                  <div key={condition.id} className={styles.addConditionForm}>
                    <h4>Edit Condition</h4>
                    <label className={styles.fieldLabel}>
                      Diagnosis
                      <input
                        type="text"
                        placeholder="Diagnosis (required)"
                        value={conditionDraft.diagnosis}
                        onChange={(e) => setConditionDraft({ ...conditionDraft, diagnosis: e.target.value })}
                      />
                    </label>
                    {CONDITION_FIELDS.map(({ name, label }) => (
                      <label key={name} className={styles.fieldLabel}>
                        {label}
                        <textarea
                          aria-label={label}
                          value={conditionDraft[name]}
                          onChange={(e) => setConditionDraft({ ...conditionDraft, [name]: e.target.value })}
                          rows="2"
                        />
                      </label>
                    ))}
                    <div className={styles.editActions}>
                      <button onClick={handleSaveCondition} className={styles.saveBtn}><Check size={15} /> Save</button>
                      <button onClick={() => setConditionDraft(null)} className={styles.actionBtn}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div key={condition.id} className={styles.conditionItem}>
                    <div>
                      <p className={styles.diagnosisTitle}>{condition.diagnosis}</p>
                      {CONDITION_FIELDS.map(({ name, label }) => condition[name] && (
                        <p key={name} className={styles.small}><strong>{label}:</strong> {condition[name]}</p>
                      ))}
                    </div>
                    <div className={styles.itemActions}>
                      <button
                        onClick={() => startEditingCondition(condition)}
                        className={styles.iconBtn}
                        aria-label="Edit condition"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteCondition(condition.id)}
                        className={styles.deleteBtn}
                        aria-label="Delete condition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )
              ))}
            </div>

            <div className={styles.addConditionForm}>
              <h4>Add New Condition</h4>
              <VoiceNotes onResult={handleDictation} />
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
              <textarea
                placeholder="Other Comments"
                value={newCondition.other_notes}
                onChange={(e) => setNewCondition({ ...newCondition, other_notes: e.target.value })}
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
                reportDraft?.id === report.id ? (
                  <div key={report.id} className={styles.reportItem}>
                    <input
                      type="text"
                      className={styles.reportNameInput}
                      aria-label="Report name"
                      value={reportDraft.report_name}
                      onChange={(e) => setReportDraft({ ...reportDraft, report_name: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && handleRenameReport()}
                      autoFocus
                    />
                    <button onClick={handleRenameReport} className={styles.saveBtn}><Check size={15} /> Save</button>
                    <button onClick={() => setReportDraft(null)} className={styles.actionBtn}>Cancel</button>
                  </div>
                ) : (
                  <div key={report.id} className={styles.reportItem}>
                    <p>{report.report_name}</p>
                    <small>{new Date(report.upload_date).toLocaleDateString()}</small>
                    <button onClick={() => openReportFile(report.id)} className={styles.actionBtn}>View</button>
                    <button
                      onClick={() => setReportDraft({ id: report.id, report_name: report.report_name || '' })}
                      className={styles.iconBtn}
                      aria-label="Rename report"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteReport(report)}
                      className={styles.deleteBtn}
                      aria-label="Delete report"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )
              ))}
            </div>
            <input type="file" onChange={handleFileUpload} />
          </section>
        </div>
      </div>
    </div>
  )
}

export default PatientDetail
