import gql from "graphql-tag";

const playerTypeDef = gql`
  enum PlayerLevel {
    BEGINNER
    INTERMEDIATE
    UPPERINTERMEDIATE
    ADVANCED
  }

  enum Gender {
    MALE
    FEMALE
  }

  type Player {
    _id: ID!
    name: String!
    gender: Gender
    playerLevel: PlayerLevel
    playCount: Int!
    winCount: Int!
    lossCount: Int!
    winRate: Float!
    createdAt: String!
    updatedAt: String!
  }

  type PlayerMutationResponse {
    ok: Boolean!
    message: String!
    player: Player
  }

  type PlayerPaginationResponse {
    players: [Player!]!
    total: Int!
  }

  input CreatePlayerInput {
    name: String!
    gender: Gender
    playerLevel: PlayerLevel
  }

  input UpdatePlayerInput {
    name: String
    gender: Gender
    playerLevel: PlayerLevel
  }

  type Query {
    players: [Player!]!
    player(id: ID!): Player
    playersPaginated(limit: Int!, offset: Int!, search: String, skillLevel: String, sortBy: String = "createdAt", sortOrder: String = "desc"): PlayerPaginationResponse!
    playersCount(search: String, skillLevel: String): Int!
    leaderboard(limit: Int = 10): [Player!]!
    deletedPlayers: [Player!]!
  }

  type Mutation {
    createPlayer(input: CreatePlayerInput!): PlayerMutationResponse!
    updatePlayer(id: ID!, input: UpdatePlayerInput!): PlayerMutationResponse!
    deletePlayer(id: ID!): PlayerMutationResponse!
    restorePlayer(id: ID!): PlayerMutationResponse!
  }

  enum PlayerSubType {
    CREATED
    UPDATED
    DELETED
  }

  type PlayerSubPayload {
    type: PlayerSubType!
    player: Player!
  }

  extend type Subscription {
    playerUpdates: PlayerSubPayload!
  }
`;

export default playerTypeDef;
