import gql from 'graphql-tag';

const ongoingMatchTypeDef = gql`
  type OngoingMatch {
    _id: ID!
    sessionId: ID!
    courtId: ID!
    playerIds: [ID!]!
    queued: Boolean!
    startedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type OngoingMatchMutationResponse {
    ok: Boolean!
    message: String!
    match: OngoingMatch
  }

  input StartMatchInput {
    sessionId: ID!
    courtId: ID!
    playerIds: [ID!]!
    queued: Boolean
  }

  input UpdateMatchInput {
    courtId: ID
    playerIds: [ID!]
  }

  type Query {
    ongoingMatches: [OngoingMatch!]!
    ongoingMatchesBySession(sessionId: ID!): [OngoingMatch!]!
  }

  type Mutation {
    startMatch(input: StartMatchInput!): OngoingMatchMutationResponse!
    endMatch(id: ID!): OngoingMatchMutationResponse!
    updateMatch(id: ID!, input: UpdateMatchInput!): OngoingMatchMutationResponse!
    startQueuedMatch(id: ID!): OngoingMatchMutationResponse!
  }

  enum OngoingMatchEventType {
    STARTED
    UPDATED
    ENDED
  }

  type OngoingMatchPayload {
    type: OngoingMatchEventType!
    match: OngoingMatch!
  }

  extend type Subscription {
    ongoingMatchUpdates: OngoingMatchPayload!
  }
`;

export default ongoingMatchTypeDef;
