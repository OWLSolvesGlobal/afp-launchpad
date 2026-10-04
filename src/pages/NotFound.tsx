import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";

const NotFound = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = "Page not found — Alo Fitness Pro";
    console.error("404: route not found:", pathname);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 flex items-center">
        <div className="container py-24 md:py-32">
          <div className="eyebrow text-graphite mb-6">404</div>
          <h1 className="display-lg max-w-2xl">Page not found</h1>
          <p className="mt-6 max-w-md text-graphite">
            The page you're after has moved or never existed. The collection,
            on the other hand, is right where you left it.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/"
              className="inline-flex items-center bg-ink text-bone px-8 py-4 eyebrow hover:bg-accent transition-colors"
            >
              Back home
            </Link>
            <Link
              to="/shop/women"
              className="inline-flex items-center border border-ink text-ink px-8 py-4 eyebrow hover:bg-ink hover:text-bone transition-colors"
            >
              Shop women
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default NotFound;
