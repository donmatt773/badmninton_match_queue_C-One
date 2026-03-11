import React, { useState, useEffect } from 'react'
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";

const PLAYERS_PER_PAGE = 20;

// Draggable Player Card Component
const DraggablePlayer = ({ player, isInUse, isAssignedToTeam }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: player._id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  // Get color based on skill level
  const getSkillColor = () => {
    if (isAssignedToTeam) return "border-emerald-500/30 bg-emerald-500/10";
    if (isInUse) return "border-amber-500/30 bg-amber-500/10";
    
    switch (player.playerLevel) {
      case "BEGINNER":
        return "border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20";
      case "INTERMEDIATE":
        return "border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20";
      case "UPPERINTERMEDIATE":
        return "border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20";
      case "ADVANCED":
        return "border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20";
      default:
        return "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20";
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing select-none rounded border px-1 py-0.5 text-center transition ${getSkillColor()}`}
    >
      <p className="truncate text-xs font-semibold text-white leading-tight">{player.name}</p>
      <p className="text-[8px] text-slate-400 leading-tight">{player.playerLevel}</p>
      <p className="text-[7px] text-slate-500 leading-tight">{player.gender}</p>
      {isAssignedToTeam && <p className="mt-0.5 text-[8px] text-emerald-400 leading-tight">● In Team</p>}
      {isInUse && !isAssignedToTeam && <p className="mt-0.5 text-[8px] text-amber-400 leading-tight">● In Match/Queue</p>}
    </div>
  );
};

// Droppable Team Zone Component
const DroppableTeam = ({ teamNumber, children }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `team${teamNumber}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded border p-3 transition min-h-20 ${
        teamNumber === 1
          ? `border-blue-300/30 bg-blue-500/10 ${isOver ? "bg-blue-500/20 border-blue-300/50" : ""}`
          : `border-rose-300/30 bg-rose-500/10 ${isOver ? "bg-rose-500/20 border-rose-300/50" : ""}`
      }`}
    >
      {children}
    </div>
  );
};

const EditMatchForm = ({ 
  match,
  courts,
  sessions = [],
  players,
  isOpen, 
  onClose, 
  onSubmit, 
  isLoading,
  ongoingMatches = {},
  matchQueue = {}
}) => {
  const [team1, setTeam1] = useState([])
  const [team2, setTeam2] = useState([])
  const [courtId, setCourtId] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [activeDragId, setActiveDragId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterBySkill, setFilterBySkill] = useState('all')
  const [sortBySkill, setSortBySkill] = useState('none')
  const [showAvailableOnly, setShowAvailableOnly] = useState(false)
  const [currentPlayerPage, setCurrentPlayerPage] = useState(0)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      distance: 8,
    })
  );

  useEffect(() => {
    if (match && isOpen) {
      const playerIds = match.playerIds || []
      setCourtId(match.courtId || '')
      
      // Distribute existing players across teams
      if (playerIds.length === 2) {
        setTeam1([playerIds[0]])
        setTeam2([playerIds[1]])
      } else if (playerIds.length === 4) {
        setTeam1([playerIds[0], playerIds[1]])
        setTeam2([playerIds[2], playerIds[3]])
      } else {
        setTeam1([])
        setTeam2([])
      }
      setShowConfirm(false)
      setSearchTerm('')
      setActiveDragId(null)
      setFilterBySkill('all')
      setSortBySkill('none')
      setShowAvailableOnly(false)
      setCurrentPlayerPage(0)
    }
  }, [match, isOpen])

  useEffect(() => {
    setCurrentPlayerPage(0)
  }, [searchTerm, filterBySkill, sortBySkill, showAvailableOnly])

  if (!isOpen) return null

  // Drag and drop handlers
  const handleDragStart = (event) => {
    setActiveDragId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;

    const playerId = active.id;
    const dropZone = over.id;

    if (dropZone === "team1" && team1.length < 2 && !team1.includes(playerId)) {
      setTeam1([...team1, playerId]);
    } else if (dropZone === "team2" && team2.length < 2 && !team2.includes(playerId)) {
      setTeam2([...team2, playerId]);
    }
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
  };

  const handleRemoveFromTeam = (playerId, teamNumber) => {
    if (teamNumber === 1) {
      setTeam1(team1.filter((id) => id !== playerId));
    } else {
      setTeam2(team2.filter((id) => id !== playerId));
    }
  };

  const isValidTeamConfiguration = () => {
    return (
      (team1.length === 1 && team2.length === 1) || 
      (team1.length === 2 && team2.length === 2)
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!courtId) {
      alert('Please select a court')
      return
    }
    if (!isValidTeamConfiguration()) {
      alert('Teams must be balanced: 1v1 (1 player per team) or 2v2 (2 players per team)')
      return
    }
    setShowConfirm(true)
  }

  const handleConfirmSubmit = () => {
    const playerIds = [...team1, ...team2]
    onSubmit({
      courtId,
      playerIds
    })
    setShowConfirm(false)
  }

  const getPlayerName = (playerId) => {
    return playersInSession.find(p => p._id === playerId)?.name
      || players?.find(p => p._id === playerId)?.name
      || 'Unknown'
  }

  const getPlayerLevel = (playerId) => {
    return playersInSession.find(p => p._id === playerId)?.playerLevel
      || players?.find(p => p._id === playerId)?.playerLevel
      || 'N/A'
  }

  const getCourtName = (courtId) => {
    return courts?.find(c => c._id === courtId)?.name || 'Unknown'
  }

  const getFormat = () => {
    const total = team1.length + team2.length
    return total === 2 ? '1v1 (Singles)' : '2v2 (Doubles)'
  }

  const selectedPlayers = [...team1, ...team2]

  const selectedSession = sessions.find((session) => session._id === match?.sessionId)
  const courtsInSession = selectedSession?.courts
    ? courts.filter((court) => selectedSession.courts.includes(court._id))
    : []
  const playersInSession = selectedSession?.players
    ? selectedSession.players
        .map((sessionPlayer) => players?.find((player) => player._id === sessionPlayer.playerId))
        .filter(Boolean)
    : []
  
  // Get players in ongoing matches and queue
  const allMatches = Object.values(ongoingMatches).flat().concat(Object.values(matchQueue).flat())
  const playersInUseSet = new Set(allMatches.flatMap((match) => match.playerIds || []))
  
  let unselectedPlayers = playersInSession.filter((p) => !selectedPlayers.includes(p._id))

  // Filter by search term
  if (searchTerm.trim()) {
    unselectedPlayers = unselectedPlayers.filter((p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }

  // Filter by skill level
  if (filterBySkill !== 'all') {
    unselectedPlayers = unselectedPlayers.filter((p) =>
      p.playerLevel === filterBySkill
    )
  }

  // Filter available only (exclude players in use)
  if (showAvailableOnly) {
    unselectedPlayers = unselectedPlayers.filter((p) =>
      !playersInUseSet.has(p._id)
    )
  }

  // Sort by skill level
  const skillOrder = { BEGINNER: 0, INTERMEDIATE: 1, UPPERINTERMEDIATE: 2, ADVANCED: 3 }

  // Default sort by name (A-Z)
  unselectedPlayers = [...unselectedPlayers].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
  )

  if (sortBySkill === 'asc') {
    unselectedPlayers = [...unselectedPlayers].sort((a, b) => 
      (skillOrder[a.playerLevel] || 0) - (skillOrder[b.playerLevel] || 0) ||
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    )
  } else if (sortBySkill === 'desc') {
    unselectedPlayers = [...unselectedPlayers].sort((a, b) => 
      (skillOrder[b.playerLevel] || 0) - (skillOrder[a.playerLevel] || 0) ||
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    )
  }

  const totalPlayerPages = Math.max(1, Math.ceil(unselectedPlayers.length / PLAYERS_PER_PAGE))
  const clampedPlayerPage = Math.min(currentPlayerPage, totalPlayerPages - 1)
  const startPlayerIndex = Math.max(0, clampedPlayerPage) * PLAYERS_PER_PAGE
  const endPlayerIndex = startPlayerIndex + PLAYERS_PER_PAGE
  const pagedPlayers = unselectedPlayers.slice(startPlayerIndex, endPlayerIndex)

  // Get the active dragged player
  const activeDragPlayer = activeDragId
    ? playersInSession.find((p) => p._id === activeDragId) || players?.find((p) => p._id === activeDragId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="relative max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 text-slate-400 hover:text-white"
            type="button"
          >
            ✕
          </button>

          <h2 className="mb-2 text-base font-semibold text-white sm:text-lg">Edit Match</h2>

          {showConfirm ? (
            <div className="space-y-3">
              <div className="rounded border border-blue-300/30 bg-blue-500/10 p-2.5">
                <h3 className="mb-1 text-sm font-semibold text-blue-200">
                  ✓ Update Match
                </h3>
                <p className="text-xs text-slate-300">
                  {match?.queued 
                    ? "This queued match will be updated with the new court and player selections."
                    : "This ongoing match will be updated with the new court and player selections."}
                </p>
              </div>

              <div className="rounded border border-white/10 bg-white/5 p-2.5">
                <h4 className="mb-1.5 text-xs font-semibold text-white">Match Details</h4>
                <div className="space-y-1.5 text-xs text-slate-300">
                  <div>
                    <strong>Court:</strong> {getCourtName(courtId)}
                  </div>
                  <div>
                    <strong>Format:</strong> {getFormat()}
                  </div>
                  <div>
                    <strong>Team 1:</strong> {team1.map(getPlayerName).join(", ") || "No players"}
                  </div>
                  <div>
                    <strong>Team 2:</strong> {team2.map(getPlayerName).join(", ") || "No players"}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSubmit}
                  disabled={isLoading}
                  className="flex-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
                >
                  {isLoading ? "Updating..." : "Confirm"}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Match Type Display */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-white">
                  Match Type
                </label>
                <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1">
                  <p className="text-xs font-semibold text-emerald-200">
                    {getFormat()}
                  </p>
                </div>
              </div>

              {/* Court and Filter Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Court Selection */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-white">
                    Select Court
                  </label>
                  <select
                    value={courtId}
                    onChange={(e) => setCourtId(e.target.value)}
                    className="w-full rounded border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white focus:border-white/30 focus:outline-none"
                  >
                    <option value="">Choose a court...</option>
                    {[...courtsInSession].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map((court) => (
                      <option key={court._id} value={court._id}>
                        {court.name} ({court.indoor ? "Indoor" : "Outdoor"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter and Sort */}
                <div className="rounded border border-white/10 bg-white/5 p-2.5">
                  <label className="mb-1.5 block text-xs font-semibold text-white">
                    Filter & Sort
                  </label>
                  <div className="flex gap-1.5">
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
                      />
                    </div>
                    <select
                      value={filterBySkill}
                      onChange={(e) => setFilterBySkill(e.target.value)}
                      className="rounded border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white focus:border-white/30 focus:outline-none"
                    >
                      <option value="all">All Levels</option>
                      <option value="BEGINNER">Beginner</option>
                      <option value="INTERMEDIATE">Intermediate</option>
                      <option value="UPPERINTERMEDIATE">Upper Int</option>
                      <option value="ADVANCED">Advanced</option>
                    </select>
                  </div>
                  <label className="mt-1.5 flex items-center gap-2 text-[9px] text-slate-300" title="Excludes players in ongoing matches and queue">
                    <input
                      type="checkbox"
                      checked={showAvailableOnly}
                      onChange={(e) => setShowAvailableOnly(e.target.checked)}
                      className="h-3 w-3 rounded border-white/20 bg-white/10"
                    />
                    Available only
                  </label>
                </div>
              </div>

              {/* Player Grid */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-semibold text-white">
                      Drag to Teams
                    </label>
                    <div className="flex items-center gap-2 text-[9px] text-slate-400">
                      <button
                        type="button"
                        onClick={() => setFilterBySkill(filterBySkill === 'BEGINNER' ? 'all' : 'BEGINNER')}
                        className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition ${
                          filterBySkill === 'BEGINNER'
                            ? 'border border-blue-500/50 bg-blue-500/30'
                            : 'hover:bg-blue-500/10'
                        }`}
                      >
                        <div className="h-2 w-2 rounded border border-blue-500/50 bg-blue-500/20"></div>
                        <span>Beginner</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterBySkill(filterBySkill === 'INTERMEDIATE' ? 'all' : 'INTERMEDIATE')}
                        className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition ${
                          filterBySkill === 'INTERMEDIATE'
                            ? 'border border-yellow-500/50 bg-yellow-500/30'
                            : 'hover:bg-yellow-500/10'
                        }`}
                      >
                        <div className="h-2 w-2 rounded border border-yellow-500/50 bg-yellow-500/20"></div>
                        <span>Intermediate</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterBySkill(filterBySkill === 'UPPERINTERMEDIATE' ? 'all' : 'UPPERINTERMEDIATE')}
                        className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition ${
                          filterBySkill === 'UPPERINTERMEDIATE'
                            ? 'border border-violet-500/50 bg-violet-500/30'
                            : 'hover:bg-violet-500/10'
                        }`}
                      >
                        <div className="h-2 w-2 rounded border border-violet-500/50 bg-violet-500/20"></div>
                        <span>Upper Int</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterBySkill(filterBySkill === 'ADVANCED' ? 'all' : 'ADVANCED')}
                        className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition ${
                          filterBySkill === 'ADVANCED'
                            ? 'border border-rose-500/50 bg-rose-500/30'
                            : 'hover:bg-rose-500/10'
                        }`}
                      >
                        <div className="h-2 w-2 rounded border border-rose-500/50 bg-rose-500/20"></div>
                        <span>Advanced</span>
                      </button>
                    </div>
                  </div>
                  {totalPlayerPages > 1 && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <button
                        type="button"
                        onClick={() => setCurrentPlayerPage(Math.max(0, currentPlayerPage - 1))}
                        disabled={currentPlayerPage === 0}
                        className="rounded bg-white/10 px-2 py-1 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10"
                      >
                        Previous
                      </button>
                      <span>
                        Page {currentPlayerPage + 1} / {totalPlayerPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentPlayerPage(Math.min(totalPlayerPages - 1, currentPlayerPage + 1))}
                        disabled={currentPlayerPage >= totalPlayerPages - 1}
                        className="rounded bg-white/10 px-2 py-1 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
                <div className="mb-3 grid grid-cols-3 gap-1.5 md:grid-cols-5">
                  {pagedPlayers.length === 0 ? (
                    <div className="col-span-3 rounded border border-white/10 bg-white/5 py-3 text-center text-xs text-slate-400 md:col-span-5">
                      No available players
                    </div>
                  ) : (
                    pagedPlayers.map((player) => (
                      <DraggablePlayer
                        key={player._id}
                        player={player}
                        isInUse={playersInUseSet.has(player._id)}
                        isAssignedToTeam={false}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Team Selection Grid */}
              <div className="grid grid-cols-2 gap-3">
                <DroppableTeam teamNumber={1}>
                  <h3 className="mb-2 text-xs font-semibold text-blue-200">
                    Team 1{" "}
                    {team1.length > 0 && (
                      <span className="ml-2 text-xs text-blue-300">
                        ({team1.length})
                      </span>
                    )}
                  </h3>
                  <div className="min-h-20">
                    {team1.length > 0 ? (
                      <div className="space-y-1.5">
                        {team1.map((playerId) => (
                          <div
                            key={playerId}
                            className="flex items-center justify-between rounded border border-blue-300/30 bg-blue-500/10 px-1.5 py-0.5"
                          >
                            <div className="text-[11px] text-white">
                              <div className="font-semibold leading-tight">{getPlayerName(playerId)}</div>
                              <div className="text-[8px] text-blue-300 leading-tight">
                                {getPlayerLevel(playerId)}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveFromTeam(playerId, 1)}
                              className="text-[9px] text-blue-300 hover:text-blue-200 ml-1"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-20 items-center justify-center rounded border-2 border-dashed border-blue-300/30 bg-blue-500/5">
                        <p className="text-[11px] text-slate-400">Drop players here</p>
                      </div>
                    )}
                  </div>
                </DroppableTeam>

                <DroppableTeam teamNumber={2}>
                  <h3 className="mb-2 text-xs font-semibold text-rose-200">
                    Team 2{" "}
                    {team2.length > 0 && (
                      <span className="ml-2 text-xs text-rose-300">
                        ({team2.length})
                      </span>
                    )}
                  </h3>
                  <div className="min-h-20">
                    {team2.length > 0 ? (
                      <div className="space-y-1.5">
                        {team2.map((playerId) => (
                          <div
                            key={playerId}
                            className="flex items-center justify-between rounded border border-rose-300/30 bg-rose-500/10 px-1.5 py-0.5"
                          >
                            <div className="text-[11px] text-white">
                              <div className="font-semibold leading-tight">{getPlayerName(playerId)}</div>
                              <div className="text-[8px] text-rose-300 leading-tight">
                                {getPlayerLevel(playerId)}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveFromTeam(playerId, 2)}
                              className="text-[9px] text-rose-300 hover:text-rose-200 ml-1"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-20 items-center justify-center rounded border-2 border-dashed border-rose-300/30 bg-rose-500/5">
                        <p className="text-[11px] text-slate-400">Drop players here</p>
                      </div>
                    )}
                  </div>
                </DroppableTeam>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-white/20 px-3 py-1.5 text-sm font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !courtId || !isValidTeamConfiguration()}
                  className="flex-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
                >
                  {isLoading ? 'Updating...' : 'Continue'}
                </button>
              </div>
            </form>
          )}

          <DragOverlay>
            {activeDragPlayer ? (
              <DraggablePlayer
                player={activeDragPlayer}
                isInUse={false}
                isAssignedToTeam={selectedPlayers.includes(activeDragPlayer._id)}
              />
            ) : null}
          </DragOverlay>
        </div>
      </div>
    </DndContext>  )
}

export default EditMatchForm