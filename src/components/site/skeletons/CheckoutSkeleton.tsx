import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { LogoLoader, ShimmerBlock } from "@/components/site/LogoLoader";

export function CheckoutSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="pt-20 md:pt-24 container pb-24 flex-1">
        <ShimmerBlock className="h-3 w-32 mb-6" />
        <ShimmerBlock className="h-10 w-56 mb-10" />
        <div className="grid lg:grid-cols-[1fr_380px] gap-8 lg:gap-12">
          <div className="space-y-8">
            <div className="space-y-3">
              <ShimmerBlock className="h-4 w-32" />
              <div className="grid grid-cols-2 gap-3">
                <ShimmerBlock className="h-20" />
                <ShimmerBlock className="h-20" />
              </div>
            </div>
            <div className="space-y-3">
              <ShimmerBlock className="h-4 w-40" />
              {Array.from({ length: 5 }).map((_, i) => (
                <ShimmerBlock key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
          <aside className="relative">
            <div className="border border-border rounded-lg p-6 space-y-4">
              <ShimmerBlock className="h-4 w-28" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <ShimmerBlock className="h-16 w-16" />
                  <div className="flex-1 space-y-2">
                    <ShimmerBlock className="h-3 w-3/4" />
                    <ShimmerBlock className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
              <div className="border-t border-border pt-4 space-y-2">
                <ShimmerBlock className="h-3 w-full" />
                <ShimmerBlock className="h-3 w-full" />
                <ShimmerBlock className="h-4 w-full" />
              </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <LogoLoader label="Preparing checkout" size="md" />
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}