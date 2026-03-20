// apps/web/app/page.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-8 px-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-2">
          Type Arena
        </h1>
        <p className="text-gray-400 text-lg">
          Competitive typing. Pure speed.
        </p>
        <span className="inline-block mt-2 px-3 py-1 text-xs bg-yellow-900/50 text-yellow-400 rounded-full">
          Closed Beta
        </span>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link href="/practice">
          <Button className="w-full text-lg py-4">
            Practice as Guest
          </Button>
        </Link>

        <Button variant="secondary" disabled className="w-full" title="Coming soon">
          Ranked
        </Button>

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
