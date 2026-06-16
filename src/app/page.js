'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './page.module.css'

const VIDEO_ID = '_UuXmPtR94c'
const SHOT_CLOCK_FULL = 24
const SHOT_CLOCK_ALT = 14
const ACCURACY_TOLERANCE = 1.5 // seconds
const SCRUB_THRESHOLD = 4      // seconds forward jump triggers seek-back

function parseGameClockStr(str) {
  if (!str || !str.includes(':')) return null
  const [m, s] = str.split(':').map(Number)
  if (isNaN(m) || isNaN(s)) return null
  return m * 60 + s
}

function formatGameClock(totalSecs) {
  if (totalSecs == null || isNaN(totalSecs)) return '--:--'
  totalSecs = Math.max(0, totalSecs)
  const m = Math.floor(totalSecs / 60)
  const s = Math.floor(totalSecs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatShotClock(secs) {
  if (secs == null || isNaN(secs)) return '--'
  secs = Math.max(0, secs)
  if (secs >= 5) return Math.floor(secs).toString()
  return secs.toFixed(1)
}

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim() && !l.trim().startsWith('#'))
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
  return lines.slice(1).flatMap(line => {
    const vals = line.split(',').map(v => v.trim())
    const obj = {}
    headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
    const videoTime = parseFloat(obj.video_time)
    if (isNaN(videoTime)) return []
    return [{
      videoTime,
      eventType: obj.event_type ?? '',
      quarter: parseInt(obj.quarter) || 1,
      gameClock: parseGameClockStr(obj.game_clock ?? ''),
      shotClock: obj.shot_clock !== '' ? parseFloat(obj.shot_clock) : null,
      notes: obj.notes ?? '',
    }]
  })
}

