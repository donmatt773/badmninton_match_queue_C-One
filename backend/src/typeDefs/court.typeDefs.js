import gql from 'graphql-tag';

const courtTypeDef = gql`
  enum CourtSurfaceType {
    WOODEN
    SYNTHETIC
    MAT
    CONCRETE
  }

  enum CourtStatus {
    ACTIVE
    OCCUPIED
    MAINTENANCE
  }

  type Court {
    _id: ID!
    name: String!
    surfaceType: CourtSurfaceType!
    indoor: Boolean!
    description: String
    status: CourtStatus!
    createdAt: String!
    updatedAt: String!
  }

  type CourtMutationResponse {
    ok: Boolean!
    message: String!
    court: Court
  }

  input CreateCourtInput {
    name: String!
    surfaceType: CourtSurfaceType!
    indoor: Boolean!
    description: String
    status: CourtStatus
  }

  input UpdateCourtInput {
    name: String
    surfaceType: CourtSurfaceType
    indoor: Boolean
    description: String
    status: CourtStatus
  }

  type Query {
    courts: [Court!]!
    court(id: ID!): Court
  }

  type Mutation {
    createCourt(input: CreateCourtInput!): CourtMutationResponse!
    updateCourt(id: ID!, input: UpdateCourtInput!): CourtMutationResponse!
    deleteCourt(id: ID!): CourtMutationResponse!
  }
  type Subscription {
    courtSub: CourtSubPayload!
  }

  enum CourtSubType {
    CREATED
    UPDATED
    DELETED
  }

  type CourtSubPayload {
    type: CourtSubType!
    court: Court!
  }

`;

export default courtTypeDef;