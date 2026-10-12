import React, { useState, useRef, useEffect } from 'react'
import { Mic, Square, Loader } from 'lucide-react'
import { dictateNotes } from '../../lib/api'
import styles from './Doctor.module.css'

const MAX_SECONDS = 180

// Browsers record in different formats, so convert every recording to a small mono WAV
const toWav = async (blob) => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  const context = new AudioCtx()
  const decoded = await context.decodeAudioData(await blob.arrayBuffer())
  context.close()

  const sampleRate = 16000
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * sampleRate), sampleRate)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const samples = (await offline.startRendering()).getChannelData(0)

  const view = new DataView(new ArrayBuffer(44 + samples.length * 2))
  const writeText = (offset, text) => [...text].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)))
  writeText(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeText(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeText(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  samples.forEach((sample, i) => {
    const clamped = Math.max(-1, Math.min(1, sample))
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
  })
  return new Blob([view], { type: 'audio/wav' })
}

// Lets the doctor speak their notes; onResult receives the notes sorted by field
const VoiceNotes = ({ onResult }) => {
  const [status, setStatus] = useState('idle') // idle | recording | processing
  const [seconds, setSeconds] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const recorderRef = useRef(null)
  const timerRef = useRef(null)

  const stopRecording = () => {
    clearInterval(timerRef.current)
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  // Stop the microphone if the form is closed mid-recording
  useEffect(() => () => {
    clearInterval(timerRef.current)
    if (recorderRef.current) {
      recorderRef.current.onstop = null
      if (recorderRef.current.state === 'recording') recorderRef.current.stop()
      recorderRef.current.stream.getTracks().forEach(track => track.stop())
    }
  }, [])

  const startRecording = async () => {
    setError('')
    setTranscript('')

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      setError('Could not use the microphone. Please allow microphone access and try again.')
      return
    }

    const chunks = []
    const recorder = new MediaRecorder(stream)
    recorderRef.current = recorder
    recorder.ondataavailable = (e) => chunks.push(e.data)
    recorder.onstop = async () => {
      stream.getTracks().forEach(track => track.stop())
      setStatus('processing')
      try {
        const wav = await toWav(new Blob(chunks, { type: recorder.mimeType }))
        const { transcript: heard, ...fields } = await dictateNotes(wav)
        setTranscript(heard)
        onResult(fields)
      } catch (err) {
        setError(err.response?.data?.detail || 'Could not process the recording. Please try again or type the notes.')
      } finally {
        setStatus('idle')
      }
    }

    recorder.start()
    setSeconds(0)
    setStatus('recording')
    timerRef.current = setInterval(() => {
      setSeconds(prev => {
        if (prev + 1 >= MAX_SECONDS) stopRecording()
        return prev + 1
      })
    }, 1000)
  }

  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <div className={`${styles.voiceBox} ${status === 'recording' ? styles.recording : ''}`}>
      <div className={styles.voiceRow}>
        {status === 'idle' && (
          <button type="button" className={styles.voiceBtn} onClick={startRecording}>
            <Mic size={18} /> {transcript ? 'Dictate more' : 'Dictate notes'}
          </button>
        )}
        {status === 'recording' && (
          <button type="button" className={`${styles.voiceBtn} ${styles.voiceStop}`} onClick={stopRecording}>
            <Square size={16} /> Stop ({clock})
          </button>
        )}
        {status === 'processing' && (
          <button type="button" className={styles.voiceBtn} disabled>
            <Loader size={18} className={styles.spinner} /> Sorting your notes...
          </button>
        )}
        <p className={styles.voiceHint}>
          {status === 'recording'
            ? 'Listening. Say the issue, medicines and how to take them, lifestyle changes, follow-up and warning symptoms.'
            : 'Speak the notes and they are sorted into the fields below. Check them before saving.'}
        </p>
      </div>

      {error && <p className={styles.voiceError}>{error}</p>}
      {transcript && (
        <p className={styles.voiceTranscript}><strong>Heard:</strong> {transcript}</p>
      )}
    </div>
  )
}

export default VoiceNotes
