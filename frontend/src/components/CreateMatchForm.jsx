import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useSubscription } from "@apollo/client/react";
import { gql } from "@apollo/client";
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";

const COURT_SURFACE_TYPES = {
  'WOODEN': 'Wooden',
  'SYNTHETIC': 'Synthetic',
  'MAT': 'Mat',
  'CONCRETE': 'Concrete',
}

const formatCourtSurfaceType = (value) => COURT_SURFACE_TYPES[value] ?? value

const COURT_STATUS_LABELS = {
  'ACTIVE': 'Available',
  'OCCUPIED': 'InUse',
  'MAINTENANCE': 'Maintenance'
}

const formatCourtStatus = (value) => COURT_STATUS_LABELS[value] ?? value

const COURTS_QUERY = gql`
  query Courts {
    courts {
      _id
      name
      surfaceType
      indoor
      status
    }
  }
`;

const GAMES_BY_SESSION_QUERY = gql`
  query GamesBySession($sessionId: ID!) {
    gamesBySession(sessionId: $sessionId) {
      _id
      players
    }
  }
`;

const GAMES_SUBSCRIPTION = gql`
  subscription GameSub {
    gameSub {
      type
      game {
        _id
        sessionId
        players
      }
    }
  }
`;

const LAST_SESSION_KEY = "lastCreateMatchSessionId";
const PLAYERS_PER_PAGE = 16;

// Draggable Player Card Component
const DraggablePlayer = ({ player, isInUse, isAssignedToTeam, hasPlayedWithSelected }) => {
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
      className={`relative cursor-grab active:cursor-grabbing select-none rounded border px-1 py-0.5 text-center transition ${getSkillColor()}`}
    >
      {hasPlayedWithSelected && (
        <span
          className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500"
          title="Played against this player in this session"
        />
      )}
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
      className={`rounded border p-2 transition ${
        teamNumber === 1
          ? `border-blue-300/30 bg-blue-500/10 ${isOver ? "bg-blue-500/20 border-blue-300/50" : ""}`
          : `border-rose-300/30 bg-rose-500/10 ${isOver ? "bg-rose-500/20 border-rose-300/50" : ""}`
      }`}
    >
      {children}
    </div>
  );
};

// Helper function to get skill level color for team display
const getSkillLevelColor = (skillLevel) => {
  switch (skillLevel) {
    case "BEGINNER":
      return "bg-blue-500/20 border-blue-300/50";
    case "INTERMEDIATE":
      return "bg-yellow-500/20 border-yellow-300/50";
    case "UPPERINTERMEDIATE":
      return "bg-violet-500/20 border-violet-300/50";
    case "ADVANCED":
      return "bg-rose-500/20 border-rose-300/50";
    default:
      return "bg-slate-500/20 border-slate-300/50";
  }
};

const getSkillLevelTextColor = (skillLevel) => {
  switch (skillLevel) {
    case "BEGINNER":
      return "text-blue-300";
    case "INTERMEDIATE":
      return "text-yellow-300";
    case "UPPERINTERMEDIATE":
      return "text-violet-300";
    case "ADVANCED":
      return "text-rose-300";
    default:
      return "text-slate-300";
  }
};

