import React, { useMemo, useEffect, useRef } from 'react'

const formatDateTime = (value) => {
  if (!value) return '—'
  const date = new Date(Number(value)) // Convert string timestamp to number
  if (Number.isNaN(date.getTime())) return '—'
  
  // Format: "Feb 26, 3:45 PM"
  const options = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }
  return date.toLocaleString('en-US', options)
}

const OngoingMatchesTable = ({ ongoingMatches, sessions, players, courts, onUpdateMatch, onEndMatch, onCreateMatch, onStartMatch }) => {
  const startedMatchIds = useRef(new Set())
  // Flatten ongoingMatches by sessionId
  const flattenedMatches = useMemo(() => {
    const matches = []
    
    Object.entries(ongoingMatches).forEach(([sessionId, sessionMatches]) => {
      const session = sessions.find(s => s._id === sessionId)
      sessionMatches.forEach((match) => {
        matches.push({
          ...match,
          sessionId,
          sessionName: session?.name || 'Unknown',
        })
      })
    })
    
    return matches
  }, [ongoingMatches, sessions])

  // Auto-start queued matches
  useEffect(() => {
    flattenedMatches.forEach((match) => {
      if (match.queued && !startedMatchIds.current.has(match._id)) {
        startedMatchIds.current.add(match._id)
        if (onStartMatch) {
          onStartMatch(match)
        }
      }
    })
  }, [flattenedMatches, onStartMatch])

  const getCourtName = (courtId) => {
    return courts?.find(c => c._id === courtId)?.name || 'Unknown Court'
  }

  const getPlayerNames = (playerIds) => {
    const names = playerIds.map(pId => players?.find(p => p._id === pId)?.name || 'Unknown')
    
    // For 2v2, return JSX with highlighted teams
    if (names.length === 4) {
      return (
        <div className="flex items-center gap-2">
          <span className="uppercase inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-200">
            {names[0]} & {names[1]}
          </span>
          <span className="text-slate-400">vs</span>
          <span className="uppercase inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
            {names[2]} & {names[3]}
          </span>
        </div>
      )
    }
    
    // For 1v1, return JSX with highlighted teams
    if (names.length === 2) {
      return (
        <div className="flex items-center gap-2">
          <span className="uppercase inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-200">
            {names[0]}
          </span>
          <span className="text-slate-400">vs</span>
          <span className="uppercase inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
            {names[1]}
          </span>
        </div>
      )
    }
    
    // Fallback
    return names.join(' vs ')
  }

  const getFormat = (playerIds) => {
    return playerIds.length === 2 ? '1v1 (Singles)' : '2v2 (Doubles)'
  }

  if (flattenedMatches.length === 0) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-black/20">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white sm:text-lg">Ongoing Matches</h3>
            <p className="mt-1 text-xs text-slate-300">
              Matches currently in progress.
            </p>
          </div>
          <div className="flex gap-2">
            {onCreateMatch && (
              <button
                onClick={onCreateMatch}
                className="rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
              >
                + Create Match
              </button>
            )}
          </div>
        </header>
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-4 py-6 text-center text-sm text-slate-300">
            No ongoing matches.
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-black/20">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white sm:text-lg">Ongoing Matches</h3>
          <p className="mt-1 text-xs text-slate-300">
            {flattenedMatches.length} match{flattenedMatches.length !== 1 ? 'es' : ''} currently in progress.
          </p>
        </div>
        <div className="flex gap-2">
          {onCreateMatch && (
            <button
              onClick={onCreateMatch}
              className="rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
            >
              + Create Match
            </button>
          )}
        </div>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full border-collapse text-left text-xs text-slate-200">
          <thead className="bg-white/5 text-[10px] uppercase tracking-[0.3em] text-slate-400">
            <tr>
              <th className="px-3 py-3">Session</th>
              <th className="px-3 py-3">Court</th>
              <th className="px-3 py-3">Players</th>
              <th className="px-3 py-3">Format</th>
              <th className="px-3 py-3">Started</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {flattenedMatches.map((match) => (
              <tr key={`${match.sessionId}-${match._id}`} className="transition hover:bg-white/5">
                <td className="px-3 py-3">
                  <span className="font-semibold text-white text-xs">{match.sessionName}</span>
                </td>
                <td className="px-3 py-3 text-xs">{getCourtName(match.courtId)}</td>
                <td className="px-3 py-3 text-xs">{getPlayerNames(match.playerIds)}</td>
                <td className="px-3 py-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/20 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                    {getFormat(match.playerIds)}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-slate-300">
                  {match.queued ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-semibold text-yellow-200">
                      Ready to start
                    </span>
                  ) : (
                    formatDateTime(match.startedAt)
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    {onStartMatch && (
                      <button
                        onClick={() => onStartMatch(match)}
                        disabled={!match.queued}
                        className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        title={match.queued ? "Start match" : "Match already started"}
                      >
                        Start
                      </button>
                    )}
                    <button
                      onClick={() => onUpdateMatch && onUpdateMatch(match)}
                      className="rounded-lg bg-blue-500/20 px-3 py-1.5 text-xs font-semibold text-blue-200 transition hover:bg-blue-500/30 hover:text-blue-100"
                      title="Edit match"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onEndMatch && onEndMatch(match)}
                      className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/30 hover:text-red-100"
                      title="End match"
                    >
                      End Match
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default OngoingMatchesTable
