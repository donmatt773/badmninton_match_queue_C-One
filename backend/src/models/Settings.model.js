import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    scope: {type: String,
      default: 'GLOBAL',
      unique: true,
      immutable: true,
      trim: true,
    },
    pricePerGame: {type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  { timestamps: true }
);

const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);

export default Settings;
