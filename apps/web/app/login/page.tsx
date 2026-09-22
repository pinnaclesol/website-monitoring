'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { LoginForm } from '@uptime/ui';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | undefined>(undefined);

  async function handleSubmit(username: string, password: string) {
    setError(undefined);

    const result = await signIn('credentials', {
      username,
      password,
      redirect: false,
    });

    if (!result || result.error) {
      setError('Invalid username or password.');
      return;
    }

    router.push('/');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4">
      <LoginForm onSubmit={handleSubmit} error={error} />
    </main>
  );
}
