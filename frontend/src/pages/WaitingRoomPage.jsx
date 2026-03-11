import React, { useEffect, useRef, useState } from 'react'
import { gql } from '@apollo/client'
import { useQuery, useSubscription } from '@apollo/client/react'
import BadmintonCourt from '../components/BadmintonCourt'
import CourtPreview from '../components/CourtPreview'

const ONGOING_MATCHES_QUERY = gql`
  query OngoingMatches {
    ongoingMatches {
      _id
      sessionId
      courtId
      playerIds
      queued
      startedAt
      createdAt
      updatedAt
    }
  }
`

const ONGOING_MATCH_UPDATES_SUBSCRIPTION = gql`
  subscription OngoingMatchUpdates {
    ongoingMatchUpdates {
      type
      match {
        _id
        sessionId
        courtId
        playerIds
        queued
        startedAt
        createdAt
        updatedAt
      }
    }
  }
`

const COURTS_QUERY = gql`
  query Courts {
    courts {
      _id
      name
      surfaceType
      indoor
      description
      status
      createdAt
      updatedAt
    }
  }
`

const PLAYERS_QUERY = gql`
  query Players {
    players {
      _id
      name
      gender
      playerLevel
      playCount
      winCount
      lossCount
      winRate
      createdAt
      updatedAt
    }
  }
`

const PLAYER_UPDATES_SUBSCRIPTION = gql`
  subscription PlayerUpdates {
    playerUpdates {
      type
      player {
        _id
        name
        gender
        playerLevel
        playCount
        winCount
        lossCount
        winRate
        createdAt
        updatedAt
      }
    }
  }
`

