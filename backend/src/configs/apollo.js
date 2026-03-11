
import { ApolloServer } from "@apollo/server"
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer"
import { WebSocketServer } from "ws"
import { useServer } from "graphql-ws/use/ws"
import { schema } from "../graphql/schema.js"



export const createApolloServer = (httpServer) => {
  httpServer.on("listening", () => {
    console.log("📖 Apollo Server is ready...")
  })


  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/subscriptions",
  })

  const serverCleanup = useServer({ 
    schema,
    keepAlive: 10000, // Send ping every 10 seconds to detect stale connections
    onConnect: (ctx) => {
      console.log('Client connected to WebSocket');
      return true;
    },
    onDisconnect: (ctx, code, reason) => {
      console.log('Client disconnected from WebSocket', code, reason);
    },
    onError: (ctx, message, errors) => {
      console.error('WebSocket error:', errors);
    },
  }, wsServer)

  return new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose()
            },
          }
        },
      },
    ],
  })
}