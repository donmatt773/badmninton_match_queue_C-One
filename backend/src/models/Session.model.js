import mongoose from 'mongoose';

const sessionPlayerSchema = new mongoose.Schema(
  {
    playerId: {type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true,
    },
    gamesPlayed: {type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    name: {type: String,
      required: true,
      trim: true,
    },
    status: {type: String,
      required: true,
      enum: ['QUEUED', 'OPEN', 'CLOSED'],
      default: 'QUEUED',
    },
    courts: [
      {type: mongoose.Schema.Types.ObjectId,
        ref: 'Court',
        required: true,
      },
    ],
    players: {
      type: [sessionPlayerSchema],
      default: [],
    },
    startedAt: {type: Date,
      default: null,
    },
    endedAt: {type: Date,
      default: null,
    },
    isArchived: {type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

sessionSchema.index({ status: 1 });
sessionSchema.index({ courts: 1, status: 1 });

const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);

export default Session;
