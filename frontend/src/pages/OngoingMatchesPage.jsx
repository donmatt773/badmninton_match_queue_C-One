import React, { useEffect, useMemo, useState } from 'react'
import OngoingMatchesTable from '../components/OngoingMatchesTable'
import QueuedMatchesTable from '../components/QueuedMatchesTable'

const OngoingMatchesPage = ({
  ongoingMatches,
  matchQueue,
  sessions,
  players,
  courts,
  onUpdateMatch,
  onEndMatch,
  onCreateMatch,
  onStartMatch,
  onEditMatch,
  onCancelMatch,
  filteredSessionId,
  onClearFilter,
  onFilterSessionChange,
}) => {
  const [sessionFilterId, setSessionFilterId] = useState(filteredSessionId || '')

  useEffect(() => {
    setSessionFilterId(filteredSessionId || '')
  }, [filteredSessionId])

  useEffect(() => {
    if (!onFilterSessionChange) return
    onFilterSessionChange(sessionFilterId || null)
  }, [sessionFilterId, onFilterSessionChange])

  const openSessions = useMemo(
    () => sessions.filter((session) => session.status !== 'CLOSED' && !session.isArchived),
    [sessions]
  )

  const activeFilterSessionId = sessionFilterId || null

  // Filter matches by session if a filter is active
  const filteredOngoingMatches = activeFilterSessionId
    ? { [activeFilterSessionId]: ongoingMatches[activeFilterSessionId] || [] }
    : ongoingMatches

  const filteredMatchQueue = activeFilterSessionId
    ? { [activeFilterSessionId]: matchQueue[activeFilterSessionId] || [] }
    : matchQueue

  const filteredSession = activeFilterSessionId
    ? sessions.find(s => s._id === activeFilterSessionId)
    : null

  const handleClearAllSessionFilters = () => {
    setSessionFilterId('')
    if (onClearFilter) {
      onClearFilter()
    }
  }

  return (
    <div className="space-y-6 py-5">
      <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-6">
        <span className="text-sm text-slate-400">Filter:</span>
        <select
          value={sessionFilterId}
          onChange={(e) => setSessionFilterId(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-white/30 focus:outline-none"
        >
          <option value="" className='text-black'>All Sessions</option>
          {openSessions.map((session) => (
            <option className='text-black' key={session._id} value={session._id}>
              {session.name}
            </option>
          ))}
        </select>
        {activeFilterSessionId && filteredSession && (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs">
            <span className="text-emerald-200">{filteredSession.name}</span>
            <button
              onClick={handleClearAllSessionFilters}
              className="text-emerald-300 hover:text-emerald-100 transition"
            >
              ✕
            </button>
          </span>
        )}
      </div>

      <OngoingMatchesTable
        ongoingMatches={filteredOngoingMatches}
        sessions={sessions}
        players={players}
        courts={courts}
        onUpdateMatch={onUpdateMatch}
        onEndMatch={onEndMatch}
        onCreateMatch={onCreateMatch}
        onStartMatch={onStartMatch}
      />

      <QueuedMatchesTable
        matchQueue={filteredMatchQueue}
        sessions={sessions}
        players={players}
        courts={courts}
        onEditMatch={onEditMatch}
        onCancelMatch={onCancelMatch}
      />
    </div>
  )
}

export default OngoingMatchesPage
