// src/lib/api.js
import axios from 'axios'

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ----------------- Chat with AI bot -----------------
export const chatWithBot = async (patientId, message) => {
  try {
    const response = await apiClient.post('/chat', {
      patient_id: patientId,
      message,
    });
    return response.data;
  } catch (error) {
    console.error('Chat error:', error);
    throw error;
  }
};


// ----------------- Generate Patient Summary -----------------
export const generatePatientSummary = async (patientId) => {
  try {
    const response = await apiClient.get(`/patient-summary/${patientId}`)
    return response.data
  } catch (error) {
    console.error('Summary error:', error)
    throw error
  }
}

// ----------------- Upload Patient Report -----------------
export const uploadPatientReport = async (patientId, doctorId, file, reportType, reportName) => {
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('patient_id', patientId)
    formData.append('doctor_id', doctorId)
    formData.append('report_type', reportType)
    formData.append('report_name', reportName)

    const response = await apiClient.post('/upload-report', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    return response.data
  } catch (error) {
    console.error('Upload report error:', error)
    throw error
  }
}

// ----------------- Fetch Patient Details -----------------
export const getPatientDetails = async (patientId) => {
  try {
    const response = await apiClient.get(`/patients/${patientId}`)
    return response.data
  } catch (error) {
    console.error('Fetch patient details error:', error)
    throw error
  }
}

