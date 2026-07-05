import { AuthView } from "@neondatabase/auth-ui";
import { authViewPaths } from "@neondatabase/auth-ui/server";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }));
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="gb-grid-bg gb-mask-fade pointer-events-none fixed inset-0 -z-20" aria-hidden />
      <AuthView path={path} />
    </main>
  );
}
