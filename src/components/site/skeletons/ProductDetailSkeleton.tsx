import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { LogoLoader, ShimmerBlock } from "@/components/site/LogoLoader";

export function ProductDetailSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />
      <main className="pt-20 md:pt-24 container pb-24 flex-1">
        <ShimmerBlock className="h-3 w-48 mb-6" />
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          <div className="relative">
            <ShimmerBlock className="aspect-[4/5] w-full" />
            <div className="absolute inset-0 flex items-center justify-center">
              <LogoLoader label="Loading product" size="lg" />
            </div>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <ShimmerBlock key={i} className="aspect-square" />
              ))}
            </div>
          </div>
          <div className="space-y-5">
            <ShimmerBlock className="h-4 w-24" />
            <ShimmerBlock className="h-10 w-3/4" />
            <ShimmerBlock className="h-6 w-24" />
            <div className="space-y-2 pt-4">
              <ShimmerBlock className="h-3 w-16" />
              <div className="flex gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <ShimmerBlock key={i} className="h-10 w-10 rounded-full" />
                ))}
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <ShimmerBlock className="h-3 w-16" />
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <ShimmerBlock key={i} className="h-12" />
                ))}
              </div>
            </div>
            <ShimmerBlock className="h-14 w-full mt-4" />
            <div className="grid grid-cols-3 gap-3 pt-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <ShimmerBlock key={i} className="h-16" />
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}