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
    players: async () => await Player.find().sort({ createdAt: -1 }),
    player: async (_, { id }) => {
		console.log(id)
      return await Player.findById(id.toString())
    },
    playersPaginated: async (_, { limit, offset, search, skillLevel, sortBy = 'createdAt', sortOrder = 'desc' }) => {
      const safeLimit = Math.min(Math.max(limit, 1), 1000)
      const safeOffset = Math.max(offset, 0)
      
      // Build filter object
      const filter = {}
      
      if (search) {
        filter.name = { $regex: search, $options: 'i' } // Case-insensitive search
      }
      
      if (skillLevel) {
        filter.playerLevel = skillLevel
      }
      
      // Build sort object
      const sortObj = {}
      const validSortFields = ['name', 'createdAt', 'playCount', 'winCount', 'lossCount', 'playerLevel']
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt'
      const sortDirection = sortOrder === 'asc' ? 1 : -1
      sortObj[sortField] = sortDirection
      
      const players = await Player.find(filter).sort(sortObj).limit(safeLimit).skip(safeOffset)
      const total = await Player.countDocuments(filter)
      
      return {
        players,
        total,
      }
    },
    playersCount: async (_, { search, skillLevel }) => {
      const filter = {}
      
      if (search) {
        filter.name = { $regex: search, $options: 'i' }
      }
      
      if (skillLevel) {
        filter.playerLevel = skillLevel
      }
      
      return await Player.countDocuments(filter)
    },
    leaderboard: async (_, { limit = 10 }) => {
      const safeLimit = Math.min(Math.max(limit, 1), 100)

      return await Player.aggregate([
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
        throw new GraphQLError("Player Name already exists.", {
          extensions: {
            code: "VALIDATION_ERROR",
            fields: error.issues.map((e) => ({
              path: e.path.join("."),
              message: e.message,
            })),
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
        return { ok: false, message: error.message, player: null }
      }
    },

    deletePlayer: async (_, { id }) => {
      try {
        const player = await Player.findByIdAndDelete(id)

        if (!player) {
          return { ok: false, message: "Player not found", player: null }
        }

        pubsub.publish(SUB_TRIGGER, {
          playerUpdates: { type: "DELETED", player },
        })

        return { ok: true, message: "Player deleted successfully", player }
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
