import Court from '../models/Court.model.js';
import OngoingMatch from '../models/OngoingMatch.model.js';
import Payment from '../models/Payment.model.js';
import Player from '../models/Player.model.js';
import Session from '../models/Session.model.js';
import Settings from '../models/Settings.model.js';
import { pubsub } from '../configs/pubsub.js';

import { Types } from 'mongoose';

const toObjectId = (value) => new Types.ObjectId(value.toString());
const SESSION_SUB_TRIGGER = 'SESSION_UPDATED';
const PAYMENT_SUB_TRIGGER = 'PAYMENT_UPDATED';

const hasQueuedSessionUsingAnyCourt = async (sessionDoc) => {
  const query = {
    _id: { $ne: sessionDoc._id },
    status: 'QUEUED',
    courts: { $in: sessionDoc.courts },
  };

  return Session.exists(query);
};

const hasAnyMatchInSession = async (sessionId) => {
  return OngoingMatch.exists({ sessionId });
};

const closeSessionWithSnapshot = async (sessionId) => {
  try {
    const sessionDoc = await Session.findById(sessionId);

    if (!sessionDoc) {
      return { ok: false, message: 'Session not found', session: null };
    }

    if (sessionDoc.status !== 'OPEN' && sessionDoc.status !== 'CLOSED') {
      return {
        ok: false,
        message: 'Only open or closed sessions can be closed',
        session: null,
      };
    }

    const blockingQueuedSession = await hasQueuedSessionUsingAnyCourt(sessionDoc);
    if (blockingQueuedSession) {
      return {
        ok: false,
        message: 'Cannot close session while a queued session uses the same court(s)',
        session: null,
      };
    }

    const hasMatches = await hasAnyMatchInSession(sessionDoc._id);
    if (hasMatches) {
      return {
        ok: false,
        message: 'Cannot end session while matches are ongoing or queued',
        session: null,
      };
    }

    if (sessionDoc.status === 'CLOSED') {
      return { ok: true, message: 'Session already closed', session: sessionDoc };
    }

    const existingPayment = await Payment.findOne({ sessionId: sessionDoc._id });
    if (existingPayment) {
      sessionDoc.status = 'CLOSED';
      sessionDoc.endedAt = sessionDoc.endedAt ?? new Date();
      await sessionDoc.save();
      return { ok: true, message: 'Session closed successfully', session: sessionDoc };
    }

    let settings = await Settings.findOne({ scope: 'GLOBAL' });
    if (!settings) {
      settings = await Settings.create({ scope: 'GLOBAL', pricePerGame: 0 });
    }

    const pricePerGame = settings.pricePerGame;
    const playersBreakdown = sessionDoc.players.map((item) => ({
      playerId: item.playerId,
      gamesPlayed: item.gamesPlayed,
      total: item.gamesPlayed * pricePerGame,
    }));

    const totalRevenue = playersBreakdown.reduce((sum, item) => sum + item.total, 0);

    const paymentDoc = await Payment.create({
      sessionId: sessionDoc._id,
      pricePerGame,
      players: playersBreakdown,
      totalRevenue,
      closedAt: new Date(),
    });

    sessionDoc.status = 'CLOSED';
    sessionDoc.endedAt = new Date();
    await sessionDoc.save();

    pubsub.publish(SESSION_SUB_TRIGGER, {
      sessionSub: { type: 'CLOSED', session: sessionDoc },
    });

    if (paymentDoc) {
      pubsub.publish(PAYMENT_SUB_TRIGGER, {
        paymentSub: { type: 'CREATED', payment: paymentDoc },
      });
    }

    return { ok: true, message: 'Session closed successfully', session: sessionDoc };
  } catch (error) {
    return { ok: false, message: error.message, session: null };
  }
};

