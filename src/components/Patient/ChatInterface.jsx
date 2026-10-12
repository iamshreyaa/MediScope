import React, { useState, useEffect, useRef, useContext } from 'react'
import { Send, Loader, AlertTriangle, Forward } from 'lucide-react'
import { chatWithBot, getChatHistory, submitCheckIn, decideForward } from '../../lib/api'
import styles from './Patient.module.css'
import { AuthContext } from '../../contexts/AuthContext'

const CHECK_IN_INTERVAL_DAYS = 7

const FEELINGS = [
  { value: 'better', label: 'Better' },
  { value: 'same', label: 'About the same' },
  { value: 'worse', label: 'Worse' },
]

const ChatInterface = ({ patient }) => {
  const { userData, loading: authLoading } = useContext(AuthContext)
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const [feeling, setFeeling] = useState('')
  const [checkInNote, setCheckInNote] = useState('')
  const [checkInSent, setCheckInSent] = useState(false)

  // Ask for a check-in when the patient hasn't sent one in the last week
  const lastCheckIn = patient?.checkins?.[0]
  const daysSinceCheckIn = lastCheckIn
    ? (Date.now() - new Date(lastCheckIn.created_at).getTime()) / (1000 * 60 * 60 * 24)
    : Infinity
  const checkInDue = !checkInSent && daysSinceCheckIn >= CHECK_IN_INTERVAL_DAYS

  // Yes / No on "send this question to your doctor?"
  const handleForwardDecision = async (messageId, send) => {
    try {
      const updated = await decideForward(messageId, send)
      setMessages(prev => prev.map(msg => (msg.id === messageId ? updated : msg)))
    } catch (error) {
      console.error('Error saving your choice:', error)
      setMessages(await getChatHistory(patientId))
    }
  }

  const handleCheckIn = async () => {
    if (!feeling) return
    try {
      await submitCheckIn(feeling, checkInNote)
      setCheckInSent(true)
    } catch (error) {
      console.error('Error sending check-in:', error)
      alert('Could not send your check-in. Please try again.')
    }
  }

  // Use patient from prop or AuthContext
  const patientId = patient?.id || userData?.uid

  // Fetch chat history
  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!patientId) return
      try {
        setMessages(await getChatHistory(patientId))
      } catch (error) {
        console.error('Error fetching chat history:', error)
      }
    }

    fetchChatHistory()
  }, [patientId])

  // Scroll to bottom when messages change
  useEffect(() => {
    const list = messagesEndRef.current?.parentElement
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
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

    // Show the patient's message right away; the backend saves both messages to Postgres
    const pendingMessage = {
      id: `pending-${Date.now()}`,
      message_from: 'patient',
      message_content: userMessage,
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, pendingMessage])

    try {
      // Get bot response
      await chatWithBot(userMessage)

      // Fetch updated messages
      setMessages(await getChatHistory(patientId))
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
      
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        message_from: 'bot',
        message_content: errorMessage,
        timestamp: new Date().toISOString()
      }])
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

      {checkInDue && (
        <div className={styles.checkInCard}>
          <p className={styles.checkInTitle}>Weekly check-in: how are you feeling compared to last week?</p>
          <div className={styles.checkInOptions}>
            {FEELINGS.map(option => (
              <button
                key={option.value}
                type="button"
                className={`${styles.checkInOption} ${feeling === option.value ? styles.selected : ''}`}
                onClick={() => setFeeling(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {feeling && (
            <div className={styles.checkInNote}>
              <input
                type="text"
                value={checkInNote}
                onChange={(e) => setCheckInNote(e.target.value)}
                placeholder="Anything you want your doctor to know? (optional)"
                maxLength={300}
              />
              <button type="button" onClick={handleCheckIn}>Send to doctor</button>
            </div>
          )}
        </div>
      )}
      {checkInSent && (
        <div className={styles.checkInCard}>
          <p className={styles.checkInTitle}>Thanks, your check-in has been sent to your doctor.</p>
        </div>
      )}

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
              {msg.sources?.length > 0 && (
                <span className={styles.messageFlag}>
                  Looked up online:{' '}
                  {msg.sources.map((source, index) => (
                    <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">
                      {source.title}{index < msg.sources.length - 1 ? ',' : ''}
                    </a>
                  ))}
                </span>
              )}
              {msg.flag === 'urgent' && (
                <span className={`${styles.messageFlag} ${styles.urgentFlag}`}>
                  <AlertTriangle size={14} /> Contact your doctor or emergency services now. Your doctor has been alerted.
                </span>
              )}
              {msg.flag === 'ask_forward' && (
                <div className={styles.forwardPrompt}>
                  <p>Do you want me to send this question to your doctor?</p>
                  <p className={styles.forwardQuestion}>"{msg.proposed_question}"</p>
                  <div className={styles.forwardActions}>
                    <button type="button" className={styles.forwardYes} onClick={() => handleForwardDecision(msg.id, true)}>
                      Yes, send it
                    </button>
                    <button type="button" className={styles.forwardNo} onClick={() => handleForwardDecision(msg.id, false)}>
                      No, don't send
                    </button>
                  </div>
                </div>
              )}
              {msg.flag === 'forwarded' && (
                <span className={styles.messageFlag}>
                  <Forward size={14} /> Sent to your doctor{msg.proposed_question ? `: "${msg.proposed_question}"` : ''}
                </span>
              )}
              {msg.flag === 'already_sent' && (
                <span className={styles.messageFlag}>
                  <Forward size={14} /> This question is already with your doctor, waiting for their reply
                </span>
              )}
              {msg.flag === 'declined' && (
                <span className={styles.messageFlag}>Not sent to your doctor</span>
              )}
              <small className={styles.timestamp}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
