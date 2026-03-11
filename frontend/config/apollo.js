import { ApolloClient, HttpLink, InMemoryCache, split } from "@apollo/client";
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

const browserHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const browserProtocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
const wsProtocol = browserProtocol === 'https:' ? 'wss' : 'ws';
const defaultHttpUri = `${browserProtocol}//${browserHost}:4000/graphql`;
const defaultWsUri = `${wsProtocol}://${browserHost}:4000/subscriptions`;

const httpUri = import.meta.env.VITE_GRAPHQL_URL || defaultHttpUri;
const wsUri = import.meta.env.VITE_WS_URL || defaultWsUri;
const enableWsDebug = import.meta.env.DEV && import.meta.env.VITE_DEBUG_WS === 'true';

const httpLink = new HttpLink({
  uri: httpUri,
});

const wsClient = createClient({
  url: wsUri,
  lazy: true,
  lazyCloseTimeout: 30_000,
  keepAlive: 10000,
  retryAttempts: 10,
  retryWait: async (retries) => {
    const backoffMs = Math.min(1000 * 2 ** retries, 15000);
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
  },
  shouldRetry: (event) => {
    // Avoid infinite noisy retry loops for clean/terminal closures.
    if (event?.code === 1000 || event?.code === 1001 || event?.code === 4401 || event?.code === 4403) {
      return false;
    }

    // If the browser is offline, wait until online again.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return false;
    }

    return true;
  },
  connectionParams: async () => ({}),
  on: {
    connected: () => {
      if (enableWsDebug) console.info('[ws] connected');
    },
    closed: (event) => {
      if (enableWsDebug && event?.code !== 1000) {
        console.warn('[ws] closed', event.code, event.reason || 'no-reason');
      }
    },
    error: (error) => {
      if (enableWsDebug) console.warn('[ws] error', error);
    },
  },
});

const wsLink = new GraphQLWsLink(wsClient);

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
      Session: {
        fields: {
          // Session.players items are embedded objects (no standalone IDs),
          // so always replace the array on incoming writes.
          players: {
            merge(_existing, incoming) {
              return incoming;
            },
          },
        },
      },
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