export default function Home() {
  // YouTube
  const playerRef = useRef(null)
  const isPlayingRef = useRef(false)
  const pausedAtRef = useRef(0)
  const lastVideoTimeRef = useRef(0)
  const prevRafTimestampRef = useRef(0)

  // Timings
  const timingsRef = useRef([])
  const processedRef = useRef(new Set())

  // Game clock mutable state (refs avoid stale closures in RAF)
  const gameRef = useRef({
    running: false,
    wasRunning: false,
    baseSecs: 720,
    baseVideoTime: 0,
  })

  // Shot clock mutable state
  const shotRef = useRef({
    running: false,
    wasRunning: false,
    remainingSecs: SHOT_CLOCK_FULL,
    secsAtStart: SHOT_CLOCK_FULL,
    startedAt: null,
  })

  // Ideal shot clock (video-time based, derived from timings)
  const idealShotRef = useRef({
    running: false,
    secsAtStart: SHOT_CLOCK_FULL,
    baseVideoTime: 0,
  })
  const helpModeRef = useRef(false)

  // Accuracy
  const userActionsRef = useRef([])
  const correctActionsRef = useRef([])

  // React display state (triggers re-renders)
  const [videoReady, setVideoReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [quarter, setQuarter] = useState(1)
  const [gameClockDisplay, setGameClockDisplay] = useState('12:00')
  const [gameClockRunning, setGameClockRunning] = useState(false)
  const [shotClockDisplay, setShotClockDisplay] = useState(String(SHOT_CLOCK_FULL))
  const [shotClockRunning, setShotClockRunning] = useState(false)
  const [accuracy, setAccuracy] = useState(null)
  const [accuracyStats, setAccuracyStats] = useState({ correct: 0, total: 0 })
  const [currentNote, setCurrentNote] = useState('')
  const [helpMode, setHelpMode] = useState(false)
  const [idealShotDisplay, setIdealShotDisplay] = useState(String(SHOT_CLOCK_FULL))

  helpModeRef.current = helpMode

  // Load timings CSV
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/timings.csv`)
      .then(r => (r.ok ? r.text() : Promise.reject()))
      .then(text => {
        const events = parseCSV(text)
        timingsRef.current = events
        correctActionsRef.current = events
          .filter(e => ['ShotClockStart', 'ShotClockStop', 'ShotClockReset24', 'ShotClockReset14'].includes(e.eventType))
          .map(e => ({ type: e.eventType, videoTime: e.videoTime }))
      })
      .catch(() => {})
  }, [])

  // YouTube IFrame API init
  useEffect(() => {
    function createPlayer() {
      playerRef.current = new window.YT.Player('yt-player', {
        width: '100%',
        height: '100%',
        videoId: VIDEO_ID,
        playerVars: {
          controls: 1,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          iv_load_policy: 3,
        },
        events: {
          onReady: () => setVideoReady(true),
          onStateChange: handleStateChange,
          onError: () => {},
        },
      })
    }

    if (window.YT?.Player) {
      createPlayer()
    } else {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        prev?.()
        createPlayer()
      }
      if (!document.querySelector('script[src*="iframe_api"]')) {
        const tag = document.createElement('script')
        tag.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(tag)
      }
    }

    return () => { playerRef.current?.destroy?.() }
  }, [])

  // Pause video when tab is hidden to simplify scrub detection
  useEffect(() => {
    function onVisibility() {
      if (document.hidden && isPlayingRef.current) {
        playerRef.current?.pauseVideo?.()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  function handleStateChange({ data }) {
    const States = window.YT?.PlayerState ?? {}
    const player = playerRef.current

    if (data === States.PLAYING) {
      const currentTime = player.getCurrentTime()

      // Reject seek-while-paused: restore position if user seeked
      if (pausedAtRef.current > 0 && Math.abs(currentTime - pausedAtRef.current) > 1.0) {
        player.seekTo(pausedAtRef.current, true)
        lastVideoTimeRef.current = pausedAtRef.current
      }

      isPlayingRef.current = true
      setIsPlaying(true)

      // Resume game clock if it was running before pause
      const g = gameRef.current
      if (g.wasRunning) {
        g.baseVideoTime = lastVideoTimeRef.current
        g.running = true
        g.wasRunning = false
        setGameClockRunning(true)
      }

      // Resume shot clock if it was running before pause
      const s = shotRef.current
      if (s.wasRunning) {
        s.secsAtStart = s.remainingSecs
        s.startedAt = Date.now()
        s.running = true
        s.wasRunning = false
        setShotClockRunning(true)
      }
    } else {
      const currentTime = player?.getCurrentTime?.() ?? 0
      pausedAtRef.current = currentTime
      isPlayingRef.current = false
      setIsPlaying(false)

      // Freeze game clock and remember if it was running
      const g = gameRef.current
      if (g.running) {
        const elapsed = currentTime - g.baseVideoTime
        g.baseSecs = Math.max(0, g.baseSecs - elapsed)
        g.baseVideoTime = currentTime
        g.wasRunning = true
        g.running = false
        setGameClockRunning(false)
      } else {
        g.wasRunning = false
      }

      // Freeze shot clock and remember if it was running
      const s = shotRef.current
      if (s.running) {
        const elapsed = s.startedAt ? (Date.now() - s.startedAt) / 1000 : 0
        s.remainingSecs = Math.max(0, s.secsAtStart - elapsed)
        s.wasRunning = true
        s.running = false
        s.startedAt = null
        setShotClockRunning(false)
      } else {
        s.wasRunning = false
      }
    }
  }

  // Main animation loop — drives both clock displays
  useEffect(() => {
    let rafId

    function tick(timestamp) {
      rafId = requestAnimationFrame(tick)

      // ~30fps cap
      if (timestamp - prevRafTimestampRef.current < 33) return
      prevRafTimestampRef.current = timestamp

      const player = playerRef.current
      if (!player?.getCurrentTime) return

      const videoTime = player.getCurrentTime()
      const prevTime = lastVideoTimeRef.current

      // Scrub detection while playing
      if (isPlayingRef.current) {
        const delta = videoTime - prevTime
        if (delta > SCRUB_THRESHOLD || delta < -0.3) {
          player.seekTo(prevTime, true)
          return
        }
      }
      lastVideoTimeRef.current = videoTime

      // Fire timing events whose video time has been reached
      for (const event of timingsRef.current) {
        const key = `${event.videoTime}|${event.eventType}`
        if (!processedRef.current.has(key) && videoTime >= event.videoTime) {
          processedRef.current.add(key)
          applyTimingEvent(event, videoTime)
        }
      }

      // Update game clock display
      const g = gameRef.current
      if (g.running && isPlayingRef.current) {
        const elapsed = videoTime - g.baseVideoTime
        const remaining = Math.max(0, g.baseSecs - elapsed)
        setGameClockDisplay(formatGameClock(remaining))
        if (remaining === 0) {
          g.running = false
          setGameClockRunning(false)
        }
      }

      // Update ideal shot clock display
      const is = idealShotRef.current
      if (is.running && isPlayingRef.current) {
        const elapsed = videoTime - is.baseVideoTime
        const remaining = Math.max(0, is.secsAtStart - elapsed)
        setIdealShotDisplay(formatShotClock(remaining))
      }

      // Update shot clock display
      const s = shotRef.current
      if (s.running && isPlayingRef.current && s.startedAt) {
        const elapsed = (Date.now() - s.startedAt) / 1000
        const remaining = Math.max(0, s.secsAtStart - elapsed)
        setShotClockDisplay(formatShotClock(remaining))
        if (remaining === 0) {
          s.running = false
          s.startedAt = null
          s.remainingSecs = 0
          setShotClockRunning(false)
        }
      }
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  function applyTimingEvent(event, videoTime) {
    const g = gameRef.current

    switch (event.eventType) {
      case 'QuarterStart':
        g.baseSecs = event.gameClock ?? 720
        g.baseVideoTime = videoTime
        g.running = false
        g.wasRunning = false
        setQuarter(event.quarter)
        setGameClockDisplay(formatGameClock(g.baseSecs))
        setGameClockRunning(false)
        break

      case 'QuarterEnd':
        if (g.running) {
          const elapsed = videoTime - g.baseVideoTime
          g.baseSecs = Math.max(0, g.baseSecs - elapsed)
          g.baseVideoTime = videoTime
          g.running = false
        }
        if (event.gameClock != null) {
          g.baseSecs = event.gameClock
          setGameClockDisplay(formatGameClock(event.gameClock))
        }
        setGameClockRunning(false)
        break

      case 'GameClockStart':
        if (event.gameClock != null) g.baseSecs = event.gameClock
        g.baseVideoTime = event.videoTime
        g.running = true
        setGameClockRunning(true)
        if (event.gameClock != null) setGameClockDisplay(formatGameClock(event.gameClock))
        break

      case 'GameClockStop':
        if (g.running) {
          const elapsed = videoTime - g.baseVideoTime
          g.baseSecs = Math.max(0, g.baseSecs - elapsed)
          g.baseVideoTime = videoTime
          g.running = false
        }
        if (event.gameClock != null) {
          g.baseSecs = event.gameClock
          setGameClockDisplay(formatGameClock(event.gameClock))
        }
        setGameClockRunning(false)
        break

      case 'ShotClockStart': {
        const is = idealShotRef.current
        if (event.shotClock != null) is.secsAtStart = event.shotClock
        is.baseVideoTime = event.videoTime
        is.running = true
        setIdealShotDisplay(formatShotClock(is.secsAtStart))
        break
      }

      case 'ShotClockStop': {
        const is = idealShotRef.current
        if (is.running) {
          const elapsed = videoTime - is.baseVideoTime
          is.secsAtStart = Math.max(0, is.secsAtStart - elapsed)
          is.baseVideoTime = videoTime
          is.running = false
        }
        if (event.shotClock != null) {
          is.secsAtStart = event.shotClock
          setIdealShotDisplay(formatShotClock(event.shotClock))
        }
        break
      }

      case 'ShotClockReset24': {
        const is = idealShotRef.current
        is.secsAtStart = SHOT_CLOCK_FULL
        is.baseVideoTime = event.videoTime
        is.running = true
        setIdealShotDisplay(formatShotClock(SHOT_CLOCK_FULL))
        break
      }

      case 'ShotClockReset14': {
        const is = idealShotRef.current
        is.secsAtStart = SHOT_CLOCK_ALT
        is.baseVideoTime = event.videoTime
        is.running = true
        setIdealShotDisplay(formatShotClock(SHOT_CLOCK_ALT))
        break
      }

      default:
        break
    }

    if (event.notes) setCurrentNote(event.notes)
  }

  function getVideoTime() {
    return playerRef.current?.getCurrentTime?.() ?? 0
  }

  function recalcAccuracy(actions) {
    const correct = correctActionsRef.current
    if (correct.length === 0) return

    const usedCorrect = new Set()
    let matched = 0

    for (const ua of actions) {
      let bestIdx = -1
      let bestDist = Infinity
      correct.forEach((ca, i) => {
        if (usedCorrect.has(i) || ca.type !== ua.type) return
        const dist = Math.abs(ca.videoTime - ua.videoTime)
        if (dist <= ACCURACY_TOLERANCE && dist < bestDist) {
          bestDist = dist
          bestIdx = i
        }
      })
      if (bestIdx >= 0) {
        usedCorrect.add(bestIdx)
        matched++
      }
    }

    const total = correct.length
    setAccuracy(total > 0 ? Math.round((matched / total) * 100) : null)
    setAccuracyStats({ correct: matched, total })
  }

  function recordAction(type) {
    const actions = [...userActionsRef.current, { type, videoTime: getVideoTime() }]
    userActionsRef.current = actions
    recalcAccuracy(actions)
  }

  function toggleHelpMode() {
    setHelpMode(prev => !prev)
  }

  // Store handlers in refs so the keyboard handler always calls the latest version
  const doToggleRef = useRef(null)
  const doResetRef = useRef(null)

  doToggleRef.current = function doToggle() {
    if (!isPlayingRef.current) return
    const s = shotRef.current

    if (s.running) {
      const elapsed = s.startedAt ? (Date.now() - s.startedAt) / 1000 : 0
      s.remainingSecs = Math.max(0, s.secsAtStart - elapsed)
      s.running = false
      s.startedAt = null
      setShotClockRunning(false)
      setShotClockDisplay(formatShotClock(s.remainingSecs))
      recordAction('ShotClockStop')
    } else {
      s.secsAtStart = s.remainingSecs
      s.startedAt = Date.now()
      s.running = true
      setShotClockRunning(true)
      recordAction('ShotClockStart')
    }
  }

  doResetRef.current = function doReset(secs) {
    const s = shotRef.current
    s.remainingSecs = secs
    s.secsAtStart = secs
    if (s.running) s.startedAt = Date.now()
    setShotClockDisplay(formatShotClock(secs))
    recordAction(secs === SHOT_CLOCK_FULL ? 'ShotClockReset24' : 'ShotClockReset14')
  }

  // Keyboard controls
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.code === 'Space') {
        e.preventDefault()
        doToggleRef.current()
      } else if (e.key.toLowerCase() === 'r') {
        doResetRef.current(SHOT_CLOCK_FULL)
      } else if (e.key.toLowerCase() === 't') {
        doResetRef.current(SHOT_CLOCK_ALT)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const shotVal = parseFloat(shotClockDisplay)
  const shotExpired = !isNaN(shotVal) && shotVal === 0
  const shotUrgent = !isNaN(shotVal) && shotVal > 0 && shotVal <= 5

  return (
    <div className={styles.page}>
      <div className={styles.videoSection}>
        <div id="yt-player" className={styles.ytPlayer} />
        {!videoReady && (
          <div className={styles.videoOverlay}>
            <span>Loading video…</span>
          </div>
        )}
      </div>

      <div className={styles.panels}>
        <div className={styles.panelRow}>
        {/* Game Clock */}
        <div className={styles.panel}>
          <div className={styles.panelLabel}>Game Clock</div>
          <div className={styles.quarterBadge}>Q{quarter}</div>
          <div className={`${styles.gameClockTime} ${gameClockRunning && isPlaying ? styles.clockActive : ''}`}>
            {gameClockDisplay}
          </div>
          <div className={`${styles.statusPill} ${gameClockRunning && isPlaying ? styles.pillRunning : ''}`}>
            {!isPlaying ? 'PAUSED' : gameClockRunning ? 'RUNNING' : 'STOPPED'}
          </div>
        </div>

        {/* Shot Clock */}
        <div className={`${styles.panel} ${styles.panelCenter}`}>
          <div className={styles.panelLabel}>Shot Clock</div>
          {helpMode ? (
            <div className={styles.dualClockRow}>
              <div className={styles.dualClockCol}>
                <div className={styles.dualClockLabel}>Yours</div>
                <div className={`${styles.dualClockTime} ${shotClockRunning && isPlaying ? styles.clockActive : ''} ${shotUrgent ? styles.clockUrgent : ''} ${shotExpired ? styles.clockExpired : ''}`}>
                  {shotClockDisplay}
                </div>
              </div>
              <div className={styles.dualClockDivider} />
              <div className={styles.dualClockCol}>
                <div className={styles.dualClockLabel}>Ideal</div>
                <div className={`${styles.dualClockTime} ${styles.idealClock}`}>
                  {idealShotDisplay}
                </div>
              </div>
            </div>
          ) : (
            <div className={`${styles.shotClockTime} ${shotClockRunning && isPlaying ? styles.clockActive : ''} ${shotUrgent ? styles.clockUrgent : ''} ${shotExpired ? styles.clockExpired : ''}`}>
              {shotClockDisplay}
            </div>
          )}
          <div className={`${styles.statusPill} ${shotClockRunning && isPlaying ? styles.pillRunning : ''} ${shotExpired ? styles.pillExpired : ''}`}>
            {shotExpired ? 'VIOLATION' : !isPlaying ? 'PAUSED' : shotClockRunning ? 'RUNNING' : 'STOPPED'}
          </div>
          {accuracy !== null && (
            <div className={styles.accuracy}>
              <span className={styles.accuracyPct}>{accuracy}%</span>
              <span className={styles.accuracyMeta}>accuracy · {accuracyStats.correct}/{accuracyStats.total}</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className={styles.panel}>
          <div className={styles.panelLabel}>Controls</div>
          <div className={styles.controlButtons}>
            <button
              className={`${styles.btn} ${shotClockRunning ? styles.btnStop : styles.btnStart}`}
              onClick={() => doToggleRef.current()}
              disabled={!isPlaying}
            >
              <span>{shotClockRunning ? 'Stop' : 'Start'} Shot Clock</span>
              <kbd className={styles.kbd}>Space</kbd>
            </button>
            <button
              className={`${styles.btn} ${styles.btnReset24}`}
              onClick={() => doResetRef.current(SHOT_CLOCK_FULL)}
            >
              <span>Full Reset (24s)</span>
              <kbd className={styles.kbd}>R</kbd>
            </button>
            <button
              className={`${styles.btn} ${styles.btnReset14}`}
              onClick={() => doResetRef.current(SHOT_CLOCK_ALT)}
            >
              <span>Alt Reset (14s)</span>
              <kbd className={styles.kbd}>T</kbd>
            </button>
            <button
              className={`${styles.btn} ${helpMode ? styles.btnHelpOn : styles.btnHelpOff}`}
              onClick={toggleHelpMode}
            >
              <span>Help Mode</span>
              <span className={styles.kbd}>{helpMode ? 'ON' : 'OFF'}</span>
            </button>
          </div>
          <div className={styles.videoStatus}>
            {!videoReady
              ? '⏳ Loading…'
              : isPlaying
              ? '▶ Playing'
              : '⏸ Paused'}
          </div>
        </div>
        </div>
        <div className={styles.eventNoteBar}>
          {currentNote}
        </div>
      </div>
    </div>
  )
}
