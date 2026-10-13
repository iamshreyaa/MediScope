import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Leaf,
  ArrowRight,
  Mic,
  MessageCircle,
  Forward,
  ShieldCheck,
  AlertTriangle,
  Pill,
  HandHeart,
  Clock,
  CalendarCheck,
  FileText,
  ClipboardList,
  BellRing,
  LineChart,
  Check,
} from 'lucide-react'
import styles from './Landing.module.css'

// The conversation played in the hero. Each step adds one thing to the chat.
const CHAT_SCRIPT = [
  { from: 'patient', text: 'How do I use the moisturizer my doctor gave me?' },
  { from: 'bot', text: 'Your doctor asked you to apply Excela moisturizer for the dryness on your face. As general information, moisturizers work best on clean, slightly damp skin.' },
  { from: 'patient', text: 'How many times a day should I apply it?' },
  { from: 'bot', text: "Your doctor hasn't specified how often. Would you like me to ask them?", ask: 'How many times a day should the patient apply Excela moisturizer?' },
  { from: 'sent', text: 'Sent to your doctor' },
]

const STEPS = [
  { icon: Mic, title: 'Your doctor writes the plan', text: 'After your visit, your doctor types or simply dictates your diagnosis, medicines, lifestyle changes and follow-up.' },
  { icon: MessageCircle, title: 'You ask anything, any time', text: 'The assistant answers from your own doctor’s notes and explains them in plain language.' },
  { icon: Forward, title: 'Your doctor stays in the loop', text: 'When the notes don’t cover a question, it offers to send it to your doctor and brings back their reply.' },
]

const FOR_PATIENTS = [
  { icon: Clock, text: 'Answers about your care plan at any hour' },
  { icon: CalendarCheck, text: 'A weekly check-in so your doctor knows how you are doing' },
  { icon: FileText, text: 'Your conditions, instructions and reports in one place' },
]

const FOR_DOCTORS = [
  { icon: Mic, text: 'Dictate notes by voice and have them sorted into fields' },
  { icon: ClipboardList, text: 'See every open question and reply once, for patient and assistant' },
  { icon: LineChart, text: 'Check-in history before each follow-up visit' },
]

const SAFETY = [
  { icon: Pill, title: 'Never changes your treatment', text: 'It will not start, stop or adjust a medicine. Those decisions go to your doctor.' },
  { icon: HandHeart, title: 'Asks before it shares', text: 'Nothing is sent to your doctor until you say yes.' },
  { icon: BellRing, title: 'Flags emergencies', text: 'Mention a warning symptom and it tells you to get help now, and alerts your doctor.' },
]

// Fades a section in the first time it scrolls into view
const Reveal = ({ children, className = '', as: Tag = 'div' }) => {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { threshold: 0.15 })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag ref={ref} className={`${styles.reveal} ${visible ? styles.visible : ''} ${className}`}>
      {children}
    </Tag>
  )
}

// Plays the scripted conversation on a loop
const ChatPreview = () => {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const [shown, setShown] = useState(reducedMotion ? CHAT_SCRIPT.length : 0)
  const [accepted, setAccepted] = useState(reducedMotion)

  useEffect(() => {
    if (reducedMotion) return

    let delay = 1700
    if (shown === 0) delay = 700
    if (shown === 4 && !accepted) delay = 2200 // pause on the yes / no question
    if (shown === CHAT_SCRIPT.length) delay = 4200 // hold the finished chat, then restart

    const timer = setTimeout(() => {
      if (shown === 4 && !accepted) {
        setAccepted(true)
      } else if (shown === CHAT_SCRIPT.length) {
        setShown(0)
        setAccepted(false)
      } else {
        setShown(shown + 1)
      }
    }, delay)
    return () => clearTimeout(timer)
  }, [shown, accepted, reducedMotion])

  const next = CHAT_SCRIPT[shown]
  const botTyping = !reducedMotion && next?.from === 'bot'

  return (
    <div className={styles.chatCard} aria-hidden="true">
      <div className={styles.chatCardHeader}>
        <span className={styles.chatAvatar}><Leaf size={16} /></span>
        <div>
          <p className={styles.chatCardTitle}>Health Assistant</p>
          <p className={styles.chatCardSub}>Answers from Dr. Kapoor’s notes</p>
        </div>
      </div>

      <div className={styles.chatCardBody}>
        {CHAT_SCRIPT.slice(0, shown).map((message, index) => {
          if (message.from === 'sent') {
            return (
              <span key={index} className={styles.previewTag}>
                <Forward size={13} /> {message.text}
              </span>
            )
          }
          return (
            <React.Fragment key={index}>
              <div className={`${styles.previewBubble} ${styles[message.from]}`}>{message.text}</div>
              {message.ask && (
                <div className={styles.previewAsk}>
                  <p>Send this question to your doctor?</p>
                  <div className={styles.previewAskActions}>
                    <span className={`${styles.previewYes} ${accepted ? styles.pressed : ''}`}>
                      {accepted && <Check size={13} />} Yes, send it
                    </span>
                    <span className={styles.previewNo}>No</span>
                  </div>
                </div>
              )}
            </React.Fragment>
          )
        })}
        {botTyping && (
          <div className={`${styles.previewBubble} ${styles.bot} ${styles.typing}`}>
            <span /><span /><span />
          </div>
        )}
      </div>
    </div>
  )
}

