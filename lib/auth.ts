import { betterAuth } from "better-auth";
import { after } from "next/server";
import { roomEqAuthAdapter } from "./room-eq-auth-adapter";
import { sendPasswordResetEmail } from "./email";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export function createRoomEqAuth() {
  const auth = betterAuth({
    appName: "Room EQ Assistant",
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: roomEqAuthAdapter(),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: ({ user, url }) =>
        sendPasswordResetEmail({ to: user.email, resetUrl: url }),
    },
    socialProviders:
      googleClientId && googleClientSecret
        ? {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
            },
          }
        : {},
    user: { modelName: "room_eq_auth_user" },
    session: {
      modelName: "room_eq_auth_session",
      cookieCache: {
        enabled: true,
        maxAge: 30 * 60,
        strategy: "compact",
      },
    },
    account: { modelName: "room_eq_auth_account" },
    verification: { modelName: "room_eq_auth_verification" },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "room_eq_auth_rate_limit",
    },
    advanced: {
      database: { generateId: "uuid" },
      useSecureCookies: process.env.NODE_ENV === "production",
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      backgroundTasks: {
        handler: (promise) => after(promise),
      },
    },
  });
  return auth;
}

export type RoomEqUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
};
