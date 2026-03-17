import { Navbar } from "@/components/navbar";
import { ModeToggle } from "@/components/mode-toggle";
import { MobileNav } from "@/components/mobile-nav";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex justify-between items-center p-2 sm:p-4 border-b border-border bg-header-background">
        <MobileNav />
        <Navbar />
        <div className="flex items-center gap-2">
          <ModeToggle />
        </div>
      </header>
      <main className="flex flex-col items-center justify-start min-h-[calc(100vh-80px)] space-y-8 p-4 md:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
