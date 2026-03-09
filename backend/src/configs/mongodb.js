import mongoose from "mongoose"

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URL || process.env.MONGO_URI
  const dbName = process.env.MONGO_DB_NAME

  if (!mongoUri) {
    throw new Error("MONGODB_URL or MONGO_URI not defined sa .env")
  }

  try {
    await mongoose.connect(mongoUri, {
      ...(dbName ? { dbName } : {}),
    })
    console.log("MongoDB connected!")
  } catch (error) {
    console.error("MongoDB connection error:", error)
    process.exit(1)
  }
}

export default connectDB