import { ApolloClient, HttpLink, InMemoryCache, split } from "@apollo/client";
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

const httpUri = import.meta.env.VITE_GRAPHQL_URL || "http://10.217.104.24:4000/graphql";
const wsUri = import.meta.env.VITE_WS_URL || "ws://10.217.104.24:4000/subscriptions";

const httpLink = new HttpLink({
  uri: httpUri,
});

const wsLink = new GraphQLWsLink(createClient({
  url: wsUri,
}));

// Split link: use ws for subscriptions, http for queries/mutations
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  httpLink,
);

const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // These list queries are commonly replaced by polling/subscription updates.
          // Explicit replacement avoids Apollo "Cache data may be lost" warnings.
          ongoingMatches: {
            merge(_existing, incoming) {
              return incoming;
            },
          },
          players: {
            merge(_existing, incoming) {
              return incoming;
            },
          },
          courts: {
            merge(_existing, incoming) {
              return incoming;
            },
          },
          sessions: {
            merge(_existing, incoming) {
              return incoming;
            },
          },
        },
      },
    },
  }),
});

export default client;