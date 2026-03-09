import Court from '../models/Court.model.js';
import { pubsub } from '../configs/pubsub.js';

const SUB_TRIGGER = 'COURT_UPDATED';
const courtResolver = {

  Query: {
    courts: async () => Court.find().sort({ createdAt: -1 }),
    court: async (_, { id }) => Court.findById(id),
  },

  Mutation: {
    createCourt: async (_, { input }) => {
      try {
        const court = await Court.create({
          name: input.name,
          surfaceType: input.surfaceType,
          indoor: input.indoor,
          description: input.description ?? '',
          status: input.status ?? 'active',
        });
        console.log('Court created:');
        pubsub.publish(SUB_TRIGGER, {
            courtSub: {type: "CREATED", court },
          })

        return { ok: true, message: 'Court created successfully', court };
      } catch (error) {
        return { ok: false, message: error.message, court: null };
      }
    },

    updateCourt: async (_, { id, input }) => {
      try {
        const court = await Court.findByIdAndUpdate(
          id,
          {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.surfaceType !== undefined
              ? { surfaceType: input.surfaceType }
              : {}),
            ...(input.indoor !== undefined ? { indoor: input.indoor } : {}),
            ...(input.description !== undefined
              ? { description: input.description }
              : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
          },
          { returnDocument: 'after', runValidators: true }
        );

        if (!court) {
          return { ok: false, message: 'Court not found', court: null };
        }
         pubsub.publish(SUB_TRIGGER, {
            courtSub: {type: "UPDATED", court },
          })
        return { ok: true, message: 'Court updated successfully', court };
      } catch (error) {
        return { ok: false, message: error.message, court: null };
      }
    },

    deleteCourt: async (_, { id }) => {
      try {
        const court = await Court.findByIdAndDelete(id);

        if (!court) {
          return { ok: false, message: 'Court not found', court: null };
        }
         pubsub.publish(SUB_TRIGGER, {
            courtSub: {type: "DELETED", court },
          })

        return { ok: true, message: 'Court deleted successfully', court };
      } catch (error) {
        return { ok: false, message: error.message, court: null };
      }
    },
  },
  Subscription: {
    courtSub: {
      subscribe: () => pubsub.asyncIterableIterator(SUB_TRIGGER),
    },
  },
};

export default courtResolver;