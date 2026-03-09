import React, { useState, useMemo } from 'react'
import { useQuery } from '@apollo/client/react'
import { gql } from '@apollo/client'
import StatusBadge from './StatusBadge'

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

const formatDateTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  return `${dateStr} at ${timeStr}`
}

const SessionRecordDetail = ({ sessionId, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview')
  const [playerSearchTerm, setPlayerSearchTerm] = useState('')
  const [matchHistoryPage, setMatchHistoryPage] = useState(1)
  const matchesPerPage = 5

  const { data: sessionData, loading: sessionLoading, error: sessionError } = useQuery(SESSION_QUERY, {
    variables: { id: sessionId }
  })
  const { data: gamesData, loading: gamesLoading } = useQuery(GAMES_QUERY, {
    variables: { sessionId }
  })
  const { data: courtsData } = useQuery(COURTS_QUERY)
  const { data: playersData } = useQuery(PLAYERS_QUERY)

  const session = sessionData?.session
  const courts = courtsData?.courts || []
  const players = playersData?.players || []

  // Filter and calculate player stats
  const playerStats = useMemo(() => {
    if (!session?.players || !gamesData?.gamesBySession) return []

    return session.players.map(sessionPlayer => {
      const player = players.find(p => p._id === sessionPlayer.playerId)
      
      let wins = 0
      let losses = 0
      
      gamesData.gamesBySession.forEach(game => {
        if (game.players.includes(sessionPlayer.playerId)) {
          if (game.winnerPlayerIds.includes(sessionPlayer.playerId)) {
            wins++
          } else {
            losses++
          }
        }
      })
      
      const totalGames = wins + losses
      const winRate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : '0.0'
      
      return {
        playerId: sessionPlayer.playerId,
        player,
        gamesPlayed: sessionPlayer.gamesPlayed,
        wins,
        losses,
        winRate,
        name: player?.name || 'Unknown'
      }
    })
  }, [session?.players, gamesData?.gamesBySession, players])

  const filteredPlayers = useMemo(() => {
    const term = playerSearchTerm.trim().toLowerCase()
    if (term.length === 0) return playerStats
    
    return playerStats.filter(stat => 
      stat.name.toLowerCase().includes(term)
    )
  }, [playerStats, playerSearchTerm])

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white sm:text-2xl">Session Record</h1>
      </div>

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
          <button
            onClick={() => setActiveTab('matches')}
            className={`px-4 py-3 text-sm font-semibold transition ${
              activeTab === 'matches'
                ? 'border-b-2 border-emerald-400 text-emerald-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Match History
          </button>
        </div>

        {/* Tab Content */}
        <div>
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
            <div className="space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="Search player name..."
                  value={playerSearchTerm}
                  onChange={(e) => setPlayerSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
                />
              </div>
              {filteredPlayers.length === 0 ? (
                <p className="text-sm text-slate-400">No players found</p>
              ) : (
                <div className="space-y-2">
                  {filteredPlayers.map(stat => (
                    <div key={stat.playerId} className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="mb-2">
                        <div className="font-medium text-white">{stat.name}</div>
                        <div className="text-xs text-slate-400">
                          {stat.player?.gender || 'N/A'} • {formatPlayerLevel(stat.player?.playerLevel) || 'N/A'}
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="text-center flex-1">
                          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Played</div>
                          <div className="text-sm font-semibold text-white">{stat.gamesPlayed}</div>
                        </div>
                        <div className="text-center flex-1">
                          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400">Won</div>
                          <div className="text-sm font-semibold text-emerald-300">{stat.wins}</div>
                        </div>
                        <div className="text-center flex-1">
                          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-400">Lost</div>
                          <div className="text-sm font-semibold text-rose-300">{stat.losses}</div>
                        </div>
                        <div className="text-center flex-1">
                          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-400">Win Rate</div>
                          <div className="text-sm font-semibold text-blue-300">{stat.winRate}%</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Match History Tab */}
          {activeTab === 'matches' && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="text-sm font-semibold text-white">
                  Match History {gamesLoading && <span className="text-xs text-slate-400">(loading...)</span>}
                </label>
                {gamesData?.gamesBySession && gamesData.gamesBySession.length > 0 && (
                  <span className="text-xs text-slate-400">
                    {gamesData.gamesBySession.length} total match{gamesData.gamesBySession.length !== 1 ? 'es' : ''}
                  </span>
                )}
              </div>
              {gamesData?.gamesBySession?.length === 0 ? (
                <p className="text-sm text-slate-400">No matches recorded yet</p>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    {(() => {
                      const allMatches = gamesData?.gamesBySession || []
                      const totalPages = Math.ceil(allMatches.length / matchesPerPage)
                      const startIndex = (matchHistoryPage - 1) * matchesPerPage
                      const endIndex = startIndex + matchesPerPage
                      const paginatedMatches = allMatches.slice(startIndex, endIndex)

                      return paginatedMatches.map(game => {
                        const winners = game.winnerPlayerIds.map(wId => players.find(p => p._id === wId)?.name || 'Unknown').join(' / ')
                        const losers = game.players.filter(pId => !game.winnerPlayerIds.includes(pId)).map(pId => players.find(p => p._id === pId)?.name || 'Unknown').join(' / ')
                        const court = courts.find(c => c._id === game.courtId)

                        return (
                          <div key={game._id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">{court?.name || 'Court'}</div>
                              <span className="text-xs text-slate-500">{formatDateTime(game.finishedAt)}</span>
                            </div>
                            <div className="text-sm text-white">
                              <span className="text-slate-300">{losers}</span>
                              <span className="mx-2 text-slate-500">vs</span>
                              <span className="text-emerald-300">{winners}</span>
                              <span className="text-slate-500"> = </span>
                              <span className="font-semibold text-emerald-400">{winners}</span>
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                  
                  {(() => {
                    const allMatches = gamesData?.gamesBySession || []
                    const totalPages = Math.ceil(allMatches.length / matchesPerPage)
                    
                    if (totalPages <= 1) return null
                    
                    return (
                      <div className="flex items-center justify-between border-t border-white/10 pt-4">
                        <button
                          onClick={() => setMatchHistoryPage(prev => Math.max(1, prev - 1))}
                          disabled={matchHistoryPage === 1}
                          className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                          Previous
                        </button>
                        
                        <span className="text-xs text-slate-400">
                          Page {matchHistoryPage} of {totalPages}
                        </span>
                        
                        <button
                          onClick={() => setMatchHistoryPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={matchHistoryPage === totalPages}
                          className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Next
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SessionRecordDetail
