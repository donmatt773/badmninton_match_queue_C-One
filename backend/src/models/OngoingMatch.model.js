import mongoose from 'mongoose';

const ongoingMatchSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true,
    },
    courtId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Court',
      required: true,
    },
    playerIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true,
    }],
    queued: {
      type: Boolean,
      default: false,
    },
    startedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const OngoingMatch = mongoose.models.OngoingMatch || mongoose.model('OngoingMatch', ongoingMatchSchema);

export default OngoingMatch;
