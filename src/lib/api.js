// src/lib/api.js
import axios from 'axios'
import { auth } from '../firebaseConfig'

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
})

// Send the Firebase ID token with every request so the backend knows who is calling
apiClient.interceptors.request.use(async (config) => {
  const user = auth.currentUser
  if (user) {
    config.headers.Authorization = `Bearer ${await user.getIdToken()}`
  }
  return config
})

// ----------------- Admin: manage doctors -----------------
export const getAdminOverview = async () => {
  const response = await apiClient.get('/admin/overview')
  return response.data
}

export const addDoctor = async (doctor) => {
  const response = await apiClient.post('/admin/doctors', doctor)
  return response.data
}

// The doctor's patients are kept and become unassigned
export const removeDoctor = async (doctorId) => {
  const response = await apiClient.delete(`/admin/doctors/${doctorId}`)
  return response.data
}

export const assignPatient = async (patientId, doctorId) => {
  const response = await apiClient.post(`/admin/patients/${patientId}/assign`, { doctor_id: doctorId })
  return response.data
}

// ----------------- Current user -----------------
export const getMe = async () => {
  const response = await apiClient.get('/me')
  return response.data
}

// ----------------- Doctor: manage patients -----------------
export const getMyPatients = async () => {
  const response = await apiClient.get('/doctor/patients')
  return response.data
}

export const addPatient = async (patient) => {
  const response = await apiClient.post('/doctor/patients', patient)
  return response.data
}

export const deletePatient = async (patientId) => {
  const response = await apiClient.delete(`/patients/${patientId}`)
  return response.data
}

// ----------------- Fetch Patient Details (profile, conditions, reports) -----------------
export const getPatientDetails = async (patientId) => {
  const response = await apiClient.get(`/patients/${patientId}`)
  return response.data
}

// Doctor edits a patient's profile (name, age, gender, medical history)
export const updatePatient = async (patientId, changes) => {
  const response = await apiClient.put(`/patients/${patientId}`, changes)
  return response.data
}

// ----------------- Patient Conditions -----------------
export const addCondition = async (patientId, condition) => {
  const response = await apiClient.post(`/patients/${patientId}/conditions`, condition)
  return response.data
}

export const updateCondition = async (conditionId, condition) => {
  const response = await apiClient.put(`/conditions/${conditionId}`, condition)
  return response.data
}

export const deleteCondition = async (conditionId) => {
  const response = await apiClient.delete(`/conditions/${conditionId}`)
  return response.data
}

// ----------------- Voice dictation of notes -----------------
// Sends the doctor's recording; returns the transcript and the notes sorted by field
export const dictateNotes = async (audioBlob) => {
  const formData = new FormData()
  formData.append('audio', audioBlob, 'dictation.wav')

  const response = await apiClient.post('/dictation', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

// ----------------- Upload Patient Report -----------------
export const uploadPatientReport = async (patientId, file) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('report_type', file.type || 'application/octet-stream')
  formData.append('report_name', file.name)

  const response = await apiClient.post(`/patients/${patientId}/reports`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

export const renameReport = async (reportId, reportName) => {
  const response = await apiClient.put(`/reports/${reportId}`, { report_name: reportName })
  return response.data
}

// Removes the report and its uploaded file
export const deleteReport = async (reportId) => {
  const response = await apiClient.delete(`/reports/${reportId}`)
  return response.data
}

// Report files need the auth token, so fetch the file and open it from memory
export const openReportFile = async (reportId) => {
  const response = await apiClient.get(`/reports/${reportId}/file`, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

// ----------------- Questions passed on to the doctor -----------------
// Doctor replies to a question; an empty answer just marks it resolved
export const answerQuestion = async (questionId, answer) => {
  const response = await apiClient.post(`/questions/${questionId}/answer`, { answer })
  return response.data
}

// Patient decides whether the question the bot proposed is sent to their doctor
export const decideForward = async (messageId, send) => {
  const response = await apiClient.post(`/chat-messages/${messageId}/forward`, { send })
  return response.data
}

// ----------------- Weekly check-ins -----------------
export const submitCheckIn = async (feeling, note) => {
  const response = await apiClient.post('/checkins', { feeling, note })
  return response.data
}

// ----------------- Chat with AI bot -----------------
export const getChatHistory = async (patientId) => {
  const response = await apiClient.get(`/patients/${patientId}/chat-history`)
  return response.data
}

export const chatWithBot = async (message) => {
  try {
    const response = await apiClient.post('/chat', { message });
    return response.data;
  } catch (error) {
    console.error('Chat error:', error);
    throw error;
  }
};
