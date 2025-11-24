import React from 'react'
import { AlertCircle, Pill, TrendingUp, Heart } from 'lucide-react'
import styles from './Patient.module.css'

const PatientInfo = ({ patientData, conditions, reports }) => {
  return (
    <div className={styles.infoContainer}>
      {/* Personal Information */}
      <section className={styles.section}>
        <h2>Personal Information</h2>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <label>Name</label>
            <p>{patientData.name}</p>
          </div>
          <div className={styles.infoItem}>
            <label>Email</label>
            <p>{patientData.email}</p>
          </div>
          <div className={styles.infoItem}>
            <label>Age</label>
            <p>{patientData.age || 'Not specified'}</p>
          </div>
          <div className={styles.infoItem}>
            <label>Gender</label>
            <p>{patientData.gender || 'Not specified'}</p>
          </div>
        </div>
        {patientData.medical_history && (
          <div className={styles.historySection}>
            <h3>Medical History</h3>
            <p>{patientData.medical_history}</p>
          </div>
        )}
      </section>

      {/* Medical Conditions */}
      <section className={styles.section}>
        <h2>Medical Conditions</h2>
        {conditions.length === 0 ? (
          <div className={styles.emptySection}>
            <Heart size={32} />
            <p>No conditions recorded yet</p>
          </div>
        ) : (
          <div className={styles.conditionsGrid}>
            {conditions.map(condition => (
              <div key={condition.id} className={styles.conditionCard}>
                <div className={styles.cardTitle}>
                  <Pill size={20} />
                  <h3>{condition.diagnosis}</h3>
                </div>

                {condition.description && (
                  <div className={styles.cardItem}>
                    <label>Description</label>
                    <p>{condition.description}</p>
                  </div>
                )}

                {condition.medication_instructions && (
                  <div className={styles.cardItem}>
                    <label>Medication Instructions</label>
                    <p>{condition.medication_instructions}</p>
                  </div>
                )}

                {condition.follow_up_guidelines && (
                  <div className={styles.cardItem}>
                    <label>Follow-up Guidelines</label>
                    <p>{condition.follow_up_guidelines}</p>
                  </div>
                )}

                {condition.lifestyle_recommendations && (
                  <div className={styles.cardItem}>
                    <label>Lifestyle Recommendations</label>
                    <p>{condition.lifestyle_recommendations}</p>
                  </div>
                )}

                {condition.warning_symptoms && (
                  <div className={`${styles.cardItem} ${styles.warning}`}>
                    <div className={styles.warningHeader}>
                      <AlertCircle size={16} />
                      <label>Warning Symptoms</label>
                    </div>
                    <p>{condition.warning_symptoms}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Medical Reports */}
      <section className={styles.section}>
        <h2>Medical Reports</h2>
        {reports.length === 0 ? (
          <div className={styles.emptySection}>
            <TrendingUp size={32} />
            <p>No reports uploaded yet</p>
          </div>
        ) : (
          <div className={styles.reportsList}>
            {reports.map(report => (
              <div key={report.id} className={styles.reportItem}>
                <div className={styles.reportInfo}>
                  <p className={styles.reportName}>{report.report_name}</p>
                  <small className={styles.reportDate}>
                    Uploaded on {report.upload_date?.toDate ? report.upload_date.toDate().toLocaleDateString() : new Date(report.upload_date).toLocaleDateString()}
                  </small>
                </div>
                {report.file_url && (
                  <a
                    href={report.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.downloadLink}
                  >
                    View
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default PatientInfo
