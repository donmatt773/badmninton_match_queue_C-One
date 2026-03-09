import { OngoingMatch, Court } from '../models/index.model.js';
import { pubsub } from '../configs/pubsub.js';

const ONGOING_MATCH_UPDATES = 'ONGOING_MATCH_UPDATES';
const COURT_UPDATED = 'COURT_UPDATED';

const ongoingMatchResolver = {
  Query: {
    ongoingMatches: async () => {
      try {
        const matches = await OngoingMatch.find().sort({ createdAt: 1 });
        return matches;
      } catch (err) {
        console.error('Error fetching ongoing matches:', err);
        return [];
      }
    },

    ongoingMatchesBySession: async (_, { sessionId }) => {
      try {
        const matches = await OngoingMatch.find({ sessionId }).sort({ createdAt: 1 });
        return matches;
      } catch (err) {
        console.error('Error fetching ongoing matches by session:', err);
        return [];
      }
    },
  },

  Mutation: {
    startMatch: async (_, { input }) => {
      try {
        const { sessionId, courtId, playerIds, queued = false } = input;

        const newMatch = new OngoingMatch({
          sessionId,
          courtId,
          playerIds,
          queued,
          startedAt: queued ? null : new Date(), // Only set startedAt if not queued
        });

        await newMatch.save();

        // Update court status to OCCUPIED if match is not queued
        if (!queued && courtId) {
          const updatedCourt = await Court.findByIdAndUpdate(
            courtId, 
            { status: 'OCCUPIED' },
            { returnDocument: 'after' }
          );
          if (updatedCourt) {
            pubsub.publish(COURT_UPDATED, {
              courtSub: { type: 'UPDATED', court: updatedCourt },
            });
          }
        }

        pubsub.publish(ONGOING_MATCH_UPDATES, {
          ongoingMatchUpdates: {
            type: 'STARTED',
            match: newMatch,
          },
        });

        return {
          ok: true,
          message: 'Match started successfully',
          match: newMatch,
        };
      } catch (err) {
        console.error('Error starting match:', err);
        return {
          ok: false,
          message: err.message,
          match: null,
        };
      }
    },

    endMatch: async (_, { id }) => {
      try {
        const match = await OngoingMatch.findByIdAndDelete(id);

        if (!match) {
          return {
            ok: false,
            message: 'Match not found',
            match: null,
          };
        }

        // Update court status back to ACTIVE
        if (match.courtId) {
          const updatedCourt = await Court.findByIdAndUpdate(
            match.courtId, 
            { status: 'ACTIVE' },
            { returnDocument: 'after' }
          );
          if (updatedCourt) {
            pubsub.publish(COURT_UPDATED, {
              courtSub: { type: 'UPDATED', court: updatedCourt },
            });
          }
        }

        pubsub.publish(ONGOING_MATCH_UPDATES, {
          ongoingMatchUpdates: {
            type: 'ENDED',
            match,
          },
        });

        return {
          ok: true,
          message: 'Match ended successfully',
          match,
        };
      } catch (err) {
        console.error('Error ending match:', err);
        return {
          ok: false,
          message: err.message,
          match: null,
        };
      }
    },

    updateMatch: async (_, { id, input }) => {
      try {
        const updateData = {};
        if (input.courtId) updateData.courtId = input.courtId;
        if (input.playerIds) updateData.playerIds = input.playerIds;

        // Get old match to check if court is changing
        const oldMatch = await OngoingMatch.findById(id);
        
        const match = await OngoingMatch.findByIdAndUpdate(
          id,
          updateData,
          { returnDocument: 'after' }
        );

        if (!match) {
          return {
            ok: false,
            message: 'Match not found',
            match: null,
          };
        }

        // Update court statuses if court changed and match is not queued
        if (input.courtId && oldMatch && !oldMatch.queued) {
          if (oldMatch.courtId && oldMatch.courtId.toString() !== input.courtId) {
            // Set old court back to ACTIVE
            const oldCourt = await Court.findByIdAndUpdate(
              oldMatch.courtId, 
              { status: 'ACTIVE' },
              { returnDocument: 'after' }
            );
            if (oldCourt) {
              pubsub.publish(COURT_UPDATED, {
                courtSub: { type: 'UPDATED', court: oldCourt },
              });
            }
          }
          // Set new court to OCCUPIED
          const newCourt = await Court.findByIdAndUpdate(
            input.courtId, 
            { status: 'OCCUPIED' },
            { returnDocument: 'after' }
          );
          if (newCourt) {
            pubsub.publish(COURT_UPDATED, {
              courtSub: { type: 'UPDATED', court: newCourt },
            });
          }
        }

        pubsub.publish(ONGOING_MATCH_UPDATES, {
          ongoingMatchUpdates: {
            type: 'UPDATED',
            match,
          },
        });

        return {
          ok: true,
          message: 'Match updated successfully',
          match,
        };
      } catch (err) {
        console.error('Error updating match:', err);
        return {
          ok: false,
          message: err.message,
          match: null,
        };
      }
    },

    startQueuedMatch: async (_, { id }) => {
      try {
        const match = await OngoingMatch.findByIdAndUpdate(
          id,
          { 
            queued: false,
            startedAt: new Date()
          },
          { returnDocument: 'after' }
        );

        if (!match) {
          return {
            ok: false,
            message: 'Match not found',
            match: null,
          };
        }

        // Update court status to OCCUPIED when queued match starts
        if (match.courtId) {
          const updatedCourt = await Court.findByIdAndUpdate(
            match.courtId, 
            { status: 'OCCUPIED' },
            { returnDocument: 'after' }
          );
          if (updatedCourt) {
            pubsub.publish(COURT_UPDATED, {
              courtSub: { type: 'UPDATED', court: updatedCourt },
            });
          }
        }

        pubsub.publish(ONGOING_MATCH_UPDATES, {
          ongoingMatchUpdates: {
            type: 'UPDATED',
            match,
          },
        });

        return {
          ok: true,
          message: 'Queued match started successfully',
          match,
        };
      } catch (err) {
        console.error('Error starting queued match:', err);
        return {
          ok: false,
          message: err.message,
          match: null,
        };
      }
    },
  },

  Subscription: {
    ongoingMatchUpdates: {
      subscribe: () => pubsub.asyncIterableIterator(ONGOING_MATCH_UPDATES),
    },
  },
};

export default ongoingMatchResolver;