const LandingPage = () => {
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <Link to="/" className={styles.brand}>
          <span className={styles.brandMark}><Leaf size={18} /></span>
          Patient Medical Assistant
        </Link>
        <nav className={styles.navLinks}>
          <a href="#how">How it works</a>
          <a href="#who">Who it’s for</a>
          <a href="#safety">Safety</a>
        </nav>
        <Link to="/login" className={styles.navCta}>Sign in</Link>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>Between visits, without the guesswork</p>
            <h1>Your doctor’s guidance, always within reach.</h1>
            <p className={styles.lead}>
              A personal health assistant that answers from your own doctor’s instructions,
              and knows when a question should go back to your doctor.
            </p>
            <div className={styles.heroActions}>
              <Link to="/login" className={styles.primaryBtn}>
                Sign in <ArrowRight size={16} />
              </Link>
              <a href="#how" className={styles.ghostBtn}>See how it works</a>
            </div>
          </div>
          <ChatPreview />
        </div>
      </section>

      <section id="how" className={styles.section}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>How it works</p>
          <h2>From the consultation room to your pocket</h2>
        </Reveal>
        <div className={styles.cardGrid}>
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <Reveal key={title} className={styles.card}>
              <span className={styles.stepNumber}>0{index + 1}</span>
              <span className={styles.iconCircle}><Icon size={22} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="who" className={`${styles.section} ${styles.tinted}`}>
        <Reveal className={styles.sectionHead}>
          <p className={styles.eyebrow}>Who it’s for</p>
          <h2>One plan, two sides of the conversation</h2>
        </Reveal>
        <div className={styles.split}>
          <Reveal className={styles.audienceCard}>
            <h3>For patients</h3>
            <p className={styles.audienceLead}>Stop wondering what your doctor said after you leave the clinic.</p>
            <ul>
              {FOR_PATIENTS.map(({ icon: Icon, text }) => (
                <li key={text}><span className={styles.listIcon}><Icon size={16} /></span>{text}</li>
              ))}
            </ul>
            <p className={styles.audienceNote}>Your doctor creates your account and gives you the sign-in details.</p>
            <Link to="/login" className={styles.textLink}>Sign in as a patient <ArrowRight size={15} /></Link>
          </Reveal>
          <Reveal className={styles.audienceCard}>
            <h3>For doctors</h3>
            <p className={styles.audienceLead}>Spend less time repeating instructions and more on the questions that need you.</p>
            <ul>
              {FOR_DOCTORS.map(({ icon: Icon, text }) => (
                <li key={text}><span className={styles.listIcon}><Icon size={16} /></span>{text}</li>
              ))}
            </ul>
            <p className={styles.audienceNote}>Your clinic’s administrator creates your account.</p>
            <Link to="/login" className={styles.textLink}>Sign in as a doctor <ArrowRight size={15} /></Link>
          </Reveal>
        </div>
      </section>

      <section id="safety" className={styles.safety}>
        <Reveal className={styles.sectionHead}>
          <span className={styles.safetyBadge}><ShieldCheck size={16} /> Built to be careful</span>
          <h2>It knows when not to answer</h2>
          <p className={styles.safetyLead}>
            A general chatbot will discuss anything. This one stays inside your doctor’s plan
            and hands the rest back to a person.
          </p>
        </Reveal>
        <div className={styles.cardGrid}>
          {SAFETY.map(({ icon: Icon, title, text }) => (
            <Reveal key={title} className={styles.safetyCard}>
              <span className={styles.iconCircle}><Icon size={22} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </Reveal>
          ))}
        </div>
        <Reveal className={styles.urgentExample}>
          <AlertTriangle size={18} />
          <p>
            <strong>“My lips are swelling and it’s hard to breathe.”</strong> The assistant tells the patient to contact
            their doctor or emergency services now, and the doctor sees an urgent flag on their dashboard.
          </p>
        </Reveal>
      </section>

      <section className={styles.section}>
        <Reveal className={styles.cta}>
          <h2>Start with your next appointment</h2>
          <p>Your clinic adds its doctors, and each doctor adds their patients. Sign in with the details you were given.</p>
          <div className={styles.heroActions}>
            <Link to="/login" className={styles.primaryBtn}>Sign in <ArrowRight size={16} /></Link>
          </div>
        </Reveal>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div>
            <p className={styles.footerBrand}><Leaf size={16} /> Patient Medical Assistant</p>
            <p className={styles.footerNote}>Built with React, FastAPI, PostgreSQL and Gemini.</p>
          </div>
          <p className={styles.disclaimer}>
            This is a demonstration project. It does not provide medical advice and is not a substitute
            for your doctor. In an emergency, contact your local emergency services.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
