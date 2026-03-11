import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema(
  {
    name: {type: String,
      required: true,
      trim: true,
    },
    gender: {type: String,
      required: false,
      default: null,
      enum: ['MALE', 'FEMALE', null],
      trim: true,
    },
    playerLevel: {type: String,
      required: false,
      default: null,
      enum: ['BEGINNER', 'INTERMEDIATE', 'UPPERINTERMEDIATE', 'ADVANCED', null],
    },
    playCount: {type: Number,
      required: false,
      min: 0,
      default: 0,
    },
    winCount: {
      type: Number,
      required: false,
      min: 0,
      default: 0,
    },
    lossCount: {
      type: Number,
      required: false,
      min: 0,
      default: 0,
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt:  { type: Date,    default: null  },
  },
  { timestamps: true }
);

// Add indexes for frequently queried fields
playerSchema.index({ name: 'text' }); // Text index for search
playerSchema.index({ playerLevel: 1 }); // Index for filtering by skill level
playerSchema.index({ createdAt: -1 }); // Index for sorting by creation date
playerSchema.index({ playCount: -1 }); // Index for sorting by games played
playerSchema.index({ winCount: -1 }); // Index for sorting by wins
playerSchema.index({ lossCount: -1 }); // Index for sorting by losses
playerSchema.index({ isDeleted: 1 }); // Index for soft-delete filter
playerSchema.index(
  { name: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: { $ne: true } },
    collation: { locale: 'en', strength: 2 },
  }
); // Unique name only for active players

const Player = mongoose.models.Player || mongoose.model('Player', playerSchema);

export default Player;