import React, { useState, useEffect } from 'react'
import { useQuery, useSubscription } from '@apollo/client/react'
import { gql } from '@apollo/client'
import MassAddPlayersModal from './MassAddPlayersModal'

const COURT_SURFACE_TYPES = {
  'WOODEN': 'Wooden',
  'SYNTHETIC': 'Synthetic',
  'MAT': 'Mat',
  'CONCRETE': 'Concrete',
}

const PLAYER_LEVELS = {
  'BEGINNER': 'Beginner',
  'INTERMEDIATE': 'Intermediate',
  'UPPERINTERMEDIATE': 'Upper Intermediate',
  'ADVANCED': 'Advanced',
}

const formatCourtSurfaceType = (value) => COURT_SURFACE_TYPES[value] ?? value
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

const PLAYER_UPDATES_SUBSCRIPTION = gql`
  subscription PlayerUpdates {
    playerUpdates {
      type
      player {
        _id
        name
        gender
        playerLevel
      }
    }
  }
`

const SessionForm = ({ 
  session, 
  isOpen, 
  onClose, 
  onSubmit, 
  isLoading 
}) => {
  const [currentStep, setCurrentStep] = useState(1)
  const [playerSearchTerm, setPlayerSearchTerm] = useState('')
  const [playerSortBy, setPlayerSortBy] = useState('')
  const [playerPage, setPlayerPage] = useState(1)
  const [isMassAddModalOpen, setIsMassAddModalOpen] = useState(false)
  const [notFoundNames, setNotFoundNames] = useState([])
  const [isNotFoundModalOpen, setIsNotFoundModalOpen] = useState(false)
  const [playersState, setPlayersState] = useState([])
  const PLAYERS_PER_PAGE = 50 // 10x5 grid
  const [formData, setFormData] = useState({
    name: '',
    courts: [],
    players: [],
  })

  const { data: courtsData, loading: courtsLoading } = useQuery(COURTS_QUERY)
  const {
    data: playersData,
    loading: playersLoading,
    refetch: refetchPlayers,
    error: playersError,
  } = useQuery(PLAYERS_QUERY)
  const { data: playerUpdateData } = useSubscription(PLAYER_UPDATES_SUBSCRIPTION)

  // Debug: Log if there's an error fetching players
  useEffect(() => {
    if (playersError) {
      console.error('Players query error:', playersError)
    }
  }, [playersError])

  useEffect(() => {
    console.log('Players query status:', { playersLoading, playersData, playersError })
  }, [playersLoading, playersData, playersError])

  useEffect(() => {
    if (session) {
      // Edit mode
      setFormData({
        name: session.name,
        courts: session.courts || [],
        players: session.players?.map(p => p.playerId) || [],
      })
    } else {
      // Create mode
      setFormData({
        name: '',
        courts: [],
        players: [],
      })
    }
    setCurrentStep(1)
    setPlayerSearchTerm('')
    setPlayerSortBy('')
    setPlayerPage(1)
    setIsMassAddModalOpen(false)
    setNotFoundNames([])
    setIsNotFoundModalOpen(false)
  }, [session, isOpen])

  useEffect(() => {
    console.log('PlayersData received:', playersData)
    if (playersData?.players) {
      console.log('Setting players state:', playersData.players)
      setPlayersState(playersData.players)
    }
  }, [playersData?.players])

  useEffect(() => {
    if (!playerUpdateData?.playerUpdates) return

    const { type, player } = playerUpdateData.playerUpdates
    if (!player?._id) return

    if (type === 'CREATED') {
      setPlayersState((prev) => {
        const exists = prev.some((p) => p._id === player._id)
        return exists ? prev : [...prev, player]
      })
      return
    }

    if (type === 'UPDATED') {
      setPlayersState((prev) => {
        const exists = prev.some((p) => p._id === player._id)
        if (!exists) return [...prev, player]
        return prev.map((p) => (p._id === player._id ? player : p))
      })
      return
    }

    if (type === 'DELETED') {
      setPlayersState((prev) => prev.filter((p) => p._id !== player._id))
    }
  }, [playerUpdateData])

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setPlayerPage(1)
  }, [playerSearchTerm, playerSortBy])

  // Validation functions for each step
  const isStep1Valid = () => formData.name.trim() !== ''
  const isStep2Valid = () => formData.courts.length > 0
  const isStep3Valid = () => formData.players.length > 0

  const isStepValid = (step) => {
    switch (step) {
      case 1: return isStep1Valid()
      case 2: return isStep2Valid()
      case 3: return isStep3Valid()
      default: return false
    }
  }

  const getPlayerCardClasses = (player) => {
    if (formData.players.includes(player._id)) {
      return 'border-emerald-500 bg-emerald-500/20'
    }
    
    switch (player.playerLevel) {
      case 'BEGINNER':
        return 'border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20'
      case 'INTERMEDIATE':
        return 'border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20'
      case 'UPPERINTERMEDIATE':
        return 'border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20'
      case 'ADVANCED':
        return 'border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20'
      default:
        return 'border-white/10'
    }
  }

  const getCourtCardClasses = (court) => {
    if (formData.courts.includes(court._id)) {
      return 'border-emerald-500 bg-emerald-500/20'
    }
    
    return court.indoor 
      ? 'border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20'
      : 'border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20'
  }

  if (!isOpen) return null

  const courts = courtsData?.courts || []
  const players = playersState

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.name.trim() || formData.courts.length === 0 || formData.players.length === 0) {
      alert('Please fill all fields')
      return
    }
    onSubmit(formData)
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

  const handlePlayersMassAdded = async (result) => {
    const matchedPlayerIds = Array.isArray(result?.matchedPlayerIds)
      ? result.matchedPlayerIds.filter(Boolean)
      : []

    if (matchedPlayerIds.length > 0) {
      setFormData((prev) => ({
        ...prev,
        players: [...new Set([...prev.players, ...matchedPlayerIds])],
      }))
    }

    const unmatchedNames = Array.isArray(result?.unmatchedNames)
      ? result.unmatchedNames
      : []

    if (unmatchedNames.length > 0) {
      setNotFoundNames(unmatchedNames)
      setIsNotFoundModalOpen(true)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white"
          type="button"
        >
          ✕
        </button>

        <h2 className="mb-3 text-lg font-semibold text-white sm:text-xl">
          {session ? 'Edit Session' : 'Create Session'}
        </h2>

        {/* Step Indicator */}
        <div className="mb-4 flex items-center gap-2">
          {[1, 2, 3].map((step) => {
            const stepValid = isStepValid(step)
            const isCompleted = step < currentStep
            const isCurrent = step === currentStep
            const showError = !stepValid && !isCurrent && step < currentStep
            
            // Determine line color based on current step's validity
            let lineColor = 'bg-white/10' // default
            if (isCompleted) {
              lineColor = stepValid ? 'bg-emerald-500' : 'bg-red-500'
            }
            
            return (
              <React.Fragment key={step}>
                <button
                  onClick={() => setCurrentStep(step)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold transition ${
                    isCurrent
                      ? 'bg-emerald-500 text-white shadow-lg'
                      : showError
                      ? 'bg-red-500 text-white'
                      : isCompleted && stepValid
                      ? 'bg-emerald-500/50 text-white'
                      : 'border border-white/20 text-slate-400 hover:text-white'
                  }`}
                >
                  {showError ? '✕' : isCompleted && stepValid ? '✓' : step}
                </button>
                {step < 3 && <div className={`flex-1 h-0.5 ${lineColor}`} />}
              </React.Fragment>
            )
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1: Session Name */}
          {currentStep === 1 && (
            <div className="space-y-3">
              <div>
                <h3 className="mb-1.5 text-base font-semibold text-white">Session Details</h3>
                <p className="mb-3 text-xs text-slate-400">Give your session a name</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-white">
                  Session Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter session name"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Step 2: Courts Selection */}
          {currentStep === 2 && (
            <div className="space-y-3">
              <div>
                <h3 className="mb-1.5 text-base font-semibold text-white">Select Courts</h3>
                <p className="mb-2 text-xs text-slate-400">Choose the courts for this session</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="h-2.5 w-2.5 rounded border border-blue-500/30 bg-blue-500/10"></div>
                    <span className="text-slate-400">Indoor</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="h-2.5 w-2.5 rounded border border-yellow-500/30 bg-yellow-500/10"></div>
                    <span className="text-slate-400">Outdoor</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="h-2.5 w-2.5 rounded border border-emerald-500 bg-emerald-500/20"></div>
                    <span className="text-slate-400">Selected</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold text-white">
                  Courts {courtsLoading && <span className="text-xs text-slate-400">(loading...)</span>}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 min-h-32">
                  {courts.length === 0 ? (
                    <p className="text-xs text-slate-400 col-span-full">No courts available</p>
                  ) : (
                    [...courts].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(court => (
                      <label key={court._id} className={`flex flex-col gap-0 rounded-lg px-1.5 py-0.5 cursor-pointer transition border ${getCourtCardClasses(court)}`}>
                        <div className="flex items-center gap-0.5 leading-tight">
                          <input
                            type="checkbox"
                            checked={formData.courts.includes(court._id)}
                            onChange={() => handleCourtToggle(court._id)}
                            className="h-2.5 w-2.5 rounded border-white/20 bg-white/10 cursor-pointer shrink-0"
                          />
                          <div className={`text-sm font-medium truncate leading-tight ${
                            formData.courts.includes(court._id) ? 'text-emerald-200' : 'text-white'
                          }`}>{court.name}</div>
                        </div>
                        <div className={`text-[8px] pl-3 leading-none ${
                          formData.courts.includes(court._id) ? 'text-emerald-300' : 'text-slate-400'
                        }`}>{court.indoor ? 'Indoor' : 'Outdoor'} • {formatCourtSurfaceType(court.surfaceType)}</div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Players Selection */}
          {currentStep === 3 && (
            <div className="space-y-3">
              <div>
                <h3 className="mb-1.5 text-base font-semibold text-white">Select Players</h3>
                <p className="mb-2 text-xs text-slate-400">Choose the players for this session</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="h-2.5 w-2.5 rounded border border-blue-500/30 bg-blue-500/10"></div>
                    <span className="text-slate-400">Beginner</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="h-2.5 w-2.5 rounded border border-yellow-500/30 bg-yellow-500/10"></div>
                    <span className="text-slate-400">Intermediate</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="h-2.5 w-2.5 rounded border border-violet-500/30 bg-violet-500/10"></div>
                    <span className="text-slate-400">Upper Int.</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="h-2.5 w-2.5 rounded border border-rose-500/30 bg-rose-500/10"></div>
                    <span className="text-slate-400">Advanced</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="h-2.5 w-2.5 rounded border border-emerald-500 bg-emerald-500/20"></div>
                    <span className="text-slate-400">Selected</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold text-white">
                  Players {playersLoading && <span className="text-xs text-slate-400">(loading...)</span>}
                </label>
                <div className="mb-2 flex justify-end">
                  <button
                    type="button"
                    onClick={async () => {
                      await refetchPlayers()
                      setIsMassAddModalOpen(true)
                    }}
                    disabled={playersLoading}
                    title={playersLoading ? 'Loading players...' : ''}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      playersLoading
                        ? 'bg-slate-500/20 text-slate-400 cursor-not-allowed opacity-50'
                        : 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                    }`}
                  >
                    {playersLoading ? 'Loading Players...' : 'Batch Add Players'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2.5 mb-2">
                  <input
                    type="text"
                    placeholder="Search by player name..."
                    value={playerSearchTerm}
                    onChange={(e) => setPlayerSearchTerm(e.target.value)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-white/30 focus:outline-none"
                  />
                  <select
                    value={playerSortBy}
                    onChange={(e) => setPlayerSortBy(e.target.value)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:border-white/30 focus:outline-none"
                  >
                    <option value="" className='text-black'>All Skill Levels</option>
                    <option value="ADVANCED" className='text-black'>Advanced</option>
                    <option value="UPPERINTERMEDIATE" className='text-black'>Upper Intermediate</option>
                    <option value="INTERMEDIATE" className='text-black'>Intermediate</option>
                    <option value="BEGINNER" className='text-black'>Beginner</option>
                  </select>
                </div>
                {(() => {
                  // Filter and sort players
                  const filteredPlayers = players
                    .filter(player => player.name.toLowerCase().includes(playerSearchTerm.toLowerCase()))
                    .filter(player => playerSortBy === '' || player.playerLevel === playerSortBy)
                    .sort((a, b) => {
                      // First, prioritize selected players
                      const aSelected = formData.players.includes(a._id)
                      const bSelected = formData.players.includes(b._id)
                      
                      if (aSelected && !bSelected) return -1
                      if (!aSelected && bSelected) return 1
                      
                      // If both selected: sort alphabetically/numerically
                      if (aSelected && bSelected) {
                        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
                      }
                      
                      // Both unselected: sort by skill level then alphabetically/numerically
                      const skillOrder = { 'BEGINNER': 0, 'INTERMEDIATE': 1, 'UPPERINTERMEDIATE': 2, 'ADVANCED': 3 }
                      const aOrder = skillOrder[a.playerLevel] ?? 999
                      const bOrder = skillOrder[b.playerLevel] ?? 999
                      
                      if (aOrder !== bOrder) {
                        return aOrder - bOrder
                      }
                      
                      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
                    })

                  // Calculate pagination
                  const totalPages = Math.ceil(filteredPlayers.length / PLAYERS_PER_PAGE)
                  const startIndex = (playerPage - 1) * PLAYERS_PER_PAGE
                  const endIndex = startIndex + PLAYERS_PER_PAGE
                  const paginatedPlayers = filteredPlayers.slice(startIndex, endIndex)

                  return (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-0.5 min-h-32">
                        {players.length === 0 ? (
                          <p className="text-sm text-slate-400 col-span-full">No players available</p>
                        ) : filteredPlayers.length === 0 ? (
                          <p className="text-sm text-slate-400 col-span-full">No players match your filters</p>
                        ) : (
                          paginatedPlayers.map(player => (
                            <label key={player._id} className={`flex flex-col gap-0 rounded-lg px-1.5 py-0.5 cursor-pointer transition border ${getPlayerCardClasses(player)}`}>
                              <div className="flex items-center gap-0.5 leading-tight">
                                <input
                                  type="checkbox"
                                  checked={formData.players.includes(player._id)}
                                  onChange={() => handlePlayerToggle(player._id)}
                                  className="h-2.5 w-2.5 rounded border-white/20 bg-white/10 cursor-pointer shrink-0"
                                />
                                <div className={`text-sm font-medium truncate leading-tight ${
                                  formData.players.includes(player._id) ? 'text-emerald-200' : 'text-white'
                                }`}>{player.name}</div>
                              </div>
                              <div className={`text-[8px] pl-3 leading-none ${
                                formData.players.includes(player._id) ? 'text-emerald-300' : 'text-slate-400'
                              }`}>{player.gender} • {formatPlayerLevel(player.playerLevel)}</div>
                            </label>
                          ))
                        )}
                      </div>

                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => setPlayerPage(prev => Math.max(prev - 1, 1))}
                            disabled={playerPage === 1}
                            className="rounded-lg bg-slate-700 px-2 py-1 text-[10px] sm:text-xs font-semibold text-white transition hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            ← Prev
                          </button>
                          <div className="flex items-center gap-0.5 text-[10px] sm:text-xs flex-wrap justify-center">
                            {(() => {
                              const maxButtonsToShow = typeof window !== 'undefined' && window.innerWidth < 640 ? 5 : 7
                              let startPage = Math.max(1, playerPage - Math.floor(maxButtonsToShow / 2))
                              let endPage = Math.min(totalPages, startPage + maxButtonsToShow - 1)
                              
                              if (endPage - startPage + 1 < maxButtonsToShow) {
                                startPage = Math.max(1, endPage - maxButtonsToShow + 1)
                              }
                              
                              return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((page) => (
                                <button
                                  key={page}
                                  type="button"
                                  onClick={() => setPlayerPage(page)}
                                  className={`h-5 w-5 sm:h-6 sm:w-6 rounded text-[10px] sm:text-xs font-semibold transition ${
                                    playerPage === page
                                      ? 'bg-emerald-500/20 text-emerald-200'
                                      : 'bg-slate-700 text-white hover:bg-slate-600'
                                  }`}
                                >
                                  {page}
                                </button>
                              ))
                            })()}
                          </div>
                          <button
                            type="button"
                            onClick={() => setPlayerPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={playerPage === totalPages}
                            className="rounded-lg bg-slate-700 px-2 py-1 text-[10px] sm:text-xs font-semibold text-white transition hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            Next →
                          </button>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex gap-2 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="flex-1 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
              >
                Back
              </button>
            )}
            {currentStep < 3 && (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 1 && !formData.name.trim()) {
                    alert('Please enter a session name')
                    return
                  }
                  if (currentStep === 2 && formData.courts.length === 0) {
                    alert('Please select at least one court')
                    return
                  }
                  setCurrentStep(currentStep + 1)
                }}
                className="flex-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
              >
                Next
              </button>
            )}
            {currentStep === 3 && (
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : session ? 'Update' : 'Create'}
              </button>
            )}
          </div>
        </form>

        <MassAddPlayersModal
          isOpen={isMassAddModalOpen}
          onClose={() => setIsMassAddModalOpen(false)}
          onSuccess={handlePlayersMassAdded}
          matchExistingOnly
          existingPlayers={players}
        />

        {isNotFoundModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
            <div className="relative w-full max-w-md rounded-2xl border border-yellow-500/30 bg-slate-900 p-5 shadow-2xl">
              <button
                onClick={() => {
                  setIsNotFoundModalOpen(false)
                  setNotFoundNames([])
                }}
                className="absolute right-3 top-3 text-slate-400 hover:text-white transition"
                type="button"
              >
                ✕
              </button>
              <h3 className="mb-2 text-base font-semibold text-yellow-300">Names Not Found</h3>
              <p className="mb-3 text-xs text-slate-300">
                These names were not matched to existing players and were not added to the session:
              </p>
              <div className="mb-4 max-h-44 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-2">
                <ul className="space-y-1 text-xs text-slate-200">
                  {notFoundNames.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsNotFoundModalOpen(false)
                  setNotFoundNames([])
                }}
                className="w-full rounded-lg bg-yellow-500/20 px-3 py-1.5 text-xs font-semibold text-yellow-200 transition hover:bg-yellow-500/30"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SessionForm