const CreateMatchForm = ({
  sessions,
  players,
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  ongoingMatches,
  matchQueue,
  currentSessionId,
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState(currentSessionId || "");
  const [matchType, setMatchType] = useState("1v1");
  const [selectedCourt, setSelectedCourt] = useState("");
  const [team1, setTeam1] = useState([]);
  const [team2, setTeam2] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingMatchData, setPendingMatchData] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBySkill, setSortBySkill] = useState("none"); // none, asc, desc
  const [filterBySkill, setFilterBySkill] = useState("all"); // all, BEGINNER, INTERMEDIATE, UPPERINTERMEDIATE, ADVANCED
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [openTeam1Dropdown, setOpenTeam1Dropdown] = useState(false);
  const [openTeam2Dropdown, setOpenTeam2Dropdown] = useState(false);
  const [currentPlayerPage, setCurrentPlayerPage] = useState(0);
  const [activeDragId, setActiveDragId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { data: courtsData, loading: courtsLoading } = useQuery(COURTS_QUERY);
  const { data: sessionGamesData } = useQuery(GAMES_BY_SESSION_QUERY, {
    variables: { sessionId: selectedSessionId },
    skip: !selectedSessionId,
    fetchPolicy: "cache-and-network",
  });
  const { data: gameSubData } = useSubscription(GAMES_SUBSCRIPTION, {
    skip: !isOpen,
  });

  const getPreferredSessionId = () => {
    if (currentSessionId && sessions?.some((s) => s._id === currentSessionId && s.status === "OPEN")) {
      return currentSessionId;
    }

    const storedSessionId = localStorage.getItem(LAST_SESSION_KEY);
    if (storedSessionId && sessions?.some((s) => s._id === storedSessionId && s.status === "OPEN")) {
      return storedSessionId;
    }

    return "";
  };

  // Reset form when closed, but remember last used session
  useEffect(() => {
    if (!isOpen) {
      setSelectedSessionId(getPreferredSessionId());
      setMatchType("1v1");
      setSelectedCourt("");
      setTeam1([]);
      setTeam2([]);
      setShowConfirm(false);
      setPendingMatchData(null);
      setSearchTerm("");
      setSortBySkill("none");
      setFilterBySkill("all");
      setShowAvailableOnly(false);
      setOpenTeam1Dropdown(false);
      setOpenTeam2Dropdown(false);
    }
  }, [isOpen, currentSessionId, sessions]);

  // Prefill session from last used selection when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const preferredSessionId = getPreferredSessionId();
    if (preferredSessionId && preferredSessionId !== selectedSessionId) {
      setSelectedSessionId(preferredSessionId);
    }
  }, [isOpen, currentSessionId, sessions, selectedSessionId]);

  // Auto-detect match type based on team configuration
  useEffect(() => {
    if (team1.length === 1 && team2.length === 1) {
      setMatchType("1v1");
    } else if (team1.length === 2 && team2.length === 2) {
      setMatchType("2v2");
    }
  }, [team1, team2]);

  // Reset player page when search/sort/filter changes
  useEffect(() => {
    setCurrentPlayerPage(0);
  }, [searchTerm, sortBySkill, filterBySkill, showAvailableOnly]);

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

  const selectedSession = sessions?.find(s => s._id === selectedSessionId);
  const allCourts = courtsData?.courts || [];
  
  // Filter courts to only show ones in the selected session
  const courts = selectedSessionId && selectedSession
    ? allCourts.filter((court) => selectedSession.courts?.includes(court._id))
    : [];
  
  // Get players for the selected session - map playerIds to full player objects
  const playersInSession = selectedSession?.players
    ? selectedSession.players.map(sp => {
        const fullPlayer = players?.find(p => p._id === sp.playerId);
        return fullPlayer ? { ...fullPlayer, gamesPlayed: sp.gamesPlayed } : null;
      }).filter(Boolean)
    : [];

  // Get unselected players
  const selectedPlayerIds = new Set([...team1, ...team2]);
  let unselectedPlayers = playersInSession.filter(
    (p) => !selectedPlayerIds.has(p._id)
  );

  const sessionOngoingMatches = ongoingMatches?.[selectedSessionId] || [];
  const sessionQueuedMatches = matchQueue?.[selectedSessionId] || [];
  const sessionAllMatches = [...sessionOngoingMatches, ...sessionQueuedMatches];
  const sessionGames = useMemo(() => {
    const baseGames = sessionGamesData?.gamesBySession || [];
    const subGame = gameSubData?.gameSub?.game;

    if (!subGame || String(subGame.sessionId) !== String(selectedSessionId)) {
      return baseGames;
    }

    const exists = baseGames.some((game) => String(game._id) === String(subGame._id));
    return exists ? baseGames : [subGame, ...baseGames];
  }, [sessionGamesData?.gamesBySession, gameSubData?.gameSub?.game, selectedSessionId]);
  const playersInUseSet = new Set(
    sessionAllMatches.flatMap((match) => match.playerIds || [])
  );

  const opponentsByPlayer = useMemo(() => {
    const map = new Map();

    const addOpponentPair = (a, b) => {
      if (!a || !b || a === b) return;
      if (!map.has(a)) map.set(a, new Set());
      map.get(a).add(b);
    };

    console.log('Building opponents map from games:', sessionGames);
    
    for (const game of sessionGames) {
      console.log('Processing game:', game);
      console.log('Game players:', game?.players);
      const ids = Array.isArray(game?.players) ? game.players.map(String) : [];
      console.log('Converted IDs:', ids);
      
      if (ids.length < 2) {
        console.log('Not enough players, skipping game');
        continue;
      }

      const midpoint = Math.floor(ids.length / 2);
      const teamA = ids.slice(0, midpoint);
      const teamB = ids.slice(midpoint);
      console.log('Team A:', teamA, 'Team B:', teamB);

      // Add opponent relationships: Team A vs Team B
      for (const playerA of teamA) {
        for (const playerB of teamB) {
          console.log(`Adding opponent pair: ${playerA} vs ${playerB}`);
          addOpponentPair(playerA, playerB);
          addOpponentPair(playerB, playerA);
        }
      }
    }

    console.log('Final opponents map:', map);
    return map;
  }, [sessionGames]);

  const playedWithSelectedSet = useMemo(() => {
    const selectedIds = [...team1, ...team2].map(String);
    const set = new Set();

    console.log('CreateMatchForm - Selected IDs:', selectedIds);
    console.log('CreateMatchForm - Session Games:', sessionGames);
    console.log('CreateMatchForm - Opponents by Player:', opponentsByPlayer);

    for (const selectedId of selectedIds) {
      const opponents = opponentsByPlayer.get(selectedId);
      console.log(`CreateMatchForm - Opponents for ${selectedId}:`, opponents);
      if (!opponents) continue;
      for (const opponentId of opponents) {
        set.add(opponentId);
      }
    }

    console.log('CreateMatchForm - Played against selected set:', set);
    return set;
  }, [team1, team2, opponentsByPlayer, sessionGames]);

  // Filter by search term
  if (searchTerm.trim()) {
    unselectedPlayers = unselectedPlayers.filter((p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  // Filter by skill level
  if (filterBySkill !== "all") {
    unselectedPlayers = unselectedPlayers.filter((p) =>
      p.playerLevel === filterBySkill
    );
  }

  // Filter by availability
  if (showAvailableOnly) {
    unselectedPlayers = unselectedPlayers.filter((p) =>
      !playersInUseSet.has(p._id)
    );
  }

  // Sort by skill level
  // Sort by skill level
  const skillLevelOrder = {
    'BEGINNER': 1,
    'INTERMEDIATE': 2,
    'UPPERINTERMEDIATE': 3,
    'ADVANCED': 4,
  };

  if (sortBySkill === "asc") {
    unselectedPlayers = [...unselectedPlayers].sort((a, b) => 
      (skillLevelOrder[a.playerLevel] || 0) - (skillLevelOrder[b.playerLevel] || 0)
    );
  } else if (sortBySkill === "desc") {
    unselectedPlayers = [...unselectedPlayers].sort((a, b) => 
      (skillLevelOrder[b.playerLevel] || 0) - (skillLevelOrder[a.playerLevel] || 0)
    );
  }

  // Pagination for players
  const totalPlayerPages = Math.max(1, Math.ceil(unselectedPlayers.length / PLAYERS_PER_PAGE));
  const clampedPlayerPage = Math.min(currentPlayerPage, totalPlayerPages - 1);
  const startPlayerIndex = Math.max(0, clampedPlayerPage) * PLAYERS_PER_PAGE;
  const endPlayerIndex = startPlayerIndex + PLAYERS_PER_PAGE;
  const pagedPlayers = unselectedPlayers.slice(startPlayerIndex, endPlayerIndex);

  // Calculate team skill levels
  const calculateTeamSkillLevel = (teamPlayerIds) => {
    if (teamPlayerIds.length === 0) return 0;
    const total = teamPlayerIds.reduce((sum, playerId) => {
      const player = playersInSession.find(p => p._id === playerId);
      return sum + (skillLevelOrder[player?.playerLevel] || 0);
    }, 0);
    return (total / teamPlayerIds.length).toFixed(1);
  };

  const team1SkillLevel = calculateTeamSkillLevel(team1);
  const team2SkillLevel = calculateTeamSkillLevel(team2);

  const handleAddToTeam = (playerId, team) => {
    if (team === 1) {
      setTeam1([...team1, playerId]);
    } else {
      setTeam2([...team2, playerId]);
    }
  };

  const handleRemoveFromTeam = (playerId, team) => {
    if (team === 1) {
      setTeam1(team1.filter((id) => id !== playerId));
    } else {
      setTeam2(team2.filter((id) => id !== playerId));
    }
  };

  // Allow up to 2 players per team (match type auto-detects at 1v1 or 2v2)
  const isValidMatch = (
    (team1.length === 1 && team2.length === 1) || 
    (team1.length === 2 && team2.length === 2)
  );
  const canSubmit = isValidMatch && selectedCourt && selectedSessionId;

  // Check if court/players are available or queued
  const allPlayers = [...team1, ...team2];
  const courtBusy = sessionAllMatches.some((m) => m.courtId === selectedCourt);
  const playersInUse = sessionAllMatches.some((m) =>
    allPlayers.some((p) => m.playerIds?.includes(p))
  );
  const isQueued = courtBusy || playersInUse;
  
  const getCourtName = () => {
    return allCourts.find((c) => c._id === selectedCourt)?.name || "Unknown";
  };

  const handleSubmitClick = (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    const matchData = {
      sessionId: selectedSessionId,
      courtId: selectedCourt,
      playerIds: allPlayers,
      queued: isQueued,
    };
    setPendingMatchData(matchData);
    setShowConfirm(true);
  };

  const handleConfirmMatch = () => {
    onSubmit(pendingMatchData);
    setShowConfirm(false);
    setPendingMatchData(null);

    // Reset form
    setSelectedSessionId("");
    setMatchType("1v1");
    setSelectedCourt("");
    setTeam1([]);
    setTeam2([]);
  };

  const getPlayerName = (playerId) => {
    return (
      playersInSession.find((p) => p._id === playerId)?.name || "Unknown"
    );
  };

  const getPlayerGender = (playerId) => {
    return (
      playersInSession.find((p) => p._id === playerId)?.gender || "N/A"
    );
  };

  // Get the active dragged player
  const activeDragPlayer = activeDragId ? playersInSession.find(p => p._id === activeDragId) : null;

  // Filter only OPEN sessions
  const openSessions = sessions?.filter(s => s.status === 'OPEN') || [];

  if (!isOpen) return null;

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

        <h2 className="mb-2 text-base font-semibold text-white sm:text-lg">Create Match</h2>

        {showConfirm ? (
          <div className="space-y-3">
            <div className="rounded border border-yellow-300/30 bg-yellow-500/10 p-2.5">
              <h3 className="mb-1 text-sm font-semibold text-yellow-200">
                {isQueued ? "⏳ Match will be Queued" : "✓ Match will start immediately"}
              </h3>
              <p className="text-xs text-slate-300">
                {isQueued
                  ? "The court or players are currently busy. This match will be added to the queue."
                  : "The court and players are available. Match will start immediately."}
              </p>
            </div>

            <div className="rounded border border-white/10 bg-white/5 p-2.5">
              <h4 className="mb-1.5 text-xs font-semibold text-white">Match Details</h4>
              <div className="space-y-1.5 text-xs text-slate-300">
                <div>
                  <strong>Session:</strong> {selectedSession?.name}
                </div>
                <div>
                  <strong>Court:</strong> {getCourtName()}
                </div>
                <div>
                  <strong>Format:</strong> {matchType}
                </div>
                <div>
                  <strong>Team 1:</strong> {team1.map(getPlayerName).join(", ")}
                </div>
                <div>
                  <strong>Team 2:</strong> {team2.map(getPlayerName).join(", ")}
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
                onClick={handleConfirmMatch}
                disabled={isLoading}
                className="flex-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
              >
                {isLoading ? "Creating..." : "Confirm"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitClick} className="space-y-3">
            {/* Session Selection, Match Type, Court Selection - 2x2 Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Session Selection */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-white">
                  Select Session
                </label>
                <select
                  value={selectedSessionId}
                  onChange={(e) => {
                    const nextSessionId = e.target.value;
                    setSelectedSessionId(nextSessionId);
                    if (nextSessionId) {
                      localStorage.setItem(LAST_SESSION_KEY, nextSessionId);
                    } else {
                      localStorage.removeItem(LAST_SESSION_KEY);
                    }
                    setSelectedCourt("");
                    setTeam1([]);
                    setTeam2([]);
                  }}
                  className="w-full rounded border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white focus:border-white/30 focus:outline-none"
                >
                  <option value="">Choose a session...</option>
                  {openSessions.map((session) => (
                    <option key={session._id} value={session._id}>
                      {session.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Match Type Display (Auto-detected) */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-white">
                  Match Type
                </label>
                <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1">
                  <p className="text-xs font-semibold text-emerald-200">
                    {matchType} ({matchType === "1v1" ? "Singles" : "Doubles"})
                  </p>
                  <p className="text-[8px] text-slate-400">
                    Auto-detected
                  </p>
                </div>
              </div>
            </div>

            {selectedSessionId && (
              <>
                {/* Court and Filter Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Court Selection */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-white">
                      Select Court
                    </label>
                    <select
                      value={selectedCourt}
                      onChange={(e) => setSelectedCourt(e.target.value)}
                      className="w-full rounded border border-white/10 bg-slate-800 px-2 py-1 text-xs text-white focus:border-white/30 focus:outline-none"
                    >
                      <option value="">Choose a court...</option>
                      {[...courts].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map((court) => (
                        <option key={court._id} value={court._id}>
                          {court.name} ({formatCourtStatus(court.status)})
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

                {/* Player Grid - 4x4 with Pagination */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-semibold text-white">
                        Drag to Teams
                      </label>
                      <div className="flex items-center gap-2 text-[9px] text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-rose-500" />
                          <span>Played against selected player</span>
                        </span>
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
                    {pagedPlayers.length > 0 ? (
                      pagedPlayers.map((player) => {
                        const hasPlayed = playedWithSelectedSet.has(String(player._id));
                        if (hasPlayed) {
                          console.log(`Player ${player.name} (${player._id}) has played with selected`);
                        }
                        return (
                        <DraggablePlayer
                          key={player._id}
                          player={player}
                          isInUse={playersInUseSet.has(player._id)}
                          isAssignedToTeam={team1.includes(player._id) || team2.includes(player._id)}
                          hasPlayedWithSelected={hasPlayed}
                        />
                        );
                      })
                    ) : (
                      <div className="col-span-3 rounded border border-white/10 bg-white/5 p-2 text-center text-xs text-slate-400 md:col-span-5">
                        No players available
                      </div>
                    )}
                  </div>
                </div>

                {/* Team Selection - Droppable Zones */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Team 1 */}
                  <DroppableTeam teamNumber={1}>
                    <h3 className="mb-2 text-xs font-semibold text-blue-200">
                      Team 1{" "}
                      {team1.length > 0 && team1.length === team2.length && (
                        <span className="text-xs text-blue-300">✓</span>
                      )}
                      {team1.length > 0 && (
                        <span className="ml-2 text-xs text-blue-300">
                          (Skill: {team1SkillLevel})
                        </span>
                      )}
                    </h3>
                    <div className="min-h-20">
                      {team1.length > 0 ? (
                        <div className="space-y-1.5">
                          {team1.map((playerId) => {
                            const player = playersInSession.find(p => p._id === playerId);
                            const hasPlayedWithSelected = playedWithSelectedSet.has(String(playerId));
                            return (
                            <div
                              key={playerId}
                              className={`flex items-center justify-between rounded border px-1.5 py-0.5 ${getSkillLevelColor(player?.playerLevel)} relative`}
                              title={hasPlayedWithSelected ? "Played against another selected player" : ""}
                            >
                              {hasPlayedWithSelected && (
                                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-1 ring-slate-900" />
                              )}
                              <div className="text-[11px] text-white">
                                <div className="font-semibold leading-tight">{getPlayerName(playerId)}</div>
                                <div className={`text-[8px] ${getSkillLevelTextColor(player?.playerLevel)} leading-tight`}>
                                  {player?.playerLevel}
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
                            );
                            })}
                        </div>
                      ) : (
                        <div className="flex h-20 items-center justify-center rounded border-2 border-dashed border-blue-300/30 bg-blue-500/5">
                          <p className="text-[11px] text-slate-400">Drop players here</p>
                        </div>
                      )}
                    </div>
                  </DroppableTeam>

                  {/* Team 2 */}
                  <DroppableTeam teamNumber={2}>
                    <h3 className="mb-2 text-xs font-semibold text-rose-200">
                      Team 2{" "}
                      {team2.length > 0 && team2.length === team1.length && (
                        <span className="text-xs text-rose-300">✓</span>
                      )}
                      {team2.length > 0 && (
                        <span className="ml-2 text-xs text-rose-300">
                          (Skill: {team2SkillLevel})
                        </span>
                      )}
                    </h3>
                    <div className="min-h-20">
                      {team2.length > 0 ? (
                        <div className="space-y-1.5">
                          {team2.map((playerId) => {
                            const player = playersInSession.find(p => p._id === playerId);
                            const hasPlayedWithSelected = playedWithSelectedSet.has(String(playerId));
                            return (
                            <div
                              key={playerId}
                              className={`flex items-center justify-between rounded border px-1.5 py-0.5 ${getSkillLevelColor(player?.playerLevel)} relative`}
                              title={hasPlayedWithSelected ? "Played against another selected player" : ""}
                            >
                              {hasPlayedWithSelected && (
                                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-1 ring-slate-900" />
                              )}
                              <div className="text-[11px] text-white">
                                <div className="font-semibold leading-tight">{getPlayerName(playerId)}</div>
                                <div className={`text-[8px] ${getSkillLevelTextColor(player?.playerLevel)} leading-tight`}>
                                  {player?.playerLevel}
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
                            );
                            })}
                        </div>
                      ) : (
                        <div className="flex h-20 items-center justify-center rounded border-2 border-dashed border-rose-300/30 bg-rose-500/5">
                          <p className="text-[11px] text-slate-400">Drop players here</p>
                        </div>
                      )}
                    </div>
                  </DroppableTeam>
                </div>
              </>
            )}

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
                disabled={!canSubmit}
                className="flex-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
      <DragOverlay>
        {activeDragId && activeDragPlayer ? (
          <div className="cursor-grabbing rounded-lg border border-emerald-500/50 bg-emerald-500/20 p-2 text-center shadow-lg">
            <p className="truncate text-xs font-semibold text-white">{activeDragPlayer.name}</p>
            <p className="text-[10px] text-slate-300">{activeDragPlayer.playerLevel}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default CreateMatchForm;
