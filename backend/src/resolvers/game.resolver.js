import Game from '../models/Game.model.js';
import Player from '../models/Player.model.js';
import Session from '../models/Session.model.js';
import { pubsub } from '../configs/pubsub.js';
import { Types } from 'mongoose';

const toObjectId = (value) => new Types.ObjectId(value.toString());
const SUB_TRIGGER = 'GAME_UPDATED';
const SESSION_SUB_TRIGGER = 'SESSION_UPDATED';

const gameResolver = {
  Query: {
    games: async () => Game.find().sort({ finishedAt: -1 }),
    gamesBySession: async (_, { sessionId }) =>
      Game.find({ sessionId: toObjectId(sessionId) }).sort({ finishedAt: -1 }),
    gamesBySessionIds: async (_, { sessionIds }) =>{
      const sessionObjectIds = sessionIds.map(id => toObjectId(id));
      return Game.find({ sessionId: { $in: sessionObjectIds } }).sort({ finishedAt: -1 });
    },
  },

  Mutation: {
    recordGame: async (_, { input }) => {
      try {
        const playerIds = [...new Set(input.playerIds.map((id) => id.toString()))];
        const winnerIds = [...new Set(input.winnerPlayerIds.map((id) => id.toString()))];
        const playerObjectIds = playerIds.map(toObjectId);
        const winnerObjectIds = winnerIds.map(toObjectId);
        const loserIds = playerIds.filter((id) => !winnerIds.includes(id));
        const loserObjectIds = loserIds.map(toObjectId);
        const sessionObjectId = toObjectId(input.sessionId);
        const courtObjectId = toObjectId(input.courtId);

        if (winnerIds.length === 0) {
          return { ok: false, message: 'winnerPlayerIds must include at least one winner', game: null };
        }

        if (winnerIds.length >= playerIds.length) {
          return {
            ok: false,
            message: 'winnerPlayerIds must not include all players',
            game: null,
          };
        }

        const sessionDoc = await Session.findById(sessionObjectId);

        if (!sessionDoc) {
          return { ok: false, message: 'Session not found', game: null };
        }

        if (sessionDoc.status !== 'OPEN') {
          return { ok: false, message: 'Session must be OPEN to record a game', game: null };
        }

        const sessionPlayerSet = new Set(
          sessionDoc.players.map((sessionPlayer) => sessionPlayer.playerId.toString())
        );

        const allPlayersInSession = playerIds.every((playerId) => sessionPlayerSet.has(playerId));
        if (!allPlayersInSession) {
          return {
            ok: false,
            message: 'All game players must exist in session players',
            game: null,
          };
        }

        const allWinnersInPlayers = winnerIds.every((winnerId) => playerIds.includes(winnerId));
        if (!allWinnersInPlayers) {
          return {
            ok: false,
            message: 'All winners must be part of playerIds',
            game: null,
          };
        }

        const selectedCourtSet = new Set(sessionDoc.courts.map((courtId) => courtId.toString()));
        if (!selectedCourtSet.has(courtObjectId.toString())) {
          return {
            ok: false,
            message: 'Game court must belong to the session courts',
            game: null,
          };
        }

        const gameDoc = await Game.create({
          sessionId: sessionObjectId,
          courtId: courtObjectId,
          players: playerObjectIds,
          winnerPlayerIds: winnerObjectIds,
          finishedAt: input.finishedAt ? new Date(input.finishedAt) : new Date(),
        });

        await Session.updateOne(
          { _id: sessionObjectId },
          {
            $inc: {
              'players.$[sessionPlayer].gamesPlayed': 1,
            },
          },
          {
            arrayFilters: [{ 'sessionPlayer.playerId': { $in: playerObjectIds } }],
          }
        );

        // Fetch updated session and publish event
        const updatedSession = await Session.findById(sessionObjectId);

        await Player.updateMany(
          { _id: { $in: playerObjectIds } },
          { $inc: { playCount: 1 } }
        );

        await Player.updateMany(
          { _id: { $in: winnerObjectIds } },
          { $inc: { winCount: 1 } }
        );

        await Player.updateMany(
          { _id: { $in: loserObjectIds } },
          { $inc: { lossCount: 1 } }
        );

        // Publish GAME event
        pubsub.publish(SUB_TRIGGER, {
          gameSub: { type: 'CREATED', game: gameDoc },
        });

        // Publish SESSION event to notify subscribers of updated gamesPlayed
        pubsub.publish(SESSION_SUB_TRIGGER, {
          sessionSub: { type: 'UPDATED', session: updatedSession },
        });

        return { ok: true, message: 'Game recorded successfully', game: gameDoc };
      } catch (error) {
        return { ok: false, message: error.message, game: null };
      }
    },
  },
  Game: {
    finishedAt: (game) => game.finishedAt ? new Date(game.finishedAt).toISOString() : null,
    createdAt: (game) => game.createdAt ? new Date(game.createdAt).toISOString() : null,
    updatedAt: (game) => game.updatedAt ? new Date(game.updatedAt).toISOString() : null,
  },
  Subscription: {
    gameSub: {
      subscribe: () => pubsub.asyncIterableIterator(SUB_TRIGGER),
    },
  },
};

export default gameResolver;
