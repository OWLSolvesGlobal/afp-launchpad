import { useEffect } from "react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Hero } from "@/components/site/Hero";
import { CategoryTiles } from "@/components/site/CategoryTiles";
import { FeaturedCarousel } from "@/components/site/FeaturedCarousel";
import { InstagramGrid } from "@/components/site/InstagramGrid";
import { EmailCapture } from "@/components/site/EmailCapture";

const Index = () => {
  useEffect(() => {
    document.title = "Alo Fitness Pro — Iron Over Everything";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "Strength-built apparel for the rack, the platform, and everything in between. Lifting tees, squat shorts, seamless sets, accessories. Shipped worldwide."
      );
    }
  }, []);

  return (
    <div className="bg-background text-foreground">
      <Header transparent />
      <main>
        <Hero />
        <CategoryTiles />
        <FeaturedCarousel />
        <InstagramGrid />
        <EmailCapture />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
