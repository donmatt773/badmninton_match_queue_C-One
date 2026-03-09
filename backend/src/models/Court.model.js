import mongoose from "mongoose";

const courtSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    surfaceType: {type: String,required: true,enum: ["WOODEN", "SYNTHETIC", "MAT", "CONCRETE"],},
    indoor: {type: Boolean,required: true,},
    description: {type: String,default: "",trim: true,},
    status: {type: String,required: true,
      enum: ["ACTIVE", "OCCUPIED", "MAINTENANCE"],default: "ACTIVE",
},
  },
  { timestamps: true },
);

const Court = mongoose.models.Court || mongoose.model("Court", courtSchema);

export default Court;
