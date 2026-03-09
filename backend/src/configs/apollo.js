
import { ApolloServer } from "@apollo/server"
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer"
import { WebSocketServer } from "ws"
import { useServer } from "../../node_modules/graphql-ws/dist/use/ws.js"
import { schema } from "../graphql/schema.js"



export const createApolloServer = (httpServer) => {
  httpServer.on("listening", () => {
    console.log("📖 Apollo Server is ready...")
  })


  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/subscriptions",
  })

  const serverCleanup = useServer({ schema }, wsServer)

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