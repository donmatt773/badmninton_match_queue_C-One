import Settings from '../models/Settings.model.js';
import { pubsub } from '../configs/pubsub.js';

const SUB_TRIGGER = 'SETTINGS_UPDATED';

const getOrCreateSettings = async () => {
  let settings = await Settings.findOne({ scope: 'GLOBAL' });

  if (!settings) {
    settings = await Settings.create({ scope: 'GLOBAL', pricePerGame: 0 });
  }

  return settings;
};

const settingsResolver = {
  Query: {
    settings: async () => getOrCreateSettings(),
  },
  Mutation: {
    updatePricePerGame: async (_, { pricePerGame }) => {
      try {
        const settings = await Settings.findOneAndUpdate(
          { scope: 'GLOBAL' },
          { $set: { pricePerGame } },
          { returnDocument: 'after', upsert: true, runValidators: true }
        );

        pubsub.publish(SUB_TRIGGER, {
          settingsSub: { type: 'UPDATED', settings },
        });

        return { ok: true, message: 'Price per game updated successfully', settings };
      } catch (error) {
        return { ok: false, message: error.message, settings: null };
      }
    },
  },
  Subscription: {
    settingsSub: {
      subscribe: () => pubsub.asyncIterableIterator(SUB_TRIGGER),
    },
  },
};

export default settingsResolver;
