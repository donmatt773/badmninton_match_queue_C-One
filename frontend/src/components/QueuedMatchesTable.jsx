import React, { useMemo } from 'react'

const formatDateTime = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

const QueuedMatchesTable = ({ matchQueue, sessions, players, courts, onEditMatch, onCancelMatch }) => {
  // Flatten matchQueue by sessionId and create list with session names
  const flattenedMatches = useMemo(() => {
    const matches = []
    let globalQueuePosition = 1
    
    Object.entries(matchQueue).forEach(([sessionId, sessionMatches]) => {
      const session = sessions.find(s => s._id === sessionId)
      sessionMatches.forEach((match, index) => {
        matches.push({
          ...match,
          sessionId,
          sessionName: session?.name || 'Unknown',
          queuePosition: index + 1,
          globalQueuePosition: globalQueuePosition++,
        })
      })
    })
    
    return matches
  }, [matchQueue, sessions])

  const getCourtName = (courtId) => {
    return courts?.find(c => c._id === courtId)?.name || 'Unknown Court'
  }

  const getPlayerNames = (playerIds) => {
    const names = playerIds.map(pId => players?.find(p => p._id === pId)?.name || 'Unknown')
    
    // For 2v2, return JSX with highlighted teams
    if (names.length === 4) {
      return (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-200">
            {names[0]} & {names[1]}
          </span>
          <span className="text-slate-400">vs</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-semibold text-yellow-200">
            {names[2]} & {names[3]}
          </span>
        </div>
      )
    }
    
    // For 1v1, return JSX with highlighted teams
    if (names.length === 2) {
      return (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-200">
            {names[0]}
          </span>
          <span className="text-slate-400">vs</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-semibold text-yellow-200">
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
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white sm:text-xl">Queued Matches</h2>
            <p className="mt-1 text-xs text-slate-300 sm:text-sm">
              Matches waiting for courts and players to become available.
            </p>
          </div>
        </header>
        <div className="mt-6 rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-5 py-8 text-center text-slate-300">
            No matches in queue. All matches are active!
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white sm:text-xl">Queued Matches</h2>
          <p className="mt-1 text-xs text-slate-300 sm:text-sm">
            {flattenedMatches.length} match{flattenedMatches.length !== 1 ? 'es' : ''} waiting for courts and players to become available.
          </p>
        </div>
      </header>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full border-collapse text-left text-sm text-slate-200">
          <thead className="bg-white/5 text-[11px] uppercase tracking-[0.3em] text-slate-400">
            <tr>
              <th className="px-5 py-4">Position</th>
              <th className="px-5 py-4">Session</th>
              <th className="px-5 py-4">Court</th>
              <th className="px-5 py-4">Players</th>
              <th className="px-5 py-4">Format</th>
              <th className="px-5 py-4">Queued At</th>
              <th className="px-5 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {flattenedMatches.map((match) => (
              <tr key={match._id} className="transition hover:bg-white/5">
                <td className="px-5 py-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/20 px-3 py-1 text-xs font-semibold text-purple-200">
                    <span className="h-2 w-2 rounded-full bg-purple-400"></span>
                    Queue #{match.queuePosition}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className="font-semibold text-white">{match.sessionName}</span>
                </td>
                <td className="px-5 py-4">{getCourtName(match.courtId)}</td>
                <td className="px-5 py-4 uppercase">{getPlayerNames(match.playerIds)}</td>
                <td className="px-5 py-4">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/20 px-2 py-1 text-xs font-semibold text-slate-200">
                    {getFormat(match.playerIds)}
                  </span>
                </td>
                <td className="px-5 py-4 text-slate-300">{formatDateTime(match.createdAt)}</td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEditMatch && onEditMatch(match)}
                      className="rounded-lg bg-blue-500/20 px-3 py-1.5 text-xs font-semibold text-blue-200 transition hover:bg-blue-500/30 hover:text-blue-100"
                      title="Edit match"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onCancelMatch && onCancelMatch(match)}
                      className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/30 hover:text-red-100"
                      title="Cancel match"
                    >
                      Cancel
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

export default QueuedMatchesTable
