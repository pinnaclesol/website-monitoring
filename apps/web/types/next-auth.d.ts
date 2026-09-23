import type { DefaultSession, DefaultUser } from 'next-auth';
import type { DefaultJWT } from 'next-auth/jwt';
import type { Role } from '@uptime/auth';

// Module augmentation for NextAuth v4: this app's session holds
// `{ id, username, role }` — fixed-role RBAC (ADMIN/EDITOR/VIEWER), no
// custom/flexible roles or per-user permission overrides.
declare module 'next-auth' {
  interface User extends DefaultUser {
    username: string;
    name: string | null;
    role: Role;
  }

  interface Session {
    user: {
      id: string;
      username: string;
      name: string | null;
      role: Role;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    username: string;
    name: string | null;
    role: Role;
  }
}
