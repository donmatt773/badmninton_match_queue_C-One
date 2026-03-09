import express from "express"
import http from "http"
import cors from "cors"
import cookieParser from "cookie-parser"
import dotenv from "dotenv"
import { createApolloServer } from "./configs/apollo.js"
import { expressMiddleware } from "@as-integrations/express5"
import bulkPlayersRouter from "./routes/bulkPlayers.js"

import connectDB from "./configs/mongodb.js"

dotenv.config()


const app = express()
const httpServer = http.createServer(app)
const PORT = process.env.PORT || 4000
const host = process.env.IP_ADDRESS || "0.0.0.0"
const publicHost = process.env.IP_ADDRESS || "localhost"
const frontendOrigin = process.env.FRONTEND_ORIGIN || `http://${publicHost}:5173`

const start = async () => {
  await connectDB()

const server = createApolloServer(httpServer)
  await server.start()

  app.use(
    "/",
    cors({
      origin: [frontendOrigin, "http://localhost:5173", "http://localhost:5174", "http://localhost:5175", /^http:\/\/10\.217\.104\.24:\d+$/],
      credentials: true,
    }),
    express.json(),
    cookieParser(),
  )

  // REST API routes
  app.use('/api/players', bulkPlayersRouter)

  // GraphQL route
  app.use(
    "/graphql",
    expressMiddleware(server, {
      context: async ({ req, res }) => ({
        req,
        res,
      }),
    }),
  )

  httpServer.listen(PORT, host, () => {
    console.log(`🚀 GraphQL ready at http://${publicHost}:${PORT}/graphql`)
  })
}

start()