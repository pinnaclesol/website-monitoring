import type { DefaultSession, DefaultUser } from 'next-auth';
import type { DefaultJWT } from 'next-auth/jwt';
import type { RoleSummary } from '@uptime/auth';

// Module augmentation for NextAuth v4: this app's session holds
// `{ id, username, name, roles, permissions }` — fully flexible RBAC. A
// user can hold multiple roles; `permissions` is the already-flattened,
// deduped union of every permission granted by any of them (computed
// server-side in apps/api's AuthService, never trusted from the client
// beyond UI button-gating — the real enforcement is apps/api's
// PermissionGuard re-resolving this fresh from the DB on every request).
declare module 'next-auth' {
  interface User extends DefaultUser {
    username: string;
    name: string | null;
    roles: RoleSummary[];
    permissions: string[];
  }

  interface Session {
    user: {
      id: string;
      username: string;
      name: string | null;
      roles: RoleSummary[];
      permissions: string[];
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    username: string;
    name: string | null;
    roles: RoleSummary[];
    permissions: string[];
  }
}
