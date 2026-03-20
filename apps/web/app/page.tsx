// apps/web/app/page.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();
  const user = session?.user;

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-8 px-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-2">Type Arena</h1>
        <p className="text-gray-400 text-lg">Competitive typing. Pure speed.</p>
        <span className="inline-block mt-2 px-3 py-1 text-xs bg-yellow-900/50 text-yellow-400 rounded-full">
          Closed Beta
        </span>
        {user && (
          <p className="mt-3 text-gray-400 text-sm">
            Welcome back, <span className="text-white font-semibold">{user.name}</span>
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link href="/practice">
          <Button className="w-full text-lg py-4">Practice as Guest</Button>
        </Link>

        {user ? (
          <Link href="/ranked">
            <Button variant="secondary" className="w-full">Ranked</Button>
          </Link>
        ) : (
          <Link href="/auth">
            <Button variant="secondary" className="w-full">
              Ranked <span className="text-gray-500 text-xs ml-1">(Sign in)</span>
            </Button>
          </Link>
        )}

        <Button variant="secondary" disabled className="w-full" title="Coming soon">
          Create Private Room
        </Button>
        <Button variant="ghost" disabled className="w-full" title="Coming soon">
          Join by Code
        </Button>
      </div>
    </main>
  );
}
