import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@uptime/ui';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Welcome, {session?.user.username}</CardTitle>
        <CardDescription>You're signed in to the uptime monitor dashboard.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-text-muted">
          Monitor data, incidents, and notification settings will appear here.
        </p>
      </CardContent>
    </Card>
  );
}
