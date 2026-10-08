// PROVISIONAL MOCK entry point. Imported only by tests and by future dev-only tooling, never by app runtime code.
export { createProvisionalApi, sessionCookieName } from './server.ts';
export type { ProvisionalApi, ProvisionalApiOptions } from './server.ts';
export { mockPassword, mockRestrictedKeys, mockSecretMarkers, seedBlogPosts, seedCourses, seedRedeemCodes, seedUsers } from './seed.ts';