const WaitingRoomPage = () => {
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  const [countdown, setCountdown] = useState(10)
  const [courtAnimationKey, setCourtAnimationKey] = useState(0)
  const [rotationResetToken, setRotationResetToken] = useState(0)
  const [ongoingMatches, setOngoingMatches] = useState({})
  const [matchQueue, setMatchQueue] = useState({})
  const [playersState, setPlayersState] = useState([])
  const [activePage, setActivePage] = useState(0)
  const [queuePage, setQueuePage] = useState(0)
  const ITEMS_PER_PAGE = 5
  const prevMatchesLengthRef = useRef(null)
  const prevQueueLengthRef = useRef(null)

  // Subscribe to real-time match updates (ongoing matches)
  const { data: matchUpdateData, loading: subLoading, error: subError } = useSubscription(ONGOING_MATCH_UPDATES_SUBSCRIPTION)

  // Subscribe to real-time player updates
  const { data: playerUpdateData, loading: playerSubLoading, error: playerSubError } = useSubscription(PLAYER_UPDATES_SUBSCRIPTION)

  // Fetch initial data - subscriptions handle real-time updates
  const { data: ongoingMatchesData, error: matchesError, refetch: refetchMatches } = useQuery(ONGOING_MATCHES_QUERY, {
    pollInterval: (subLoading || subError || playerSubLoading || playerSubError) ? 5000 : 0  // Only poll if subscriptions are not connected
  })
  const { data: courtsData } = useQuery(COURTS_QUERY)
  const { data: playersData } = useQuery(PLAYERS_QUERY)

  const courts = courtsData?.courts || []
  const players = playersState.length > 0 ? playersState : (playersData?.players || [])

  // Initialize players state from query data
  useEffect(() => {
    if (playersData?.players && playersState.length === 0) {
      setPlayersState(playersData.players)
    }
  }, [playersData, playersState.length])

  // Update players state when query data changes (from polling or manual refetch)
  useEffect(() => {
    if (playersData?.players && playersData.players.length > 0) {
      setPlayersState(playersData.players)
    }
  }, [playersData?.players])

  // Load initial ongoing matches and organize by session
  useEffect(() => {
    if (ongoingMatchesData?.ongoingMatches) {
      const ongoingBySession = {}
      const queuedBySession = {}
      
      ongoingMatchesData.ongoingMatches.forEach(match => {
        const matchWithId = { _id: match._id, ...match }
        
        if (match.queued) {
          if (!queuedBySession[match.sessionId]) {
            queuedBySession[match.sessionId] = []
          }
          queuedBySession[match.sessionId].push(matchWithId)
        } else {
          if (!ongoingBySession[match.sessionId]) {
            ongoingBySession[match.sessionId] = []
          }
          ongoingBySession[match.sessionId].push(matchWithId)
        }
      })
      
      setOngoingMatches(ongoingBySession)
      setMatchQueue(queuedBySession)
    }
  }, [ongoingMatchesData])

  // Handle real-time subscription updates
  useEffect(() => {
    if (matchUpdateData?.ongoingMatchUpdates) {
      const { type, match } = matchUpdateData.ongoingMatchUpdates
      const matchWithId = { _id: match._id, ...match }

      if (type === 'STARTED') {
        if (match.queued) {
          // Add to queue
          setMatchQueue(prev => {
            const current = prev[match.sessionId] || []
            const exists = current.some(m => m._id === match._id)
            return {
              ...prev,
              [match.sessionId]: exists
                ? current.map(m => (m._id === match._id ? matchWithId : m))
                : [...current, matchWithId]
            }
          })
        } else {
          // Add to ongoing matches
          setOngoingMatches(prev => {
            const current = prev[match.sessionId] || []
            const exists = current.some(m => m._id === match._id)
            return {
              ...prev,
              [match.sessionId]: exists
                ? current.map(m => (m._id === match._id ? matchWithId : m))
                : [...current, matchWithId]
            }
          })
        }
      } else if (type === 'UPDATED') {
        // Handle state transition: queued -> active or active -> active
        if (match.queued) {
          // Still queued, update in queue
          setMatchQueue(prev => ({
            ...prev,
            [match.sessionId]: (prev[match.sessionId] || []).map(m => 
              m._id === match._id ? matchWithId : m
            )
          }))
        } else {
          // Match is now active - could be a transition from queued or just an update
          // Remove from queue if it exists there
          setMatchQueue(prev => ({
            ...prev,
            [match.sessionId]: (prev[match.sessionId] || []).filter(m => m._id !== match._id)
          }))
          // Add or update in ongoing matches
          setOngoingMatches(prev => {
            const sessionMatches = prev[match.sessionId] || []
            const existingIndex = sessionMatches.findIndex(m => m._id === match._id)
            if (existingIndex >= 0) {
              // Update existing
              return {
                ...prev,
                [match.sessionId]: sessionMatches.map(m => 
                  m._id === match._id ? matchWithId : m
                )
              }
            } else {
              // Add new (transitioned from queue)
              return {
                ...prev,
                [match.sessionId]: [...sessionMatches, matchWithId]
              }
            }
          })
        }
      } else if (type === 'ENDED') {
        // Remove from both states
        setOngoingMatches(prev => ({
          ...prev,
          [match.sessionId]: (prev[match.sessionId] || []).filter(m => m._id !== match._id)
        }))
        setMatchQueue(prev => ({
          ...prev,
          [match.sessionId]: (prev[match.sessionId] || []).filter(m => m._id !== match._id)
        }))
      }
    }
  }, [matchUpdateData])

  // Handle real-time player subscription updates
  useEffect(() => {
    if (playerUpdateData?.playerUpdates) {
      const { type, player } = playerUpdateData.playerUpdates
      if (type === 'CREATED') {
        // Add new player
        setPlayersState(prev => [...prev, player])
      } else if (type === 'UPDATED') {
        // Update existing player
        setPlayersState(prev =>
          prev.map(p => p._id === player._id ? player : p)
        )
      } else if (type === 'DELETED') {
        // Remove deleted player
        setPlayersState(prev => prev.filter(p => p._id !== player._id))
      }
    }
  }, [playerUpdateData])

  // Fallback: refetch if subscription isn't working or query failed
  useEffect(() => {
    if (subError) {
      console.error('Subscription error:', subError)
    }
    if (matchesError) {
      console.error('Query error:', matchesError)
      refetchMatches()
    }
  }, [subError, matchesError, refetchMatches])

  // Flatten all ongoing matches from all sessions
  const allMatches = Object.values(ongoingMatches)
    .flat()
    .filter(match => !match.queued)

  // Get queued matches from matchQueue
  const queuedMatches = Object.values(matchQueue || {})
    .flat()

  // When a match ends, index can briefly point past the shortened array.
  const currentMatch = allMatches[currentMatchIndex] || allMatches[0] || null

  const switchToMatchIndex = (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= allMatches.length || nextIndex === currentMatchIndex) {
      return
    }

    setCurrentMatchIndex(nextIndex)
    setCountdown(10)
    setCourtAnimationKey((prev) => prev + 1)
    setRotationResetToken((prev) => prev + 1)
  }

  const handlePreviewClick = (matchId) => {
    const selectedIndex = allMatches.findIndex(match => match._id === matchId)

    switchToMatchIndex(selectedIndex)
  }

  // Auto-rotate through matches every 10 seconds
  useEffect(() => {
    if (allMatches.length === 0) {
      return
    }

    const timer = setInterval(() => {
      setCurrentMatchIndex((prev) => {
        const nextIndex = (prev + 1) % allMatches.length
        setCourtAnimationKey((key) => key + 1)
        return nextIndex
      })
      setCountdown(10)
    }, 10000) // Switch every 10 seconds

    return () => clearInterval(timer)
  }, [allMatches.length, rotationResetToken])

  // Countdown timer displayed
  useEffect(() => {
    if (allMatches.length === 0) {
      return
    }

    setCountdown(10)

    const countdownTimer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => clearInterval(countdownTimer)
  }, [allMatches.length, rotationResetToken])

  // Reset index if current is out of bounds
  useEffect(() => {
    if (currentMatchIndex >= allMatches.length && allMatches.length > 0) {
      setCurrentMatchIndex(0)
    }
  }, [allMatches.length])

  // Reset pagination when data changes
  // Clamp activePage when allMatches length changes to prevent out-of-bounds index
  useEffect(() => {
    if (prevMatchesLengthRef.current !== null && allMatches.length !== prevMatchesLengthRef.current) {
      if (activePage * ITEMS_PER_PAGE >= allMatches.length && allMatches.length > 0) {
        setActivePage(Math.floor((allMatches.length - 1) / ITEMS_PER_PAGE))
      }
    }
    prevMatchesLengthRef.current = allMatches.length
  }, [allMatches.length, activePage])

  // Clamp queuePage when queuedMatches length changes to prevent out-of-bounds index
  useEffect(() => {
    if (prevQueueLengthRef.current !== null && queuedMatches.length !== prevQueueLengthRef.current) {
      if (queuePage * ITEMS_PER_PAGE >= queuedMatches.length && queuedMatches.length > 0) {
        setQueuePage(Math.floor((queuedMatches.length - 1) / ITEMS_PER_PAGE))
      }
    }
    prevQueueLengthRef.current = queuedMatches.length
  }, [queuedMatches.length, queuePage])

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 overflow-x-hidden flex flex-col">
      <style>{`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes fadeOutScale {
          from {
            opacity: 1;
            transform: scale(1);
          }
          to {
            opacity: 0;
            transform: scale(0.95);
          }
        }
        .transition-court {
          animation: fadeInScale 0.45s ease-in-out;
        }
      `}</style>
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 right-0 h-80 w-80 rounded-full bg-linear-to-br from-amber-300/40 to-rose-400/30 blur-2xl" />
        <div className="absolute -bottom-40 left-0 h-96 w-96 rounded-full bg-linear-to-br from-sky-300/30 to-emerald-400/20 blur-2xl" />
      </div>

      {/* Header */}
      <div className="text-center py-2 shrink-0">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-400"></span>
          LIVE MATCHES
        </div>
        <h1 className="text-xl font-bold text-white mt-0.5 py-2 sm:text-2xl">Badminton Queue</h1>
      </div>

      {/* Main Content - Responsive Layout */}
      <div className="flex flex-col lg:flex-row px-6 pb-3 gap-4">
        {/* Left Side - Badminton Court */}
        <div className="w-full flex-1 flex flex-col gap-6">
          {allMatches.length > 0 ? (
            <>
              {/* Main Display - Current Match */}
              <div key={`${currentMatch?._id || 'none'}-${courtAnimationKey}`} className="flex-1 flex flex-col items-center justify-center bg-transparent min-h-80 sm:min-h-96 transition-court">
                <div className="text-sm text-slate-400 mb-2 text-center font-semibold">
                  Now Playing - {courts?.find(c => c._id === currentMatch?.courtId)?.name || 'Court'}
                </div>
                <div className="w-full">
                  <BadmintonCourt
                    match={currentMatch}
                    players={players}
                    courts={courts}
                    fullscreen={true}
                  />
                </div>
              </div>

              {/* Ongoing Matches Preview */}
              {allMatches.length > 1 && (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="text-xs text-slate-400 mb-3 text-center uppercase tracking-wider">Currently Used</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
                    {Array.from({ length: Math.min(4, allMatches.length - 1) }).map((_, idx) => {
                      const match = allMatches[(currentMatchIndex + idx + 1) % allMatches.length]
                      const playerIds = match.playerIds || []
                      const midpoint = Math.floor(playerIds.length / 2)
                      const team1 = playerIds.slice(0, midpoint).map(pid => players?.find(p => p._id === pid)?.name || 'Unknown')
                      const team2 = playerIds.slice(midpoint).map(pid => players?.find(p => p._id === pid)?.name || 'Unknown')
                      const courtName = courts?.find(c => c._id === match.courtId)?.name || 'Court'
                      
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handlePreviewClick(match._id)}
                          className="relative rounded-lg border border-white/10 overflow-hidden cursor-pointer transition-colors hover:border-white/20 h-24"
                        >
                          <div className="absolute inset-0 blur-[1.5px] scale-105">
                            <CourtPreview match={match} />
                          </div>
                          <div className="absolute inset-0 bg-linear-to-br from-emerald-600/30 via-slate-900/50 to-slate-950/70"></div>
                          <div className="relative z-10 inset-0 p-2 flex flex-col justify-center h-full bg-black/10">
                            <div className="text-xs font-bold text-green-300 mb-1 text-center truncate">{courtName}</div>
                            <div className="space-y-0.5 text-[10px] sm:text-xs flex flex-col">
                              <div className="text-slate-200 font-bold flex items-center justify-center min-w-0 gap-1">
                                {team1.length > 0 ? (
                                  team1.map((name, playerIdx) => (
                                    <div key={`${match._id}-prev-t1-${playerIdx}`} className="flex items-center min-w-0">
                                      {playerIdx > 0 && <span className="mx-0.5 shrink-0 text-slate-400">/</span>}
                                      <span className="inline-block max-w-16 sm:max-w-20 truncate" title={name}>{name}</span>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-slate-500">N/A</span>
                                )}
                              </div>
                              <div className="text-center text-slate-300 text-[10px] sm:text-xs font-semibold">vs</div>
                              <div className="text-slate-200 font-bold flex items-center justify-center min-w-0 gap-1">
                                {team2.length > 0 ? (
                                  team2.map((name, playerIdx) => (
                                    <div key={`${match._id}-prev-t2-${playerIdx}`} className="flex items-center min-w-0">
                                      {playerIdx > 0 && <span className="mx-0.5 shrink-0 text-slate-400">/</span>}
                                      <span className="inline-block max-w-16 sm:max-w-20 truncate" title={name}>{name}</span>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-slate-500">N/A</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center rounded-lg border border-white/10 bg-slate-900/50 p-8 text-center backdrop-blur">
              <div className="text-4xl mb-2">😴</div>
              <h2 className="text-lg font-semibold text-white mb-1">
                No Matches in Progress
              </h2>
              <p className="text-sm text-slate-400">
                Matches will appear here when players start playing
              </p>
            </div>
          )}
        </div>

        {/* Middle - Stats Cards (Vertical) - Hidden on mobile */}
        <div className="hidden lg:flex lg:w-40 flex-col justify-center gap-3">
          {/* Match Counter */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
            <div className="text-xs font-semibold uppercase text-slate-400 tracking-[0.2em]">
              Active
            </div>
            <div className="text-2xl font-bold text-emerald-300 mt-1">
              {allMatches.length}
            </div>
          </div>

          {/* Current Match Index */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
            <div className="text-xs font-semibold uppercase text-slate-400 tracking-[0.2em]">
              Viewing
            </div>
            <div className="text-2xl font-bold text-blue-300 mt-1">
              {allMatches.length > 0 ? `${currentMatchIndex + 1}/${allMatches.length}` : '0/0'}
            </div>
          </div>

          {/* Auto-rotation Countdown */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
            <div className="text-xs font-semibold uppercase text-slate-400 tracking-[0.2em]">
              Switch In
            </div>
            <div className="text-2xl font-bold text-rose-300 mt-1">
              {countdown}s
            </div>
          </div>
        </div>

        {/* Right Side - Active & Queued Matches Tables */}
        <div className="flex-1 flex flex-col gap-4 min-h-0 lg:min-h-auto min-w-0">
          {/* Active Matches Table */}
          <div className="flex flex-col flex-1 min-h-0 min-w-0">
            <div className="flex justify-between items-center mb-3 min-w-0">
              <h3 className="text-lg font-semibold text-white truncate">Active ({allMatches.length})</h3>
              {allMatches.length > ITEMS_PER_PAGE && (
                <div className="text-xs text-slate-400">
                  Page {activePage + 1} of {Math.ceil(allMatches.length / ITEMS_PER_PAGE)}
                </div>
              )}
            </div>
            {allMatches.length > 0 ? (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="bg-slate-900/50 rounded-lg border border-white/10 flex-1 overflow-hidden">
                  <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '2.5rem' }} />
                      <col style={{ width: '6.5rem' }} />
                      <col />
                      <col />
                      <col style={{ width: '4.5rem' }} />
                    </colgroup>
                    <thead className="sticky top-0 bg-slate-800/90 backdrop-blur">
                      <tr className="border-b border-white/10">
                        <th className="text-left px-3 py-3 font-semibold text-slate-300 w-8">#</th>
                        <th className="text-left px-3 py-3 font-semibold text-slate-300 w-24">Court</th>
                        <th className="text-left px-3 py-3 font-semibold text-slate-300">Team 1</th>
                        <th className="text-left px-3 py-3 font-semibold text-slate-300">Team 2</th>
                        <th className="text-left px-3 py-3 font-semibold text-slate-300 w-18 whitespace-nowrap">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allMatches.slice(activePage * ITEMS_PER_PAGE, (activePage + 1) * ITEMS_PER_PAGE).map((match, idx) => {
                        const court = courts.find(c => c._id === match.courtId)
                        const playerIds = match.playerIds || []
                        const midpoint = Math.floor(playerIds.length / 2)
                        const team1Players = playerIds.slice(0, midpoint).map(pid => players.find(p => p._id === pid)?.name).filter(Boolean)
                        const team2Players = playerIds.slice(midpoint).map(pid => players.find(p => p._id === pid)?.name).filter(Boolean)
                        
                        return (
                          <tr key={match._id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="px-3 py-3 text-slate-300 w-8">{activePage * ITEMS_PER_PAGE + idx + 1}</td>
                            <td className="px-3 py-3 w-24 truncate">
                              <button
                                type="button"
                                onClick={() => handlePreviewClick(match._id)}
                                className="text-slate-100 hover:text-emerald-300 hover:underline transition-colors cursor-pointer w-full text-left truncate"
                                title={court?.name || 'Click to view'}
                              >
                                {court?.name || 'N/A'}
                              </button>
                            </td>
                            <td className="px-3 py-3 text-blue-300 overflow-hidden">
                              {team1Players.length > 0 ? (
                                <div className="flex items-center min-w-0 gap-1">
                                  {team1Players.map((name, playerIdx) => (
                                    <div key={`${match._id}-t1-${playerIdx}`} className="flex items-center min-w-0">
                                      {playerIdx > 0 && <span className="mx-1 shrink-0 text-slate-400">/</span>}
                                      <span className="inline-block max-w-23.75 sm:max-w-30 truncate" title={name}>{name}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-500">N/A</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-rose-300 overflow-hidden">
                              {team2Players.length > 0 ? (
                                <div className="flex items-center min-w-0 gap-1">
                                  {team2Players.map((name, playerIdx) => (
                                    <div key={`${match._id}-t2-${playerIdx}`} className="flex items-center min-w-0">
                                      {playerIdx > 0 && <span className="mx-1 shrink-0 text-slate-400">/</span>}
                                      <span className="inline-block max-w-23.75 sm:max-w-30 truncate" title={name}>{name}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-500">N/A</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-slate-300 w-18 whitespace-nowrap">{team1Players.length}v{team2Players.length}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {allMatches.length > ITEMS_PER_PAGE && (
                  <div className="flex justify-between items-center mt-3 px-2">
                    <button
                      onClick={() => setActivePage(p => Math.max(0, p - 1))}
                      disabled={activePage === 0}
                      className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-200 rounded transition-colors"
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={() => setActivePage(p => Math.min(Math.ceil(allMatches.length / ITEMS_PER_PAGE) - 1, p + 1))}
                      disabled={activePage >= Math.ceil(allMatches.length / ITEMS_PER_PAGE) - 1}
                      className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-200 rounded transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-white/10 bg-slate-900/50 p-8 text-center text-sm text-slate-400">
                No active matches
              </div>
            )}
          </div>

          {/* Queued Matches Table */}
          <div className="flex flex-col flex-1 min-h-0 min-w-0">
            <div className="flex justify-between items-center mb-3 min-w-0">
              <h3 className="text-lg font-semibold text-white truncate">Queue ({queuedMatches.length})</h3>
              {queuedMatches.length > ITEMS_PER_PAGE && (
                <div className="text-xs text-slate-400">
                  Page {queuePage + 1} of {Math.ceil(queuedMatches.length / ITEMS_PER_PAGE)}
                </div>
              )}
            </div>
            {queuedMatches.length > 0 ? (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="bg-slate-900/50 rounded-lg border border-white/10 flex-1 overflow-hidden">
                  <table className="w-full text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '2.5rem' }} />
                      <col style={{ width: '6.5rem' }} />
                      <col />
                      <col />
                      <col style={{ width: '4.5rem' }} />
                    </colgroup>
                    <thead className="sticky top-0 bg-slate-800/90 backdrop-blur">
                      <tr className="border-b border-white/10">
                        <th className="text-left px-3 py-3 font-semibold text-slate-300 w-8">#</th>
                        <th className="text-left px-3 py-3 font-semibold text-slate-300 w-24 truncate">Court</th>
                        <th className="text-left px-3 py-3 font-semibold text-slate-300">Team 1</th>
                        <th className="text-left px-3 py-3 font-semibold text-slate-300">Team 2</th>
                        <th className="text-left px-3 py-3 font-semibold text-slate-300 w-18 whitespace-nowrap">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queuedMatches.slice(queuePage * ITEMS_PER_PAGE, (queuePage + 1) * ITEMS_PER_PAGE).map((match, idx) => {
                        const court = courts.find(c => c._id === match.courtId)
                        const playerIds = match.playerIds || []
                        const midpoint = Math.floor(playerIds.length / 2)
                        const team1Players = playerIds.slice(0, midpoint).map(pid => players.find(p => p._id === pid)?.name).filter(Boolean)
                        const team2Players = playerIds.slice(midpoint).map(pid => players.find(p => p._id === pid)?.name).filter(Boolean)
                        
                        return (
                          <tr key={match._id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="px-3 py-3 text-slate-300 w-8">{queuePage * ITEMS_PER_PAGE + idx + 1}</td>
                            <td className="px-3 py-3 text-slate-100 w-24 truncate">{court?.name || 'N/A'}</td>
                            <td className="px-3 py-3 text-blue-300 overflow-hidden">
                              {team1Players.length > 0 ? (
                                <div className="flex items-center min-w-0 gap-1">
                                  {team1Players.map((name, playerIdx) => (
                                    <div key={`${match._id}-qt1-${playerIdx}`} className="flex items-center min-w-0">
                                      {playerIdx > 0 && <span className="mx-1 shrink-0 text-slate-400">/</span>}
                                      <span className="inline-block max-w-23.75 sm:max-w-30 truncate" title={name}>{name}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-500">N/A</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-rose-300 overflow-hidden">
                              {team2Players.length > 0 ? (
                                <div className="flex items-center min-w-0 gap-1">
                                  {team2Players.map((name, playerIdx) => (
                                    <div key={`${match._id}-qt2-${playerIdx}`} className="flex items-center min-w-0">
                                      {playerIdx > 0 && <span className="mx-1 shrink-0 text-slate-400">/</span>}
                                      <span className="inline-block max-w-23.75 sm:max-w-30 truncate" title={name}>{name}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-500">N/A</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-slate-300 w-18 whitespace-nowrap">{team1Players.length}v{team2Players.length}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {queuedMatches.length > ITEMS_PER_PAGE && (
                  <div className="flex justify-between items-center mt-3 px-2">
                    <button
                      onClick={() => setQueuePage(p => Math.max(0, p - 1))}
                      disabled={queuePage === 0}
                      className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-200 rounded transition-colors"
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={() => setQueuePage(p => Math.min(Math.ceil(queuedMatches.length / ITEMS_PER_PAGE) - 1, p + 1))}
                      disabled={queuePage >= Math.ceil(queuedMatches.length / ITEMS_PER_PAGE) - 1}
                      className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-200 rounded transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-white/10 bg-slate-900/50 p-8 text-center text-sm text-slate-400">
                No queued matches
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default WaitingRoomPage
