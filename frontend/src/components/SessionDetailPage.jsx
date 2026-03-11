import React, { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@apollo/client/react'
import { gql } from '@apollo/client'
import StatusBadge from './StatusBadge'
import MatchForm from './MatchForm'

const PLAYER_LEVELS = {
  'BEGINNER': 'Beginner',
  'INTERMEDIATE': 'Intermediate',
  'UPPERINTERMEDIATE': 'Upper Intermediate',
  'ADVANCED': 'Advanced',
}

const formatPlayerLevel = (value) => PLAYER_LEVELS[value] ?? value

const COURTS_QUERY = gql`
  query Courts {
    courts {
      _id
      name
      surfaceType
      indoor
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
    }
  }
`

const SESSION_QUERY = gql`
  query Session($id: ID!) {
    session(id: $id) {
      _id
      name
      status
      courts
      players {
        playerId
        gamesPlayed
      }
      startedAt
      endedAt
      createdAt
      updatedAt
    }
  }
`

const UPDATE_SESSION_MUTATION = gql`
  mutation UpdateSession($id: ID!, $input: UpdateSessionInput!) {
    updateSession(id: $id, input: $input) {
      ok
      message
      session {
        _id
        name
        status
        courts
        players {
          playerId
          gamesPlayed
        }
        startedAt
        endedAt
        createdAt
        updatedAt
      }
    }
  }
`

const END_SESSION_MUTATION = gql`
  mutation EndSession($id: ID!) {
    endSession(id: $id) {
      ok
      message
      session {
        _id
        name
        status
        courts
        players {
          playerId
          gamesPlayed
        }
        startedAt
        endedAt
        createdAt
        updatedAt
      }
    }
  }
`

const GAMES_QUERY = gql`
  query GamesBySession($sessionId: ID!) {
    gamesBySession(sessionId: $sessionId) {
      _id
      sessionId
      courtId
      players
      winnerPlayerIds
      finishedAt
      createdAt
      updatedAt
    }
  }
`

const RECORD_GAME_MUTATION = gql`
  mutation RecordGame($input: RecordGameInput!) {
    recordGame(input: $input) {
      ok
      message
      game {
        _id
        sessionId
        courtId
        players
        winnerPlayerIds
        finishedAt
        createdAt
        updatedAt
      }
    }
  }
`

const START_MATCH_MUTATION = gql`
  mutation StartMatch($input: StartMatchInput!) {
    startMatch(input: $input) {
      ok
      message
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

const END_MATCH_MUTATION = gql`
  mutation EndMatch($id: ID!) {
    endMatch(id: $id) {
      ok
      message
    }
  }
`

const START_QUEUED_MATCH_MUTATION = gql`
  mutation StartQueuedMatch($id: ID!) {
    startQueuedMatch(id: $id) {
      ok
      message
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

const formatDateTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  return `${dateStr} at ${timeStr}`
}

const SessionDetailPage = ({ sessionId, onClose, ongoingMatches: propOngoingMatches, setOngoingMatches: setPropOngoingMatches, matchQueue: propMatchQueue, setMatchQueue: setPropMatchQueue }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [editTab, setEditTab] = useState('name')
  const [playerSearchTerm, setPlayerSearchTerm] = useState('')
  const [playerSortBy, setPlayerSortBy] = useState('')
  const [isMatchFormOpen, setIsMatchFormOpen] = useState(false)
  const [selectedMatchForWinners, setSelectedMatchForWinners] = useState(null)
  const [selectedWinners, setSelectedWinners] = useState([])
  const [congratsMatch, setCongratsMatch] = useState(null)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [showUpdateSuccess, setShowUpdateSuccess] = useState(false)
  
  // Use props passed from parent, with fallback to empty array
  const ongoingMatches = propOngoingMatches || []
  const matchQueue = propMatchQueue || []
  const setMatchQueue = setPropMatchQueue || (() => {})
  const [formData, setFormData] = useState({
    name: '',
    courts: [],
    players: [],
  })

  const { data: sessionData, loading: sessionLoading, error: sessionError } = useQuery(SESSION_QUERY, {
    variables: { id: sessionId }
  })
  const { data: gamesData } = useQuery(GAMES_QUERY, {
    variables: { sessionId }
  })
  const { data: courtsData, loading: courtsLoading } = useQuery(COURTS_QUERY)
  const { data: playersData, loading: playersLoading } = useQuery(PLAYERS_QUERY)
  const [updateSession, { loading: updateLoading }] = useMutation(UPDATE_SESSION_MUTATION)
  const [endSession, { loading: endSessionLoading }] = useMutation(END_SESSION_MUTATION)
  const [recordGame, { loading: recordGameLoading }] = useMutation(RECORD_GAME_MUTATION, {
    refetchQueries: [
      { query: SESSION_QUERY, variables: { id: sessionId } },
      { query: GAMES_QUERY, variables: { sessionId } }
    ]
  })
  const [startMatch] = useMutation(START_MATCH_MUTATION)
  const [endMatch] = useMutation(END_MATCH_MUTATION)
  const [startQueuedMatch] = useMutation(START_QUEUED_MATCH_MUTATION)

  const session = sessionData?.session

  useEffect(() => {
    if (session) {
      setFormData({
        name: session.name,
        courts: session.courts || [],
        players: session.players?.map(p => p.playerId) || [],
      })
      setIsEditing(false)
      setActiveTab('overview')
      setEditTab('name')
    }
  }, [session])

  const courts = courtsData?.courts || []
  const players = playersData?.players || []



  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim() || formData.courts.length === 0 || formData.players.length === 0) {
      alert('Please fill all fields')
      return
    }
    try {
      const result = await updateSession({
        variables: {
          id: sessionId,
          input: {
            name: formData.name,
            courtIds: formData.courts,
            playerIds: formData.players,
          }
        }
      })
      
      if (result.data.updateSession.ok) {
        setIsEditing(false)
        setEditTab('name')
        setPlayerSearchTerm('')
        setPlayerSortBy('')
        setShowUpdateSuccess(true)
      } else {
        alert(result.data.updateSession.message)
      }
    } catch (err) {
      alert(err.message)
    }
  }

  const handleCourtToggle = (courtId) => {
    setFormData(prev => ({
      ...prev,
      courts: prev.courts.includes(courtId)
        ? prev.courts.filter(id => id !== courtId)
        : [...prev.courts, courtId]
    }))
  }

  const handlePlayerToggle = (playerId) => {
    setFormData(prev => ({
      ...prev,
      players: prev.players.includes(playerId)
        ? prev.players.filter(id => id !== playerId)
        : [...prev.players, playerId]
    }))
  }

  const handleRecordGame = async (matchData) => {
    try {
      // Check against ALL ongoing matches (from all sessions)
      const courtBusy = ongoingMatches.some((m) => m.courtId === matchData.courtId)
      const playersInUse = ongoingMatches.some((m) =>
        matchData.playerIds.some((p) => m.playerIds?.includes(p))
      )

      // Call backend mutation to save match
      const result = await startMatch({
        variables: {
          input: {
            sessionId,
            courtId: matchData.courtId,
            playerIds: matchData.playerIds,
            queued: courtBusy || playersInUse
          }
        }
      })

      if (result.data?.startMatch?.ok) {
        const newMatch = result.data.startMatch.match
        
        if (courtBusy || playersInUse) {
          // Add to queue (with backend ID)
          setMatchQueue([...matchQueue, newMatch])
        } else {
          // Add to ongoing matches (with backend ID)
          if (setPropOngoingMatches) {
            setPropOngoingMatches([...ongoingMatches, newMatch])
          }
        }
      } else {
        alert(result.data?.startMatch?.message || 'Failed to create match')
      }
    } catch (err) {
      console.error('Error creating match:', err)
      alert('Error: ' + err.message)
    }
    setIsMatchFormOpen(false)
  }

  // Auto-start queued matches when slots become available
  useEffect(() => {
    if (matchQueue.length > 0) {
      const firstQueued = matchQueue[0]
      // Check against ALL ongoing matches (from all sessions)
      const courtBusy = ongoingMatches.some((m) => m.courtId === firstQueued.courtId)
      const playersInUse = ongoingMatches.some((m) =>
        firstQueued.playerIds.some((p) => m.playerIds?.includes(p))
      )

      if (!courtBusy && !playersInUse) {
        // Call backend mutation to update queued flag
        startQueuedMatch({
          variables: { id: firstQueued._id }
        }).then((result) => {
          if (result.data?.startQueuedMatch?.ok) {
            const updatedMatch = result.data.startQueuedMatch.match
            // Add to ongoing matches
            if (setPropOngoingMatches) {
              setPropOngoingMatches([...ongoingMatches, updatedMatch])
            }
            // Remove from queue
            setMatchQueue(matchQueue.slice(1))
          }
        }).catch(err => {
          console.error('Error starting queued match:', err)
        })
      }
    }
  }, [ongoingMatches])

  const handleConfirmEndSession = async () => {
    try {
      const result = await endSession({
        variables: { id: sessionId }
      })
      
      if (result.data.endSession.ok) {
        setShowEndConfirm(false)
        onClose?.()
      } else {
        alert(result.data.endSession.message)
      }
    } catch (err) {
      console.error('Error ending session:', err)
      alert('Error: ' + err.message)
    }
  }

  const handleWinnerToggle = (playerId) => {
    setSelectedWinners(prev => 
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    )
  }

  const handleConfirmWinners = async () => {
    if (selectedWinners.length === 0) {
      alert('Please select at least one winner')
      return
    }

    const loserIds = selectedMatchForWinners.playerIds.filter(id => !selectedWinners.includes(id))
    
    if (loserIds.length === 0) {
      alert('Cannot have all players as winners')
      return
    }

    // Build the correct input for the mutation, excluding temporary fields
    const gameInput = {
      sessionId: selectedMatchForWinners.sessionId,
      courtId: selectedMatchForWinners.courtId,
      playerIds: selectedMatchForWinners.playerIds,
      winnerPlayerIds: selectedWinners,
      finishedAt: new Date().toISOString()
    }

    try {
      // Record the game
      const result = await recordGame({
        variables: {
          input: gameInput
        }
      })
      
      if (result.data.recordGame.ok) {
        // End the match in backend
        await endMatch({
          variables: { id: selectedMatchForWinners._id }
        })

        // Remove from ongoing and show congratulations
        const updated = ongoingMatches.filter(m => m._id !== selectedMatchForWinners._id)
        if (setPropOngoingMatches) {
          setPropOngoingMatches(updated)
        }
        setCongratsMatch({
          winners: selectedWinners.map(id => players.find(p => p._id === id)?.name || 'Unknown'),
          losers: loserIds.map(id => players.find(p => p._id === id)?.name || 'Unknown')
        })
        setSelectedMatchForWinners(null)
        setSelectedWinners([])
      } else {
        alert(result.data.recordGame.message)
      }
    } catch (err) {
      console.error('Error recording game:', err)
      alert('Error: ' + err.message)
    }
  }

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p>Loading session...</p>
      </div>
    )
  }

  if (sessionError || !session) {
    return (
      <div className="text-center">
        <p className="text-rose-300 mb-4">Error loading session</p>
        <button
          onClick={onClose}
          className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/80 transition hover:border-white/40 hover:text-white"
        >
          Close
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 overflow-visible">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-white sm:text-2xl">Session Details</h1>
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Edit Tab Navigation */}
          <div className="flex gap-2 border-b border-white/10 -mx-6 px-6">
            <button
              type="button"
              onClick={() => setEditTab('name')}
              className={`px-4 py-3 text-sm font-semibold transition ${
                editTab === 'name'
                  ? 'border-b-2 border-blue-400 text-blue-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Session Name
            </button>
            <button
              type="button"
              onClick={() => setEditTab('courts')}
              className={`px-4 py-3 text-sm font-semibold transition ${
                editTab === 'courts'
                  ? 'border-b-2 border-blue-400 text-blue-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Select Courts
            </button>
            <button
              type="button"
              onClick={() => setEditTab('players')}
              className={`px-4 py-3 text-sm font-semibold transition ${
                editTab === 'players'
                  ? 'border-b-2 border-blue-400 text-blue-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Select Players
            </button>
          </div>

          {/* Edit Tab Content */}
          <div>
            {editTab === 'name' && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-white">Session Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter session name"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
                />
              </div>
            )}

            {editTab === 'courts' && (
              <div>
                <label className="mb-3 block text-sm font-semibold text-white">
                  Select Courts {courtsLoading && <span className="text-xs text-slate-400">(loading...)</span>}
                </label>
                <div className="space-y-2">
                  {courts.length === 0 ? (
                    <p className="text-sm text-slate-400">No courts available</p>
                  ) : (
                    [...courts]
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .filter(court => !formData.courts.includes(court._id))
                      .map(court => (
                        <label key={court._id} className="flex items-center gap-3 rounded-lg border border-white/10 p-3 hover:bg-white/5">
                          <input
                            type="checkbox"
                            checked={formData.courts.includes(court._id)}
                            onChange={() => handleCourtToggle(court._id)}
                            className="h-4 w-4 rounded border-white/20 bg-white/10"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-white">{court.name}</div>
                            <div className="text-xs text-slate-400">{court.indoor ? 'Indoor' : 'Outdoor'} • {court.surfaceType}</div>
                          </div>
                        </label>
                      ))
                  )}
                </div>
              </div>
            )}

            {editTab === 'players' && (
              <div className="space-y-3">
                <div>
                  <label className="mb-3 block text-sm font-semibold text-white">
                    Select Players {playersLoading && <span className="text-xs text-slate-400">(loading...)</span>}
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <input
                      type="text"
                      placeholder="Search by player name..."
                      value={playerSearchTerm}
                      onChange={(e) => setPlayerSearchTerm(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
                    />
                    <select
                      value={playerSortBy}
                      onChange={(e) => setPlayerSortBy(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-white/30 focus:outline-none"
                    >
                      <option value="" className='text-black'>All Skill Levels</option>
                      <option value="ADVANCED" className='text-black'>Advanced</option>
                      <option value="UPPERINTERMEDIATE" className='text-black'>Upper Intermediate</option>
                      <option value="INTERMEDIATE" className='text-black'>Intermediate</option>
                      <option value="BEGINNER" className='text-black'>Beginner</option>
                    </select>
                  </div>
                </div>
                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {players.length === 0 ? (
                    <p className="text-sm text-slate-400">No players available</p>
                  ) : (
                    players
                      .filter(player => !formData.players.includes(player._id))
                      .filter(player => player.name.toLowerCase().includes(playerSearchTerm.toLowerCase()))
                      .filter(player => playerSortBy === '' || player.playerLevel === playerSortBy)
                      .sort((a, b) => {
                        // Sort by skill level (ADVANCED first, then UPPERINTERMEDIATE, INTERMEDIATE, BEGINNER)
                        const skillOrder = { 'ADVANCED': 0, 'UPPERINTERMEDIATE': 1, 'INTERMEDIATE': 2, 'BEGINNER': 3 }
                        const aOrder = skillOrder[a.playerLevel] ?? 999
                        const bOrder = skillOrder[b.playerLevel] ?? 999
                        return aOrder - bOrder
                      })
                      .map(player => (
                        <label key={player._id} className="flex items-center gap-3 rounded-lg border border-white/10 p-3 hover:bg-white/5">
                          <input
                            type="checkbox"
                            checked={formData.players.includes(player._id)}
                            onChange={() => handlePlayerToggle(player._id)}
                            className="h-4 w-4 rounded border-white/20 bg-white/10"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-white">{player.name}</div>
                            <div className="text-xs text-slate-400">{formatPlayerLevel(player.playerLevel)}</div>
                          </div>
                        </label>
                      ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false)
                setEditTab('name')
                setPlayerSearchTerm('')
                setPlayerSortBy('')
              }}
              className="flex-1 rounded-lg border border-white/20 px-4 py-2 font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateLoading}
              className="flex-1 rounded-lg bg-emerald-500/20 px-4 py-2 font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
            >
              {updateLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-6">
          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-white/10 -mx-6 px-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-3 text-sm font-semibold transition ${
                activeTab === 'overview'
                  ? 'border-b-2 border-emerald-400 text-emerald-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('courts')}
              className={`px-4 py-3 text-sm font-semibold transition ${
                activeTab === 'courts'
                  ? 'border-b-2 border-emerald-400 text-emerald-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Courts ({session.courts?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('players')}
              className={`px-4 py-3 text-sm font-semibold transition ${
                activeTab === 'players'
                  ? 'border-b-2 border-emerald-400 text-emerald-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Players ({session.players?.length || 0})
            </button>
          </div>

          {/* Tab Content */}
          <div className="overflow-visible">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Name</label>
                    <p className="mt-1 text-lg font-semibold text-white">{session.name}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Status</label>
                      <div className="mt-1">
                        <StatusBadge status={session.status} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Started</label>
                      <p className="mt-1 text-sm font-bold text-white">{formatDateTime(session.startedAt)}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Ended</label>
                      <p className="mt-1 text-sm font-bold text-white">{formatDateTime(session.endedAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Courts Tab */}
            {activeTab === 'courts' && (
              <div>
                {(() => {
                  const sessionCourts = courts.filter(court => session.courts?.includes(court._id))
                  return sessionCourts.length === 0 ? (
                    <p className="text-sm text-slate-400">No courts assigned to this session</p>
                  ) : (
                    <div className="space-y-2">
                      {sessionCourts.sort((a, b) => a.name.localeCompare(b.name)).map(court => (
                        <div key={court._id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                          <div className="font-medium text-white">{court.name}</div>
                          <div className="text-xs text-slate-400">{court.indoor ? 'Indoor' : 'Outdoor'} • {court.surfaceType}</div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Players Tab */}
            {activeTab === 'players' && (
              <div className="overflow-visible">
                {session.players?.length === 0 ? (
                  <p className="text-sm text-slate-400">No players</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 overflow-visible">
                    {session.players?.map((sessionPlayer) => {
                      const player = players.find(p => p._id === sessionPlayer.playerId)
                      
                      // Calculate wins and losses from games data
                      let wins = 0
                      let losses = 0
                      const playerGames = []
                      
                      gamesData?.gamesBySession?.forEach(game => {
                        if (game.players.includes(sessionPlayer.playerId)) {
                          const isWinner = game.winnerPlayerIds.includes(sessionPlayer.playerId)
                          if (isWinner) {
                            wins++
                          } else {
                            losses++
                          }
                          
                          const teammates = game.players
                            .filter(pid => pid !== sessionPlayer.playerId && game.winnerPlayerIds.includes(pid) === isWinner)
                            .map(pid => players.find(p => p._id === pid)?.name || 'Unknown')
                          const opponents = game.players
                            .filter(pid => game.winnerPlayerIds.includes(pid) !== isWinner)
                            .map(pid => players.find(p => p._id === pid)?.name || 'Unknown')
                          
                          playerGames.push({
                            isWinner,
                            teammates,
                            opponents
                          })
                        }
                      })
                      
                      return (
                        <div key={sessionPlayer.playerId} className="rounded-lg border border-white/10 bg-white/5 p-3 overflow-visible">
                          <div>
                            <div className="font-medium text-white mb-1">{player?.name || 'Unknown'}</div>
                            <div className="text-xs text-slate-400 mb-2">{player?.gender || 'N/A'} • {formatPlayerLevel(player?.playerLevel) || 'N/A'}</div>
                            <div className="flex gap-3 justify-between">
                              <div className="text-center relative group">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 cursor-help">Played</div>
                                <div className="text-sm font-semibold text-white">{sessionPlayer.gamesPlayed}</div>
                                
                                {/* Tooltip */}
                                {playerGames.length > 0 && (
                                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-9999 pointer-events-none">
                                    <div className={`bg-slate-900 border border-white/20 rounded-lg shadow-xl p-3 ${playerGames.length === 1 ? 'w-48' : 'w-64'}`}>
                                      <div className="text-xs font-semibold text-white mb-2 text-left">Games Played:</div>
                                      <div className={`grid ${playerGames.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-2 max-h-64 overflow-y-auto`}>
                                        {playerGames.map((game, idx) => (
                                          <div key={idx} className={`text-left p-2 rounded ${game.isWinner ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-rose-500/10 border border-rose-500/30'}`}>
                                            <div className={`text-[10px] font-bold uppercase mb-1 ${game.isWinner ? 'text-emerald-400' : 'text-rose-400'}`}>
                                              Game #{idx + 1} - {game.isWinner ? 'WON' : 'LOST'}
                                            </div>
                                            {game.teammates.length > 0 && (
                                              <div className="text-[10px] text-slate-300 mb-0.5">
                                                <span className="text-slate-400">With:</span> {game.teammates.join(', ')}
                                              </div>
                                            )}
                                            <div className="text-[10px] text-slate-300">
                                              <span className="text-slate-400">vs:</span> {game.opponents.join(', ')}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="text-center">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Won</div>
                                <div className="text-sm font-semibold text-emerald-300">{wins}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-400">Lost</div>
                                <div className="text-sm font-semibold text-rose-300">{losses}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Match History Tab */}

          </div>
        </div>
      )}

      {session?.status === 'OPEN' && (
        <div className="border-t border-white/10 pt-6">
          <button
            onClick={() => setShowEndConfirm(true)}
            disabled={endSessionLoading}
            className="w-full rounded-lg bg-rose-500/20 px-4 py-3 font-semibold text-rose-200 transition hover:bg-rose-500/30 disabled:opacity-50"
          >
            End Session
          </button>
        </div>
      )}

      {/* End Session Confirmation Modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative w-full max-w-md rounded-lg bg-slate-900 p-6 shadow-2xl">
            <button
              onClick={() => setShowEndConfirm(false)}
              className="absolute right-4 top-4 rounded-full bg-slate-800 p-2 hover:bg-slate-700 transition"
            >
              <svg className="h-5 w-5 text-slate-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="mb-4 text-xl font-bold text-white">End Session?</h2>
            <p className="mb-6 text-sm text-slate-300">
              Are you sure you want to end the session "{session?.name}"? This will close the session and prevent further matches from being recorded.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 rounded-lg border border-slate-500 px-4 py-2 font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEndSession}
                disabled={endSessionLoading}
                className="flex-1 rounded-lg bg-rose-500/30 px-4 py-2 font-semibold text-rose-200 transition hover:bg-rose-500/40 disabled:opacity-50"
              >
                {endSessionLoading ? 'Ending...' : 'End Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      <MatchForm
        sessionId={sessionId}
        sessionCourtIds={session?.courts}
        sessionPlayers={session?.players?.map(p => {
          const player = players.find(pl => pl._id === p.playerId)
          return {
            playerId: p.playerId,
            name: player?.name || 'Unknown',
            gamesPlayed: p.gamesPlayed
          }
        })}
        isOpen={isMatchFormOpen}
        onClose={() => setIsMatchFormOpen(false)}
        onSubmit={handleRecordGame}
        isLoading={recordGameLoading}
        availableCourts={courtsData?.courts}
        ongoingMatches={ongoingMatches}
      />

      {/* Winner Selection Modal */}
      {selectedMatchForWinners && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative w-full max-w-md rounded-lg bg-slate-900 p-6 shadow-2xl">
            <button
              onClick={() => {
                setSelectedMatchForWinners(null)
                setSelectedWinners([])
              }}
              className="absolute right-4 top-4 rounded-full bg-slate-800 p-2 hover:bg-slate-700 transition"
            >
              <svg className="h-5 w-5 text-slate-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="mb-4 text-xl font-semibold text-white">Select Winners</h2>
            <p className="mb-4 text-sm text-slate-300">Choose the winning player(s) for this match</p>

            <div className="mb-6 space-y-2">
              {selectedMatchForWinners.playerIds.map(playerId => {
                const player = players.find(p => p._id === playerId)
                return (
                  <label key={playerId} className="flex items-center gap-3 rounded-lg border border-white/10 p-3 hover:bg-white/5">
                    <input
                      type="checkbox"
                      checked={selectedWinners.includes(playerId)}
                      onChange={() => handleWinnerToggle(playerId)}
                      className="h-4 w-4 rounded border-white/20 bg-white/10"
                    />
                    <div className="text-sm font-medium text-white">{player?.name || 'Unknown'}</div>
                  </label>
                )
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedMatchForWinners(null)
                  setSelectedWinners([])
                }}
                className="flex-1 rounded-lg border border-white/20 px-4 py-2 font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmWinners}
                disabled={recordGameLoading || selectedWinners.length === 0}
                className="flex-1 rounded-lg bg-emerald-500/20 px-4 py-2 font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
              >
                {recordGameLoading ? 'Recording...' : 'Confirm Winners'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Congratulations Modal */}
      {congratsMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative w-full max-w-md rounded-lg bg-linear-to-b from-emerald-500/20 to-slate-900 p-8 shadow-2xl text-center">
            <button
              onClick={() => setCongratsMatch(null)}
              className="absolute right-4 top-4 rounded-full bg-slate-800 p-2 hover:bg-slate-700 transition"
            >
              <svg className="h-5 w-5 text-slate-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="mb-4 text-3xl sm:text-4xl">🎉</div>
            <h2 className="mb-2 text-xl font-bold text-emerald-300 sm:text-2xl">Victory!</h2>
            <p className="mb-6 text-base font-semibold text-white sm:text-lg">
              {congratsMatch.winners.join(' & ')}
            </p>
            <p className="mb-6 text-sm text-slate-300">
              Defeated
            </p>
            <p className="mb-6 text-base font-semibold text-slate-300 sm:text-lg">
              {congratsMatch.losers.join(' & ')}
            </p>

            <button
              onClick={() => setCongratsMatch(null)}
              className="w-full rounded-lg bg-emerald-500/30 px-4 py-2 font-semibold text-emerald-200 transition hover:bg-emerald-500/40"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Update Success Modal */}
      {showUpdateSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative w-full max-w-md rounded-lg bg-slate-900 p-8 shadow-2xl text-center border border-emerald-500/30">
            <button
              onClick={() => setShowUpdateSuccess(false)}
              className="absolute right-4 top-4 rounded-full bg-slate-800 p-2 hover:bg-slate-700 transition"
            >
              <svg className="h-5 w-5 text-slate-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="mb-4 text-3xl sm:text-4xl">✅</div>
            <h2 className="mb-2 text-xl font-bold text-emerald-300 sm:text-2xl">Session Updated!</h2>
            <p className="mb-6 text-sm text-slate-300">
              Your session has been successfully updated.
            </p>

            <button
              onClick={() => setShowUpdateSuccess(false)}
              className="w-full rounded-lg bg-emerald-500/30 px-4 py-2 font-semibold text-emerald-200 transition hover:bg-emerald-500/40"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default SessionDetailPage

