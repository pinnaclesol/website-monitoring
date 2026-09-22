import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

/** Shape returned by apps/api's `POST /api/auth/validate` on success. */
interface ValidateResponse {
  id: string;
  username: string;
}

/**
 * The single unauthenticated route on `apps/api` — no INTERNAL_API_KEY
 * header needed here (every other apps/api route requires it, this one
 * doesn't). Every other future data need from apps/web must go through a
 * Next.js API route under app/api/* that proxies to apps/api with that
 * header; this direct fetch is the one documented exception.
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const res = await fetch(`${process.env.API_URL}/api/auth/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: credentials.username,
            password: credentials.password,
          }),
        });

        if (!res.ok) {
          return null;
        }

        const user: ValidateResponse = await res.json();
        return { id: user.id, username: user.username };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.username = token.username;
      }
      return session;
    },
  },
};
