import type { DefaultSession, DefaultUser } from 'next-auth';
import type { DefaultJWT } from 'next-auth/jwt';

// Module augmentation for NextAuth v4: this app's session holds only
// `{ id, username }` — no roles/permissions (single admin, unlike billing-manager).
declare module 'next-auth' {
  interface User extends DefaultUser {
    username: string;
  }

  interface Session {
    user: {
      id: string;
      username: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    username: string;
  }
}
