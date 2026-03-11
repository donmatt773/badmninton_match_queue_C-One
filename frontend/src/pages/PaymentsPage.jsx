import React, { useMemo, useRef, useState } from 'react'

const PaymentsPage = ({
  sessions,
  players,
  ongoingMatches,
  matchQueue,
  games,
  onFinishPlayer,
  filteredSessionId,
  onFilterSessionChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const recencyBaseRef = useRef(Date.now())
  const [selectedPlayerForFinish, setSelectedPlayerForFinish] = useState(null)
  const [showNoPaymentConfirm, setShowNoPaymentConfirm] = useState(false)
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptPlayer, setReceiptPlayer] = useState(null)
  const [finishedPlayers, setFinishedPlayers] = useState(new Set())
  const [sessionFilterId, setSessionFilterId] = useState(filteredSessionId || '')
  const [selectedPlayersForBatch, setSelectedPlayersForBatch] = useState(new Set())
  const [showBatchPaymentConfirm, setShowBatchPaymentConfirm] = useState(false)
  const [batchPaymentData, setBatchPaymentData] = useState(null)
  const [showBatchNoPaymentConfirm, setShowBatchNoPaymentConfirm] = useState(false)
  const [showBatchPaymentConfirmation, setShowBatchPaymentConfirmation] = useState(false)
  const [showBatchReceipt, setShowBatchReceipt] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)

  const normalizeId = (value) => {
    if (value === null || value === undefined) return ''
    return String(value)
  }

  const openSessions = useMemo(
    () => sessions.filter((session) => session.status !== 'CLOSED' && !session.isArchived),
    [sessions]
  )

  const activeSessionId = sessionFilterId || null

  const sessionScope = useMemo(() => {
    if (activeSessionId) {
      return sessions.filter((session) => normalizeId(session._id) === normalizeId(activeSessionId))
    }
    return sessions.filter((session) => session.status !== 'CLOSED' && !session.isArchived)
  }, [sessions, activeSessionId])

  const scopedPlayers = useMemo(() => {
    const allowedPlayerIds = new Set(
      sessionScope.flatMap((session) => (session.players || []).map((item) => normalizeId(item.playerId)))
    )

    return players.filter((player) => allowedPlayerIds.has(normalizeId(player._id)))
  }, [players, sessionScope])

  const scopedSessionIds = useMemo(() => {
    return new Set(sessionScope.map((session) => normalizeId(session._id)))
  }, [sessionScope])

  const playerStats = useMemo(() => {
    const stats = {}
    let recencyFallbackSeed = recencyBaseRef.current

    const parseTimestamp = (value) => {
      if (!value) return 0
      const parsed = new Date(value).getTime()
      return Number.isFinite(parsed) ? parsed : 0
    }

    const getRecencyValue = (...values) => {
      const parsedValues = values.map(parseTimestamp)
      const best = Math.max(...parsedValues)
      if (best > 0) return best

      // Fallback path when backend timestamps are missing/invalid.
      recencyFallbackSeed -= 1
      return recencyFallbackSeed
    }

    scopedPlayers.forEach((player) => {
      const playerId = normalizeId(player._id)
      stats[playerId] = {
        name: player.name,
        matchCount: 0,
        liveCount: 0,
        latestMatchAt: 0,
      }
    })

    sessionScope.forEach((session) => {
      ;(session.players || []).forEach((item) => {
        const playerId = normalizeId(item.playerId)
        if (!stats[playerId]) return
        stats[playerId].matchCount += Number(item.gamesPlayed || 0)
      })
    })

    const countMatchesByPlayer = (matchesBySession = {}) => {
      Object.entries(matchesBySession).forEach(([sessionId, sessionMatches]) => {
        if (!scopedSessionIds.has(normalizeId(sessionId))) return
        if (!Array.isArray(sessionMatches)) return
        sessionMatches.forEach((match) => {
          if (!Array.isArray(match?.playerIds)) return
          const matchTime = getRecencyValue(match?.startedAt, match?.updatedAt, match?.createdAt)
          match.playerIds.forEach((playerIdRaw) => {
            const playerId = normalizeId(playerIdRaw)
            if (stats[playerId]) {
              stats[playerId].liveCount += 1
              stats[playerId].latestMatchAt = Math.max(stats[playerId].latestMatchAt, matchTime)
            }
          })
        })
      })
    }

    ;(games || []).forEach((game) => {
      if (!scopedSessionIds.has(normalizeId(game?.sessionId))) return
      if (!Array.isArray(game?.players)) return

      const gameTime = getRecencyValue(game?.finishedAt, game?.updatedAt, game?.createdAt)

      game.players.forEach((playerIdRaw) => {
        const playerId = normalizeId(playerIdRaw)
        if (stats[playerId]) {
          stats[playerId].latestMatchAt = Math.max(stats[playerId].latestMatchAt, gameTime)
        }
      })
    })

    countMatchesByPlayer(ongoingMatches)
    countMatchesByPlayer(matchQueue)

    Object.values(stats).forEach((item) => {
      item.matchCount += item.liveCount
      delete item.liveCount
    })

    return Object.entries(stats)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => {
        if (b.latestMatchAt !== a.latestMatchAt) {
          return b.latestMatchAt - a.latestMatchAt
        }
        if (b.matchCount !== a.matchCount) {
          return b.matchCount - a.matchCount
        }
        return a.name.localeCompare(b.name)
      })
  }, [scopedPlayers, sessionScope, ongoingMatches, matchQueue, scopedSessionIds, games])

  const buildPaymentSummary = (playerId) => {
    const normalizedPlayerId = normalizeId(playerId)
    const rows = sessionScope
      .map((session) => {
        const sessionPlayer = (session.players || []).find(
          (item) => normalizeId(item.playerId) === normalizedPlayerId
        )
        const gameCount = Number(sessionPlayer?.gamesPlayed || 0)
        const price = Number(session.price || 0)
        const subtotal = gameCount * price

        return {
          sessionId: normalizeId(session._id),
          sessionName: session.name,
          gameCount,
          price,
          subtotal,
        }
      })
      .filter((row) => row.gameCount > 0 || activeSessionId)

    const totalGames = rows.reduce((sum, row) => sum + row.gameCount, 0)
    const totalAmount = rows.reduce((sum, row) => sum + row.subtotal, 0)

    return {
      rows,
      totalGames,
      totalAmount,
    }
  }

  const buildBatchPaymentSummary = (playerIds) => {
    let totalGames = 0
    let totalAmount = 0
    const playerDetails = []

    playerIds.forEach((playerId) => {
      const player = filteredPlayerStats.find((p) => p.id === playerId)
      if (!player) return

      const summary = buildPaymentSummary(playerId)
      playerDetails.push({
        playerId,
        playerName: player.name,
        games: summary.totalGames,
        amount: summary.totalAmount,
      })
      totalGames += summary.totalGames
      totalAmount += summary.totalAmount
    })

    return {
      playerDetails,
      totalGames,
      totalAmount,
    }
  }

  const handleBatchPaymentClick = () => {
    if (selectedPlayersForBatch.size === 0) return
    const batchData = buildBatchPaymentSummary(Array.from(selectedPlayersForBatch))
    setBatchPaymentData(batchData)
    setShowBatchPaymentConfirm(true)
  }

  const handleTogglePlayerSelection = (playerId) => {
    if (isPlayerInActiveMatch(playerId)) return
    const newSelected = new Set(selectedPlayersForBatch)
    if (newSelected.has(playerId)) {
      newSelected.delete(playerId)
    } else {
      newSelected.add(playerId)
    }
    setSelectedPlayersForBatch(newSelected)
  }

  const getPlayerTotalPayment = (playerId) => {
    if (finishedPlayers.has(normalizeId(playerId))) {
      return 0
    }
    const summary = buildPaymentSummary(playerId)
    return summary.totalAmount
  }

  const activeOrQueuedPlayerIds = useMemo(() => {
    const ids = new Set()

    const collectPlayerIds = (matchesBySession = {}) => {
      Object.values(matchesBySession).forEach((matches) => {
        if (!Array.isArray(matches)) return
        matches.forEach((match) => {
          if (!Array.isArray(match?.playerIds)) return
          match.playerIds.forEach((id) => {
            ids.add(normalizeId(id))
          })
        })
      })
    }

    collectPlayerIds(ongoingMatches || {})
    collectPlayerIds(matchQueue || {})

    return ids
  }, [ongoingMatches, matchQueue])

  const isPlayerInActiveMatch = (playerId) => activeOrQueuedPlayerIds.has(normalizeId(playerId))

  // Keep batch selection valid when live queue/match data changes.
  React.useEffect(() => {
    setSelectedPlayersForBatch((prev) => {
      if (prev.size === 0) return prev

      const next = new Set(Array.from(prev).filter((id) => !activeOrQueuedPlayerIds.has(String(id))))
      return next.size === prev.size ? prev : next
    })
  }, [activeOrQueuedPlayerIds])

  const filteredPlayerStats = useMemo(() => {
    if (!searchQuery.trim()) {
      return playerStats
    }
    const query = searchQuery.toLowerCase().trim()
    return playerStats.filter((player) => player.name.toLowerCase().includes(query))
  }, [playerStats, searchQuery])

  // Reset to first page when search query changes
  React.useEffect(() => {
    setCurrentPage(0)
  }, [searchQuery, sessionFilterId])

  // Pagination logic
  const PLAYERS_PER_PAGE = 10
  const totalPages = Math.max(1, Math.ceil(filteredPlayerStats.length / PLAYERS_PER_PAGE))
  const clampedPage = Math.min(currentPage, totalPages - 1)
  const startIndex = clampedPage * PLAYERS_PER_PAGE
  const endIndex = startIndex + PLAYERS_PER_PAGE
  const paginatedPlayerStats = filteredPlayerStats.slice(startIndex, endIndex)

  return (
    <div className="space-y-6 py-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white md:text-2xl">Payments</h1>
      </div>

      <div className="flex items-center gap-3 border-b border-white/10 pb-4">
        <span className="text-sm text-slate-400">Session:</span>
        <select
          value={sessionFilterId}
          onChange={(e) => {
            const value = e.target.value
            setSessionFilterId(value)
            if (onFilterSessionChange) {
              onFilterSessionChange(value || null)
            }
          }}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-white/30 focus:outline-none"
        >
          <option value="" className="text-black">All Active Sessions</option>
          {openSessions.map((session) => (
            <option className="text-black" key={session._id} value={session._id}>
              {session.name}
            </option>
          ))}
        </select>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-black/20">
        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search players by name..."
            className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-4 py-2 text-sm text-white placeholder-slate-400 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </div>

        {selectedPlayersForBatch.size > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
            <span className="text-sm font-semibold text-emerald-200">
              {selectedPlayersForBatch.size} player{selectedPlayersForBatch.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedPlayersForBatch(new Set())}
                className="rounded-lg border border-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/10"
              >
                Clear
              </button>
              <button
                onClick={handleBatchPaymentClick}
                className="rounded-lg bg-emerald-500/20 px-4 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
              >
                Batch Payment
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-full border-collapse text-left text-sm text-slate-200">
            <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3 w-12">
                  {(() => {
                    const selectablePlayers = paginatedPlayerStats.filter((p) => !isPlayerInActiveMatch(p.id))
                    const allSelectableChecked = selectablePlayers.length > 0 && selectablePlayers.every((p) => selectedPlayersForBatch.has(p.id))
                    return (
                  <input
                    type="checkbox"
                    checked={allSelectableChecked}
                    disabled={selectablePlayers.length === 0}
                    onChange={() => {
                      if (allSelectableChecked) {
                        const newSelected = new Set(selectedPlayersForBatch)
                        selectablePlayers.forEach((p) => newSelected.delete(p.id))
                        setSelectedPlayersForBatch(newSelected)
                      } else {
                        const newSelected = new Set(selectedPlayersForBatch)
                        selectablePlayers.forEach((p) => newSelected.add(p.id))
                        setSelectedPlayersForBatch(newSelected)
                      }
                    }}
                    title={selectablePlayers.length === 0 ? 'All players on this page are in a match or queue' : ''}
                    className="h-4 w-4 rounded border-white/20 bg-white/10 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  />
                    )
                  })()}
                </th>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Player Name</th>
                <th className="px-4 py-3 text-center">Match Count</th>
                <th className="px-4 py-3 text-center">Pending Payment</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {paginatedPlayerStats.map((player, index) => (
                <tr key={player.id} className="transition hover:bg-white/5">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedPlayersForBatch.has(player.id)}
                      onChange={() => handleTogglePlayerSelection(player.id)}
                      disabled={isPlayerInActiveMatch(player.id)}
                      title={isPlayerInActiveMatch(player.id) ? 'Player is currently in a match or queue' : ''}
                      className="h-4 w-4 rounded border-white/20 bg-white/10 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-400">{startIndex + index + 1}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-white">{player.name}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${
                        player.matchCount > 0
                          ? 'bg-emerald-500/20 text-emerald-200'
                          : 'bg-slate-500/20 text-slate-300'
                      }`}
                    >
                      {player.matchCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-semibold text-emerald-200">
                      ₱{getPlayerTotalPayment(player.id).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => {
                        const paymentSummary = buildPaymentSummary(player.id)
                        setSelectedPlayerForFinish({ ...player, paymentSummary })
                      }}
                      disabled={isPlayerInActiveMatch(player.id)}
                      title={isPlayerInActiveMatch(player.id) ? 'Player is currently in a match or queue' : ''}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        isPlayerInActiveMatch(player.id)
                          ? 'bg-emerald-500/10 text-emerald-200/50 cursor-not-allowed opacity-50'
                          : 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 hover:text-emerald-100'
                      }`}
                    >
                      Finish Player
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredPlayerStats.length > PLAYERS_PER_PAGE && (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/40 p-3 sm:p-4">
            <button
              onClick={() => setCurrentPage(Math.max(0, clampedPage - 1))}
              disabled={clampedPage === 0}
              className="rounded-lg bg-slate-700 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <span className="text-xs sm:text-sm text-slate-300">
              Page <span className="font-semibold text-white">{clampedPage + 1}</span> of <span className="font-semibold text-white">{totalPages}</span> • Total Players: <span className="font-semibold text-white">{filteredPlayerStats.length}</span>
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, clampedPage + 1))}
              disabled={clampedPage >= totalPages - 1}
              className="rounded-lg bg-slate-700 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        )}
      </section>

      {selectedPlayerForFinish && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="border-b border-white/10 px-5 py-4">
              <h3 className="text-base font-semibold text-white">Confirm Player Finish</h3>
              <p className="mt-1 text-xs text-slate-300">Review player details and payment before confirming.</p>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-slate-400">Player</p>
                <p className="text-sm font-semibold text-white">{selectedPlayerForFinish.name}</p>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="mb-2 text-xs text-slate-400">Payment Calculation</p>
                <div className="space-y-2">
                  {selectedPlayerForFinish.paymentSummary.rows.map((row) => (
                    <div key={row.sessionId} className="rounded-md border border-white/10 px-3 py-2">
                      <p className="text-xs font-semibold text-white">{row.sessionName}</p>
                      <p className="mt-1 text-xs text-slate-300">
                        {row.gameCount} x {row.price.toFixed(2)} ={' '}
                        <span className="font-semibold text-emerald-200">{row.subtotal.toFixed(2)}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-slate-200">
                  Total Games: <span className="font-semibold text-white">{selectedPlayerForFinish.paymentSummary.totalGames}</span>
                </p>
                <p className="mt-2 text-xs text-slate-200">
                  Total Payment:{' '}
                  <span className="font-semibold text-emerald-200">{selectedPlayerForFinish.paymentSummary.totalAmount.toFixed(2)}</span>
                </p>
              </div>
            </div>

            <div className="flex gap-2 border-t border-white/10 px-5 py-4">
              <button
                onClick={() => setSelectedPlayerForFinish(null)}
                className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowNoPaymentConfirm(true)}
                disabled={isPlayerInActiveMatch(selectedPlayerForFinish.id)}
                title={isPlayerInActiveMatch(selectedPlayerForFinish.id) ? 'Player is currently in a match or queue' : ''}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  isPlayerInActiveMatch(selectedPlayerForFinish.id)
                    ? 'bg-orange-500/10 text-orange-200/50 cursor-not-allowed opacity-50'
                    : 'bg-orange-500/20 text-orange-200 hover:bg-orange-500/30'
                }`}
              >
                Finish Without Payment
              </button>
              <button
                onClick={() => setShowPaymentConfirm(true)}
                disabled={isPlayerInActiveMatch(selectedPlayerForFinish.id)}
                title={isPlayerInActiveMatch(selectedPlayerForFinish.id) ? 'Player is currently in a match or queue' : ''}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  isPlayerInActiveMatch(selectedPlayerForFinish.id)
                    ? 'bg-emerald-500/10 text-emerald-200/50 cursor-not-allowed opacity-50'
                    : 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                }`}
              >
                Finish With <br />Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {showNoPaymentConfirm && selectedPlayerForFinish && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="border-b border-white/10 px-5 py-4">
              <h3 className="text-base font-semibold text-white">Confirm Without Payment</h3>
              <p className="mt-1 text-xs text-slate-300">Are you sure you want to finish this player without payment?</p>
            </div>

            <div className="px-5 py-4">
              <p className="text-sm text-white">
                Player: <span className="font-semibold text-emerald-200">{selectedPlayerForFinish.name}</span>
              </p>
              <p className="mt-2 text-xs text-slate-300">This action will mark the player as finished without collecting payment.</p>
            </div>

            <div className="flex gap-2 border-t border-white/10 px-5 py-4">
              <button
                onClick={() => {
                  setShowNoPaymentConfirm(false)
                  setSelectedPlayerForFinish(null)
                }}
                className="flex-1 rounded-lg border border-orange-500/20 px-3 py-2 text-xs font-semibold text-orange-200 transition hover:bg-orange-500/10"
              >
                No
              </button>
              <button
                onClick={() => {
                  const playerId = selectedPlayerForFinish.id
                  const sessionsToRemoveFrom = selectedPlayerForFinish.paymentSummary.rows.map((row) => row.sessionId)
                  if (onFinishPlayer) {
                    onFinishPlayer(playerId, { isExempted: true, sessionsToRemoveFrom })
                  }
                  setFinishedPlayers((prev) => new Set([...prev, normalizeId(playerId)]))
                  setShowNoPaymentConfirm(false)
                  setSelectedPlayerForFinish(null)
                }}
                className="flex-1 rounded-lg bg-orange-500/20 px-3 py-2 text-xs font-semibold text-orange-200 transition hover:bg-orange-500/30"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentConfirm && selectedPlayerForFinish && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="border-b border-white/10 px-5 py-4">
              <h3 className="text-base font-semibold text-white">Confirm Payment</h3>
              <p className="mt-1 text-xs text-slate-300">Are you sure you want to finish this player with payment?</p>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div>
                <p className="text-sm text-white">
                  Player: <span className="font-semibold text-emerald-200">{selectedPlayerForFinish.name}</span>
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="mb-2 text-xs text-slate-400">Payment Summary</p>
                {selectedPlayerForFinish.paymentSummary.rows.map((row) => (
                  <p key={row.sessionId} className="mb-1 text-xs text-slate-300">
                    {row.sessionName}: {row.gameCount} x {row.price.toFixed(2)} ={' '}
                    <span className="font-semibold text-emerald-200">{row.subtotal.toFixed(2)}</span>
                  </p>
                ))}
                <div className="mt-2 border-t border-white/10 pt-2">
                  <p className="text-xs text-white">
                    Total: <span className="font-semibold text-emerald-200">{selectedPlayerForFinish.paymentSummary.totalAmount.toFixed(2)}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t border-white/10 px-5 py-4">
              <button
                onClick={() => setShowPaymentConfirm(false)}
                className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
              >
                No
              </button>
              <button
                onClick={() => {
                  const playerId = selectedPlayerForFinish.id
                  const sessionsToRemoveFrom = selectedPlayerForFinish.paymentSummary.rows.map((row) => row.sessionId)
                  const receiptData = { ...selectedPlayerForFinish }
                  if (onFinishPlayer) {
                    onFinishPlayer(playerId, { isExempted: false, sessionsToRemoveFrom })
                  }
                  setFinishedPlayers((prev) => new Set([...prev, normalizeId(playerId)]))
                  setShowPaymentConfirm(false)
                  setReceiptPlayer(receiptData)
                  setSelectedPlayerForFinish(null)
                  setShowReceipt(true)
                }}
                className="flex-1 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatchPaymentConfirm && batchPaymentData && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="border-b border-white/10 px-5 py-4">
              <h3 className="text-base font-semibold text-white">Confirm Batch Payment</h3>
              <p className="mt-1 text-xs text-slate-300">Review players and total payment before confirming.</p>
            </div>

            <div className="space-y-4 px-5 py-4 max-h-96 overflow-y-auto">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-slate-400 mb-3">Selected Players</p>
                <div className="space-y-2">
                  {batchPaymentData.playerDetails.map((detail) => (
                    <div key={detail.playerId} className="flex items-center justify-between rounded-md border border-white/10 px-3 py-2">
                      <div>
                        <p className="text-xs font-semibold text-white">{detail.playerName}</p>
                        <p className="text-[10px] text-slate-400">{detail.games} games</p>
                      </div>
                      <p className="text-xs font-semibold text-emerald-200">₱{detail.amount.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="flex justify-between mb-2">
                  <span className="text-xs text-slate-200">Total Games:</span>
                  <span className="text-xs font-semibold text-white">{batchPaymentData.totalGames}</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-2">
                  <span className="text-xs text-slate-200">Total Amount:</span>
                  <span className="text-sm font-semibold text-emerald-200">₱{batchPaymentData.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t border-white/10 px-5 py-4">
              <button
                onClick={() => {
                  setShowBatchPaymentConfirm(false)
                  setBatchPaymentData(null)
                }}
                className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowBatchPaymentConfirm(false)
                  setShowBatchNoPaymentConfirm(true)
                }}
                className="flex-1 rounded-lg bg-orange-500/20 px-3 py-2 text-xs font-semibold text-orange-200 transition hover:bg-orange-500/30"
              >
                Finish Without Payment
              </button>
              <button
                onClick={() => {
                  setShowBatchPaymentConfirm(false)
                  setShowBatchPaymentConfirmation(true)
                }}
                className="flex-1 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatchNoPaymentConfirm && batchPaymentData && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="border-b border-white/10 px-5 py-4">
              <h3 className="text-base font-semibold text-white">Confirm Batch Finish Without Payment</h3>
              <p className="mt-1 text-xs text-slate-300">Are you sure you want to finish these players without payment?</p>
            </div>

            <div className="px-5 py-4 space-y-3 max-h-64 overflow-y-auto">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="mb-2 text-xs text-slate-400">Selected Players</p>
                <div className="space-y-2">
                  {batchPaymentData.playerDetails.map((detail) => (
                    <div key={detail.playerId} className="flex items-center justify-between text-xs">
                      <p className="text-white">{detail.playerName}</p>
                      <p className="text-slate-400">{detail.games} games</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-300">This action will mark these players as finished without collecting payment.</p>
            </div>

            <div className="flex gap-2 border-t border-white/10 px-5 py-4">
              <button
                onClick={() => {
                  setShowBatchNoPaymentConfirm(false)
                  setShowBatchPaymentConfirm(true)
                }}
                className="flex-1 rounded-lg border border-orange-500/20 px-3 py-2 text-xs font-semibold text-orange-200 transition hover:bg-orange-500/10"
              >
                No
              </button>
              <button
                onClick={async () => {
                  // Process batch payment without payment sequentially
                  const playerIds = Array.from(selectedPlayersForBatch)
                  for (const playerId of playerIds) {
                    const summary = buildPaymentSummary(playerId)
                    const sessionsToRemoveFrom = summary.rows.map((row) => row.sessionId)
                    if (onFinishPlayer) {
                      await onFinishPlayer(playerId, { isExempted: true, sessionsToRemoveFrom })
                    }
                    setFinishedPlayers((prev) => new Set([...prev, normalizeId(playerId)]))
                  }
                  setShowBatchNoPaymentConfirm(false)
                  setShowBatchPaymentConfirm(false)
                  setBatchPaymentData(null)
                  setSelectedPlayersForBatch(new Set())
                }}
                className="flex-1 rounded-lg bg-orange-500/20 px-3 py-2 text-xs font-semibold text-orange-200 transition hover:bg-orange-500/30"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {showReceipt && receiptPlayer && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="border-b border-white/10 px-5 py-4 text-center">
              <h3 className="text-lg font-semibold text-white">Payment Receipt</h3>
              <p className="mt-1 text-xs text-slate-300">Transaction successful</p>
            </div>

            <div className="space-y-4 px-5 py-6">
              <div className="text-center">
                <p className="text-xs text-slate-400">Player Name</p>
                <p className="text-base font-semibold text-white">{receiptPlayer.name}</p>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="mb-3">
                  <p className="mb-2 text-xs text-slate-400">Session Details</p>
                  {receiptPlayer.paymentSummary.rows.map((row) => (
                    <div key={row.sessionId} className="mb-2 flex justify-between text-xs text-slate-300">
                      <span>{row.sessionName}</span>
                      <span>
                        {row.gameCount} games x {row.price.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between border-t border-white/10 pt-3">
                  <span className="text-sm font-semibold text-white">Total Games:</span>
                  <span className="text-sm font-semibold text-white">{receiptPlayer.paymentSummary.totalGames}</span>
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="text-sm font-semibold text-white">Total Amount:</span>
                  <span className="text-lg font-bold text-emerald-300">{receiptPlayer.paymentSummary.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              <p className="text-center text-xs text-slate-400">Payment has been recorded</p>
            </div>

            <div className="border-t border-white/10 px-5 py-4">
              <button
                onClick={() => {
                  setShowReceipt(false)
                  setReceiptPlayer(null)
                }}
                className="w-full rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatchPaymentConfirmation && batchPaymentData && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="border-b border-white/10 px-5 py-4">
              <h3 className="text-base font-semibold text-white">Confirm Batch Payment</h3>
              <p className="mt-1 text-xs text-slate-300">Are you sure you want to confirm payment for these players?</p>
            </div>

            <div className="px-5 py-4 space-y-3 max-h-64 overflow-y-auto">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="mb-2 text-xs text-slate-400">Selected Players</p>
                <div className="space-y-2">
                  {batchPaymentData.playerDetails.map((detail) => (
                    <div key={detail.playerId} className="flex items-center justify-between text-xs">
                      <p className="text-white font-semibold">{detail.playerName}</p>
                      <p className="text-emerald-200">₱{detail.amount.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="flex justify-between text-xs text-slate-200">
                  <span>Total Payment:</span>
                  <span className="font-semibold text-emerald-200">₱{batchPaymentData.totalAmount.toFixed(2)}</span>
                </div>
              </div>
              <p className="text-xs text-slate-300">This action will mark all players as finished with payment recorded.</p>
            </div>

            <div className="flex gap-2 border-t border-white/10 px-5 py-4">
              <button
                onClick={() => {
                  setShowBatchPaymentConfirmation(false)
                  setShowBatchPaymentConfirm(true)
                }}
                className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
              >
                No
              </button>
              <button
                onClick={async () => {
                  // Process batch payment sequentially
                  const playerIds = Array.from(selectedPlayersForBatch)
                  for (const playerId of playerIds) {
                    const summary = buildPaymentSummary(playerId)
                    const sessionsToRemoveFrom = summary.rows.map((row) => row.sessionId)
                    if (onFinishPlayer) {
                      await onFinishPlayer(playerId, { isExempted: false, sessionsToRemoveFrom })
                    }
                    setFinishedPlayers((prev) => new Set([...prev, normalizeId(playerId)]))
                  }
                  setShowBatchPaymentConfirmation(false)
                  setSelectedPlayersForBatch(new Set())
                  setShowBatchReceipt(true)
                }}
                className="flex-1 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatchReceipt && batchPaymentData && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="border-b border-white/10 px-5 py-4 text-center">
              <h3 className="text-lg font-semibold text-white">Batch Payment Receipt</h3>
              <p className="mt-1 text-xs text-slate-300">Transaction successful</p>
            </div>

            <div className="space-y-4 px-5 py-6">
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="mb-3">
                  <p className="mb-2 text-xs text-slate-400">Players Finished</p>
                  {batchPaymentData.playerDetails.map((detail) => (
                    <div key={detail.playerId} className="mb-2 flex justify-between text-xs text-slate-300">
                      <span>{detail.playerName}</span>
                      <span>
                        {detail.games} games
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between border-t border-white/10 pt-3">
                  <span className="text-sm font-semibold text-white">Total Games:</span>
                  <span className="text-sm font-semibold text-white">{batchPaymentData.totalGames}</span>
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="text-sm font-semibold text-white">Total Amount Collected:</span>
                  <span className="text-lg font-bold text-emerald-300">₱{batchPaymentData.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              <p className="text-center text-xs text-slate-400">Payments have been recorded</p>
            </div>

            <div className="border-t border-white/10 px-5 py-4">
              <button
                onClick={() => {
                  setShowBatchReceipt(false)
                  setBatchPaymentData(null)
                }}
                className="w-full rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PaymentsPage
