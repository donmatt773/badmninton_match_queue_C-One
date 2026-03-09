import gql from 'graphql-tag';

const gameTypeDef = gql`
  type Game {
    _id: ID!
    sessionId: ID!
    courtId: ID!
    players: [ID!]!
    winnerPlayerIds: [ID!]!
    finishedAt: String!
    createdAt: String!
    updatedAt: String!
  }

  type GameMutationResponse {
    ok: Boolean!
    message: String!
    game: Game
  }

  input RecordGameInput {
    sessionId: ID!
    courtId: ID!
    playerIds: [ID!]!
    winnerPlayerIds: [ID!]
    finishedAt: String
  }

  type Query {
    games: [Game!]!
    gamesBySession(sessionId: ID!): [Game!]!
    gamesBySessionIds(sessionIds: [ID!]!): [Game!]!
  }

  type Mutation {
    recordGame(input: RecordGameInput!): GameMutationResponse!
  }

  enum GameSubType {
    CREATED
  }

  type GameSubPayload {
    type: GameSubType!
    game: Game!
  }

  extend type Subscription {
    gameSub: GameSubPayload!
  }
`;

export default gameTypeDef;
