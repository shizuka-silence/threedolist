import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { updatePassword } from "@/app/login/actions";

type SearchParams = Promise<{ error?: string }>;

async function Feedback({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  return error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null;
}

export default function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const field = "h-12 rounded-md border bg-background px-3 text-base";
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <form action={updatePassword} className="flex flex-col gap-3">
        <input name="password" type="password" placeholder="New password" autoComplete="new-password" minLength={6} required className={field} />
        <input name="confirm" type="password" placeholder="Confirm new password" autoComplete="new-password" minLength={6} required className={field} />
        <Suspense>
          <Feedback searchParams={searchParams} />
        </Suspense>
        <Button type="submit" size="lg">Save password</Button>
      </form>
    </main>
  );
}
