import { useEffect } from "react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Hero } from "@/components/site/Hero";
import { CategoryTiles } from "@/components/site/CategoryTiles";
import { FeaturedCarousel } from "@/components/site/FeaturedCarousel";
import { InstagramGrid } from "@/components/site/InstagramGrid";
import { EmailCapture } from "@/components/site/EmailCapture";
import { LifestyleStrip } from "@/components/site/LifestyleStrip";

const Index = () => {
  useEffect(() => {
    document.title = "Alo Fitness Pro — Built for the life you live";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "Performance fitness apparel for women and men. Seamless sets, rompers, golf dresses, training tees. Designed by Alo Fitness Pro. Shipped worldwide."
      );
    }
  }, []);

  return (
    <div className="bg-background text-foreground">
      <Header />
      <main id="main">
        <Hero />
        <CategoryTiles />
        <FeaturedCarousel />
        <LifestyleStrip />
        <InstagramGrid />
        <EmailCapture />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
