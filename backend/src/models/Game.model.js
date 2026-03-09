import mongoose from 'mongoose';

const gameSchema = new mongoose.Schema(
  {
    sessionId: {type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true,
    },
    courtId: {type: mongoose.Schema.Types.ObjectId,
      ref: 'Court',
      required: true,
    },
    players: [{type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
        required: true,
      },],
    winnerPlayerIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true,
    }],
    finishedAt: {type: Date,
      required: true,
      default: Date.now,
    },
},
  { timestamps: true }
);

const Game = mongoose.models.Game || mongoose.model('Game', gameSchema);

export default Game;
