import Payment from '../models/Payment.model.js';
import { pubsub } from '../configs/pubsub.js';

const SUB_TRIGGER = 'PAYMENT_UPDATED';

const paymentResolver = {
  Query: {
    billingBySession: async (_, { sessionId }) => {
      try {
        const payment = await Payment.findOne({ sessionId });

        if (!payment) {
          return {
            ok: false,
            message: 'Billing not generated yet. Close the session first.',
            payment: null,
          };
        }

        return { ok: true, message: 'Billing fetched successfully', payment };
      } catch (error) {
        return { ok: false, message: error.message, payment: null };
      }
    },
  },
  Payment: {
    closedAt: (payment) => payment.closedAt ? new Date(payment.closedAt).toISOString() : null,
    createdAt: (payment) => payment.createdAt ? new Date(payment.createdAt).toISOString() : null,
    updatedAt: (payment) => payment.updatedAt ? new Date(payment.updatedAt).toISOString() : null,
  },
  Subscription: {
    paymentSub: {
      subscribe: () => pubsub.asyncIterableIterator(SUB_TRIGGER),
    },
  },
};

export default paymentResolver;
