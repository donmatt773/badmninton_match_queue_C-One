import gql from 'graphql-tag';

const settingsTypeDef = gql`
  type Settings {
    _id: ID!
    scope: String!
    pricePerGame: Int!
    createdAt: String!
    updatedAt: String!
  }

  type SettingsMutationResponse {
    ok: Boolean!
    message: String!
    settings: Settings
  }

  type Query {
    settings: Settings!
  }

  type Mutation {
    updatePricePerGame(pricePerGame: Int!): SettingsMutationResponse!
  }

  enum SettingsSubType {
    UPDATED
  }

  type SettingsSubPayload {
    type: SettingsSubType!
    settings: Settings!
  }

  extend type Subscription {
    settingsSub: SettingsSubPayload!
  }
`;

export default settingsTypeDef;
