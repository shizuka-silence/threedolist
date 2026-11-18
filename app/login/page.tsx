import Link from "next/link";
import { Suspense } from "react";
import { SubmitButton } from "@/components/submit-button";
import { signIn, signUp } from "./actions";

type SearchParams = Promise<{ error?: string; message?: string }>;

// searchParams is runtime data, so it is read inside Suspense to keep the form in the static shell.
async function Feedback({ searchParams }: { searchParams: SearchParams }) {
  const { error, message } = await searchParams;
  return (
    <>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    </>
  );
}

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">ThreeDoList</h1>
      <form className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          placeholder="Email"
          autoComplete="email"
          required
          className="h-12 rounded-md border bg-background px-3 text-base"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          minLength={6}
          required
          className="h-12 rounded-md border bg-background px-3 text-base"
        />
        <Suspense>
          <Feedback searchParams={searchParams} />
        </Suspense>
        <SubmitButton formAction={signIn} size="lg" pendingLabel="Signing in…">Sign in</SubmitButton>
        <SubmitButton formAction={signUp} size="lg" variant="outline" pendingLabel="Signing up…">Sign up</SubmitButton>
        <Link href="/forgot-password" className="text-center text-sm text-muted-foreground underline underline-offset-2">Forgot password?</Link>
      </form>
    </main>
  );
}
