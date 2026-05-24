import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { TopBar } from "@/components/layout/TopBar";
import { SWRProvider } from "@/components/providers/SWRProvider";
import { AuthGuard } from "@/components/layout/AuthGuard";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SWRProvider>
      <div className="flex h-full min-h-screen bg-ink">
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <TopBar />
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0 px-4 py-4 md:px-6 md:py-6">
            <AuthGuard>{children}</AuthGuard>
          </main>
        </div>
        <BottomNav />
      </div>
    </SWRProvider>
  );
}
