'use client';

import * as React from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { cn } from '../lib/cn';

export interface LoginFormProps {
  /** Called with the entered credentials on submit. Wire this up to NextAuth (or similar) in `apps/web`. */
  onSubmit: (username: string, password: string) => Promise<void> | void;
  /** Server/validation error to surface above the submit button. */
  error?: string;
  className?: string;
}

/**
 * Presentational, controlled login form. Owns only its own field state and
 * submit-in-flight state — auth wiring (NextAuth, redirects, session) is the
 * caller's responsibility.
 */
function LoginForm({ onSubmit, error, className }: LoginFormProps) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(username, password);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className={cn('w-full max-w-sm', className)}>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Enter your credentials to access the dashboard.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-username" className="text-sm font-medium text-text">
              Username
            </label>
            <Input
              id="login-username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-password" className="text-sm font-medium text-text">
              Password
            </label>
            <Input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>
          {error ? (
            <p
              role="alert"
              className="rounded border border-red-border bg-red-bg px-3 py-2 text-sm text-red"
            >
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export { LoginForm };
