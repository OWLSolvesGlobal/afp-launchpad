import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { LogoLoader, ShimmerBlock } from "@/components/site/LogoLoader";

export function ShopSkeleton({ isWomen }: { isWomen: boolean }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <section className="pt-20 md:pt-24 pb-8 md:pb-12">
        <div className="container">
          <div className="eyebrow text-graphite mb-3">
            Shop / {isWomen ? "Women" : "Men"}
          </div>
          <ShimmerBlock className="h-12 md:h-16 w-40 md:w-56" />
          <ShimmerBlock className="h-4 w-72 max-w-full mt-4" />
        </div>
      </section>

      <main className="container pb-24 flex flex-col lg:flex-row gap-8 lg:gap-12 flex-1">
        <aside className="hidden lg:block w-60 shrink-0 space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <ShimmerBlock className="h-3 w-20" />
              <ShimmerBlock className="h-3 w-full" />
              <ShimmerBlock className="h-3 w-5/6" />
              <ShimmerBlock className="h-3 w-3/4" />
            </div>
          ))}
        </aside>

        <section className="flex-1">
          <div className="relative">
            <div className="absolute inset-x-0 -top-4 z-10 flex justify-center pointer-events-none">
              <LogoLoader label="Loading shop" size="md" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5 opacity-60">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <ShimmerBlock className="aspect-[3/4] w-full" />
                  <ShimmerBlock className="h-3 w-3/4" />
                  <ShimmerBlock className="h-3 w-1/3" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}