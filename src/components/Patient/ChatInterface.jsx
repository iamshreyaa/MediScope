import React, { useState, useEffect, useRef, useContext } from 'react'
import { Send, Loader } from 'lucide-react'
import { db } from '../../firebaseConfig'
import { collection, addDoc, query, orderBy, getDocs } from 'firebase/firestore'
import { chatWithBot } from '../../lib/api'
import styles from './Patient.module.css'
import { AuthContext } from '../../contexts/AuthContext'

const ChatInterface = ({ patient }) => {
  const { userData, loading: authLoading } = useContext(AuthContext)
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  // Use patient from prop or AuthContext
  const patientId = patient?.id || userData?.uid

  // Fetch chat history
  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!patientId) return
      try {
        const chatCol = collection(db, 'patients', patientId, 'chats')
        const q = query(chatCol, orderBy('timestamp', 'asc'))
        const querySnapshot = await getDocs(q)
        const msgs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setMessages(msgs)
      } catch (error) {
        console.error('Error fetching chat history:', error)
      }
    }

    fetchChatHistory()
  }, [patientId])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Early returns for loading/auth states
  if (authLoading) {
    return <div className={styles.loading}>Waiting for authentication...</div>
  }

  if (!patientId) {
    return <div className={styles.loading}>Patient data not found</div>
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!inputMessage.trim()) return

    const userMessage = inputMessage
    setInputMessage('')
    setLoading(true)

    try {
      const chatCol = collection(db, 'patients', patientId, 'chats')

      // Add patient message
      await addDoc(chatCol, {
        message_from: 'patient',
        message_content: userMessage,
        timestamp: new Date()
      })

      // Get bot response
      const response = await chatWithBot(patientId, userMessage)

      // Add bot message
      await addDoc(chatCol, {
        message_from: 'bot',
        message_content: response.message || response.reply || 'I understand. Please continue.',
        timestamp: new Date()
      })

      // Fetch updated messages
      const q = query(chatCol, orderBy('timestamp', 'asc'))
      const querySnapshot = await getDocs(q)
      const msgs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setMessages(msgs)
    } catch (error) {
      console.error('Error sending message:', error)
      
      // Get more detailed error message
      let errorMessage = 'Sorry, I encountered an error processing your request. Please try again.'
      
      if (error.response) {
        // Server responded with error status
        errorMessage = `Error: ${error.response.data?.detail || error.response.statusText || 'Server error'}`
      } else if (error.request) {
        // Request was made but no response received
        errorMessage = 'Unable to connect to the server. Please make sure the backend is running.'
      } else {
        // Something else happened
        errorMessage = `Error: ${error.message || 'Unknown error'}`
      }
      
      const chatCol = collection(db, 'patients', patientId, 'chats')
      await addDoc(chatCol, {
        message_from: 'bot',
        message_content: errorMessage,
        timestamp: new Date()
      })

      const q = query(chatCol, orderBy('timestamp', 'asc'))
      const querySnapshot = await getDocs(q)
      const msgs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setMessages(msgs)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.chatContainer}>
      <div className={styles.chatHeader}>
        <h2>Personalized Health Assistant</h2>
        <p>Ask me anything about your health, medications, or care instructions</p>
      </div>

      <div className={styles.messagesArea}>
        {messages.length === 0 ? (
          <div className={styles.emptyChat}>
            <div className={styles.emptyIcon}>💬</div>
            <p>Start a conversation with your health assistant</p>
            <p className={styles.hint}>Ask about your conditions, medications, or lifestyle recommendations</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.message} ${styles[msg.message_from]}`}
            >
              <div className={styles.messageContent}>
                {msg.message_content}
              </div>
              <small className={styles.timestamp}>
                {msg.timestamp?.toDate
                  ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </small>
            </div>
          ))
        )}
        {loading && (
          <div className={`${styles.message} ${styles.bot}`}>
            <div className={styles.messageContent}>
              <Loader size={16} className={styles.spinner} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className={styles.inputArea}>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type your message..."
          disabled={loading}
          maxLength={500}
        />
        <button type="submit" disabled={loading || !inputMessage.trim()}>
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}

export default ChatInterface