const sessionResolver = {
  Query: {
    sessions: async () => Session.find({ isArchived: false }).sort({ createdAt: -1 }),
    closedSessions: async () => Session.find({ status: 'CLOSED', isArchived: false }).sort({ createdAt: -1 }),
    session: async (_, { id }) => Session.findById(id),
  },

  Session: {
    courtsDetails: async (session) => {
      if (!session?.courts?.length) return [];
      return Court.find({ _id: { $in: session.courts } }).sort({ name: 1 });
    },
    isArchived: (session) => Boolean(session.isArchived),
    createdAt: (session) => (session?.createdAt ? new Date(session.createdAt).toISOString() : null),
    updatedAt: (session) => (session?.updatedAt ? new Date(session.updatedAt).toISOString() : null),
    startedAt: (session) => (session?.startedAt ? new Date(session.startedAt).toISOString() : null),
    endedAt: (session) => (session?.endedAt ? new Date(session.endedAt).toISOString() : null),
  },

  Mutation: {
    createSession: async (_, { input }) => {
      try {
        const uniqueCourtIds = [...new Set(input.courtIds.map((id) => id.toString()))];
        const uniquePlayerIds = [...new Set(input.playerIds.map((id) => id.toString()))];

        const courtsCount = await Court.countDocuments({ _id: { $in: uniqueCourtIds } });
        if (courtsCount !== uniqueCourtIds.length) {
          return { ok: false, message: 'One or more courts do not exist', session: null };
        }

        const playersCount = await Player.countDocuments({ _id: { $in: uniquePlayerIds } });
        if (playersCount !== uniquePlayerIds.length) {
          return { ok: false, message: 'One or more players do not exist', session: null };
        }

        const sessionDoc = await Session.create({
          name: input.name,
          status: 'QUEUED',
          courts: uniqueCourtIds.map(toObjectId),
          players: uniquePlayerIds.map((playerId) => ({
            playerId: toObjectId(playerId),
            gamesPlayed: 0,
          })),
        });

        pubsub.publish(SESSION_SUB_TRIGGER, {
          sessionSub: { type: 'CREATED', session: sessionDoc },
        });

        return { ok: true, message: 'Session created successfully', session: sessionDoc };
      } catch (error) {
        return { ok: false, message: error.message, session: null };
      }
    },

    updateSession: async (_, { id, input }) => {
      try {
        const sessionDoc = await Session.findById(id);

        if (!sessionDoc) {
          return { ok: false, message: 'Session not found', session: null };
        }

        if (input.name !== undefined) {
          sessionDoc.name = input.name;
        }

        if (input.courtIds !== undefined) {
          const uniqueCourtIds = [...new Set(input.courtIds.map((id) => id.toString()))];
          const courtsCount = await Court.countDocuments({ _id: { $in: uniqueCourtIds } });
          if (courtsCount !== uniqueCourtIds.length) {
            return { ok: false, message: 'One or more courts do not exist', session: null };
          }
          sessionDoc.courts = uniqueCourtIds.map(toObjectId);
        }

        if (input.playerIds !== undefined) {
          const uniquePlayerIds = [...new Set(input.playerIds.map((id) => id.toString()))];
          const playersCount = await Player.countDocuments({ _id: { $in: uniquePlayerIds } });
          if (playersCount !== uniquePlayerIds.length) {
            return { ok: false, message: 'One or more players do not exist', session: null };
          }
          sessionDoc.players = uniquePlayerIds.map((playerId) => ({
            playerId: toObjectId(playerId),
            gamesPlayed: 0,
          }));
        }

        await sessionDoc.save();

        pubsub.publish(SESSION_SUB_TRIGGER, {
          sessionSub: { type: 'UPDATED', session: sessionDoc },
        });

        return { ok: true, message: 'Session updated successfully', session: sessionDoc };
      } catch (error) {
        return { ok: false, message: error.message, session: null };
      }
    },

    deleteSession: async (_, { id }) => {
      try {
        const sessionDoc = await Session.findById(id);

        if (!sessionDoc) {
          return { ok: true, message: 'Session already deleted', session: null };
        }

        if (!sessionDoc.isArchived) {
          sessionDoc.isArchived = true;
          await sessionDoc.save();
        }

        pubsub.publish(SESSION_SUB_TRIGGER, {
          sessionSub: { type: 'ARCHIVED', session: sessionDoc },
        });

        return { ok: true, message: 'Session archived successfully', session: null };
      } catch (error) {
        return { ok: false, message: error.message, session: null };
      }
    },

    startSession: async (_, { id }) => {
      try {
        const sessionDoc = await Session.findById(id);

        if (!sessionDoc) {
          return { ok: false, message: 'Session not found', session: null };
        }

        if (sessionDoc.status !== 'QUEUED') {
          return {
            ok: false,
            message: 'Only queued sessions can be started',
            session: null,
          };
        }

        sessionDoc.status = 'OPEN';
        sessionDoc.startedAt = sessionDoc.startedAt ?? new Date();
        await sessionDoc.save();

        pubsub.publish(SESSION_SUB_TRIGGER, {
          sessionSub: { type: 'UPDATED', session: sessionDoc },
        });

        return { ok: true, message: 'Session started successfully', session: sessionDoc };
      } catch (error) {
        return { ok: false, message: error.message, session: null };
      }
    },

    addPlayersToSession: async (_, { id, input }) => {
      try {
        const sessionDoc = await Session.findById(id);

        if (!sessionDoc) {
          return { ok: false, message: 'Session not found', session: null };
        }

        if (sessionDoc.status === 'CLOSED') {
          return { ok: false, message: 'Cannot add players to a closed session', session: null };
        }

        const existingIds = new Set(sessionDoc.players.map((item) => item.playerId.toString()));
        const incomingIds = [...new Set(input.playerIds.map((playerId) => playerId.toString()))];

        const newPlayerIds = incomingIds.filter((playerId) => !existingIds.has(playerId));

        if (newPlayerIds.length === 0) {
          return { ok: true, message: 'No new players to add', session: sessionDoc };
        }

        const count = await Player.countDocuments({ _id: { $in: newPlayerIds } });
        if (count !== newPlayerIds.length) {
          return { ok: false, message: 'One or more players do not exist', session: null };
        }

        sessionDoc.players.push(
          ...newPlayerIds.map((playerId) => ({ playerId: toObjectId(playerId), gamesPlayed: 0 }))
        );

        await sessionDoc.save();

        pubsub.publish(SESSION_SUB_TRIGGER, {
          sessionSub: { type: 'UPDATED', session: sessionDoc },
        });

        return { ok: true, message: 'Players added to session successfully', session: sessionDoc };
      } catch (error) {
        return { ok: false, message: error.message, session: null };
      }
    },

    endSession: async (_, { id }) => {
      try {
        const sessionDoc = await Session.findById(id);

        if (!sessionDoc) {
          return { ok: false, message: 'Session not found', session: null };
        }

        if (sessionDoc.status !== 'OPEN') {
          return {
            ok: false,
            message: 'Only open sessions can be ended',
            session: null,
          };
        }

        const hasMatches = await hasAnyMatchInSession(sessionDoc._id);
        if (hasMatches) {
          return {
            ok: false,
            message: 'Cannot end session while matches are ongoing or queued',
            session: null,
          };
        }

        const blockingQueuedSession = await hasQueuedSessionUsingAnyCourt(sessionDoc);

        if (blockingQueuedSession) {
          sessionDoc.status = 'CLOSED';
          await sessionDoc.save();

          pubsub.publish(SESSION_SUB_TRIGGER, {
            sessionSub: { type: 'UPDATED', session: sessionDoc },
          });

          return {
            ok: true,
            message: 'Session moved to closed state',
            session: sessionDoc,
          };
        }

        return closeSessionWithSnapshot(id);
      } catch (error) {
        return { ok: false, message: error.message, session: null };
      }
    },

    closeSession: async (_, { id }) => closeSessionWithSnapshot(id),

    archiveSession: async (_, { id }) => {
      try {
        const sessionDoc = await Session.findById(id)

        if (!sessionDoc) {
          return { ok: false, message: 'Session not found', session: null }
        }

        if (sessionDoc.isArchived) {
          return { ok: true, message: 'Session already archived', session: sessionDoc }
        }

        sessionDoc.isArchived = true
        await sessionDoc.save()

        pubsub.publish(SESSION_SUB_TRIGGER, {
          sessionSub: { type: 'ARCHIVED', session: sessionDoc },
        })

        return { ok: true, message: 'Session archived successfully', session: sessionDoc }
      } catch (error) {
        return { ok: false, message: error.message, session: null }
      }
    },
  },
  Subscription: {
    sessionSub: {
      subscribe: () => pubsub.asyncIterableIterator(SESSION_SUB_TRIGGER),
    },
  },
};

export default sessionResolver;
