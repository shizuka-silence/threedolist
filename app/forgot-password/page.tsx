import Link from "next/link";
import { Suspense } from "react";
import { requestPasswordReset } from "@/app/login/actions";
import { SendButton } from "./send-button";

type SearchParams = Promise<{ error?: string; message?: string }>;

async function Feedback({ searchParams }: { searchParams: SearchParams }) {
  const { error, message } = await searchParams;
  return (
    <>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {message && <p role="status" className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{message} Check your inbox (and spam).</p>}
      <SendButton sent={!!message} />
    </>
  );
}

export default function ForgotPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Reset password</h1>
      <form action={requestPasswordReset} className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          placeholder="Email"
          autoComplete="email"
          required
          className="h-12 rounded-md border bg-background px-3 text-base"
        />
        <Suspense fallback={<SendButton sent={false} />}>
          <Feedback searchParams={searchParams} />
        </Suspense>
        <Link href="/login" className="text-center text-sm text-muted-foreground underline underline-offset-2">Back to sign in</Link>
      </form>
    </main>
  );
}
