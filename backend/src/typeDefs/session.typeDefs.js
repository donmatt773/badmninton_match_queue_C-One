import gql from 'graphql-tag';

const sessionTypeDef = gql`
  enum SessionStatus {
    QUEUED
    OPEN
    CLOSED
  }

  type SessionPlayer {
    playerId: ID!
    gamesPlayed: Int!
  }

  type Session {
    _id: ID!
    name: String!
    status: SessionStatus!
    courts: [ID!]!
    courtsDetails: [Court!]!
    players: [SessionPlayer!]!
    startedAt: String
    endedAt: String
    isArchived: Boolean!
    price: Float
    createdAt: String!
    updatedAt: String!
  }

  type SessionMutationResponse {
    ok: Boolean!
    message: String!
    session: Session
  }

  type SessionsMutationResponse {
    ok: Boolean!
    message: String!
    sessions: [Session!]!
  }

  input CreateSessionInput {
    name: String!
    courtIds: [ID!]!
    playerIds: [ID!]!
    price: Float
  }

  input UpdateSessionInput {
    name: String
    courtIds: [ID!]
    playerIds: [ID!]
    price: Float
  }

  input AddSessionPlayersInput {
    playerIds: [ID!]!
  }

  type Query {
    sessions: [Session!]!
    closedSessions: [Session!]!
    session(id: ID!): Session
  }

  type Mutation {
    createSession(input: CreateSessionInput!): SessionMutationResponse!
    updateSession(id: ID!, input: UpdateSessionInput!): SessionMutationResponse!
    deleteSession(id: ID!): SessionMutationResponse!
    startSession(id: ID!): SessionMutationResponse!
    addPlayersToSession(id: ID!, input: AddSessionPlayersInput!): SessionMutationResponse!
    endSession(id: ID!): SessionMutationResponse!
    closeSession(id: ID!): SessionMutationResponse!
    archiveSession(id: ID!): SessionMutationResponse!
    removePlayerFromSessions(playerId: ID!, sessionIds: [ID!]!): SessionsMutationResponse!
  }

  enum SessionSubType {
    CREATED
    UPDATED
    CLOSED
    ARCHIVED
  }

  type SessionSubPayload {
    type: SessionSubType!
    session: Session!
  }

  extend type Subscription {
    sessionSub: SessionSubPayload!
  }
`;

export default sessionTypeDef;
