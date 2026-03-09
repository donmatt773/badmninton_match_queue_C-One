import { mergeResolvers, mergeTypeDefs } from '@graphql-tools/merge';
import { makeExecutableSchema } from '@graphql-tools/schema';
import courtTypeDef from '../typeDefs/court.typeDefs.js';
import playerResolver from '../resolvers/player.resolver.js';
import playerTypeDef from '../typeDefs/player.typeDefs.js';
import courtResolver from '../resolvers/court.resolver.js';
import settingsTypeDef from '../typeDefs/settings.typeDefs.js';
import sessionTypeDef from '../typeDefs/session.typeDefs.js';
import gameTypeDef from '../typeDefs/game.typeDefs.js';
import paymentTypeDef from '../typeDefs/payment.typeDefs.js';
import ongoingMatchTypeDef from '../typeDefs/ongoingMatch.typeDefs.js';
import settingsResolver from '../resolvers/settings.resolver.js';
import sessionResolver from '../resolvers/session.resolver.js';
import gameResolver from '../resolvers/game.resolver.js';
import paymentResolver from '../resolvers/payment.resolver.js';
import ongoingMatchResolver from '../resolvers/ongoingMatch.resolver.js';

const typeDefs = mergeTypeDefs([
	playerTypeDef,
	courtTypeDef,
	settingsTypeDef,
	sessionTypeDef,
	gameTypeDef,
	paymentTypeDef,
	ongoingMatchTypeDef,
]);

const resolvers = mergeResolvers([
	playerResolver,
	courtResolver,
	settingsResolver,
	sessionResolver,
	gameResolver,
	paymentResolver,
	ongoingMatchResolver,
]);

const schema = makeExecutableSchema({
	typeDefs,
	resolvers,
});

export { typeDefs, resolvers, schema };
