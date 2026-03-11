import Player from "../models/Player.model.js"
import { pubsub } from "../configs/pubsub.js"

import {GraphQLError} from "graphql"
import { Types } from "mongoose"
import { PlayerZod } from "../validators/player.validator.js"
const SUB_TRIGGER = "PLAYER_UPDATED_TRIGGER"

const playerResolver = {
  Player: {
    playCount: (player) => player.playCount ?? 0,
    winCount: (player) => player.winCount ?? 0,
    lossCount: (player) => player.lossCount ?? 0,
    winRate: (player) => {
      const wins = player.winCount ?? 0
      const losses = player.lossCount ?? 0
      const totalRatedGames = wins + losses

      if (totalRatedGames === 0) {
        return 0
      }

      return Number(((wins / totalRatedGames) * 100).toFixed(2))
    },
  },

  Query: {
    players: async () => await Player.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 }),
    player: async (_, { id }) => {
		console.log(id)
      return await Player.findById(id.toString())
    },
    playersPaginated: async (_, { limit, offset, search, skillLevel, sortBy = 'createdAt', sortOrder = 'desc' }) => {
      const safeLimit = Math.min(Math.max(limit, 1), 1000)
      const safeOffset = Math.max(offset, 0)

      // Build filter object
      const filter = { isDeleted: { $ne: true } }

      if (search) {
        filter.name = { $regex: search, $options: 'i' } // Case-insensitive search
      }

      if (skillLevel) {
        filter.playerLevel = skillLevel
      }

      const sortDirection = sortOrder === 'asc' ? 1 : -1

      // Win rate is computed from wins/losses, so it must be sorted via aggregation.
      if (sortBy === 'winRate') {
        const players = await Player.aggregate([
          { $match: filter },
          {
            $addFields: {
              computedWinRate: {
                $cond: [
                  { $eq: [{ $add: ['$winCount', '$lossCount'] }, 0] },
                  0,
                  {
                    $multiply: [
                      {
                        $divide: [
                          '$winCount',
                          { $add: ['$winCount', '$lossCount'] },
                        ],
                      },
                      100,
                    ],
                  },
                ],
              },
            },
          },
          {
            $sort: {
              computedWinRate: sortDirection,
              winCount: sortDirection,
              playCount: sortDirection,
              createdAt: -1,
            },
          },
          { $skip: safeOffset },
          { $limit: safeLimit },
          { $project: { computedWinRate: 0 } },
        ])

        const total = await Player.countDocuments(filter)

        return {
          players,
          total,
        }
      }

      // Build sort object for direct model fields
      const sortObj = {}
      const validSortFields = ['name', 'createdAt', 'playCount', 'winCount', 'lossCount', 'playerLevel']
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt'
      sortObj[sortField] = sortDirection

      const players = await Player.find(filter).sort(sortObj).limit(safeLimit).skip(safeOffset)
      const total = await Player.countDocuments(filter)

      return {
        players,
        total,
      }
    },
    playersCount: async (_, { search, skillLevel }) => {
      const filter = { isDeleted: { $ne: true } }
      
      if (search) {
        filter.name = { $regex: search, $options: 'i' }
      }
      
      if (skillLevel) {
        filter.playerLevel = skillLevel
      }
      
      return await Player.countDocuments(filter)
    },
    deletedPlayers: async () => await Player.find({ isDeleted: true }).sort({ deletedAt: -1 }),
    leaderboard: async (_, { limit = 10 }) => {
      const safeLimit = Math.min(Math.max(limit, 1), 100)

      return await Player.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        {
          $addFields: {
            computedWinRate: {
              $cond: [
                { $eq: [{ $add: ['$winCount', '$lossCount'] }, 0] },
                0,
                {
                  $multiply: [
                    {
                      $divide: [
                        '$winCount',
                        { $add: ['$winCount', '$lossCount'] },
                      ],
                    },
                    100,
                  ],
                },
              ],
            },
          },
        },
        {
          $sort: {
            computedWinRate: -1,
            winCount: -1,
            playCount: -1,
            createdAt: 1,
          },
        },
        { $limit: safeLimit },
        { $project: { computedWinRate: 0 } },
      ])
    },
  },

  Mutation: {

    createPlayer: async (_, { input }) => {
      try {
        const result = await PlayerZod.parseAsync(input)
        const player = await Player.create({
          name: result.name,
          gender: result.gender ?? null,
          playerLevel: result.playerLevel ?? null,
        })

        pubsub.publish(SUB_TRIGGER, {
          playerUpdates: { type: "CREATED", player },
        })

        return { ok: true, message: "Player created successfully", player }
      } catch (error) {
        console.error(error)
        if (Array.isArray(error?.issues)) {
          throw new GraphQLError("Validation failed.", {
            extensions: {
              code: "VALIDATION_ERROR",
              fields: error.issues.map((e) => ({
                path: e.path.join("."),
                message: e.message,
              })),
            },
          })
        }

        if (error?.code === 11000) {
          throw new GraphQLError("An active player with this name already exists.", {
            extensions: {
              code: "VALIDATION_ERROR",
              fields: [
                {
                  path: "name",
                  message: "An active player with this name already exists.",
                },
              ],
            },
          })
        }

        throw new GraphQLError(error?.message || "Failed to create player.", {
          extensions: {
            code: "CREATE_PLAYER_ERROR",
          },
        })
      }
    },

    updatePlayer: async (_, { id, input }) => {
      try {
        const player = await Player.findByIdAndUpdate(
          id,
          {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.gender !== undefined ? { gender: input.gender } : {}),
            ...(input.playerLevel !== undefined
              ? { playerLevel: input.playerLevel }
              : {}),
          },
          { returnDocument: 'after', runValidators: true },
        )

        if (!player) {
          return { ok: false, message: "Player not found", player: null }
        }

        pubsub.publish(SUB_TRIGGER, {
          playerUpdates: { type: "UPDATED", player },
        })

        return { ok: true, message: "Player updated successfully", player }
      } catch (error) {
        if (error?.code === 11000) {
          return {
            ok: false,
            message: "An active player with this name already exists.",
            player: null,
          }
        }
        return { ok: false, message: error.message, player: null }
      }
    },

    deletePlayer: async (_, { id }) => {
      try {
        const player = await Player.findByIdAndUpdate(
          id,
          { isDeleted: true, deletedAt: new Date() },
          { returnDocument: 'after' },
        )

        if (!player) {
          return { ok: false, message: "Player not found", player: null }
        }

        pubsub.publish(SUB_TRIGGER, {
          playerUpdates: { type: "DELETED", player },
        })

        return { ok: true, message: "Player archived successfully", player }
      } catch (error) {
        return { ok: false, message: error.message, player: null }
      }
    },

    restorePlayer: async (_, { id }) => {
      try {
        const player = await Player.findByIdAndUpdate(
          id,
          { isDeleted: false, deletedAt: null },
          { returnDocument: 'after' },
        )

        if (!player) {
          return { ok: false, message: "Player not found", player: null }
        }

        pubsub.publish(SUB_TRIGGER, {
          playerUpdates: { type: "CREATED", player },
        })

        return { ok: true, message: "Player restored successfully", player }
      } catch (error) {
        return { ok: false, message: error.message, player: null }
      }
    },
  },
  Subscription: {
    playerUpdates: {
      subscribe: () => pubsub.asyncIterableIterator(SUB_TRIGGER),
    },
  },
}

export default playerResolver
