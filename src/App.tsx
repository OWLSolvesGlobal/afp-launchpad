import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/context/CartContext";
import { CartDrawer } from "@/components/site/CartDrawer";
import { ScrollToTop } from "@/components/site/ScrollToTop";
import { RouteProgress } from "@/components/site/RouteProgress";
import { LogoLoader } from "@/components/site/LogoLoader";

// The landing page is eager — it's the first paint for most visitors and
// should never wait on an extra network round-trip.
import Index from "./pages/Index.tsx";

// Everything else is split out. This keeps the storefront bundle small:
// the 3D-heavy 404 page and the whole admin panel no longer ship to shoppers.
const Shop = lazy(() => import("./pages/Shop.tsx"));
const Collection = lazy(() => import("./pages/Collection.tsx"));
const ProductDetail = lazy(() => import("./pages/ProductDetail.tsx"));
const Checkout = lazy(() => import("./pages/Checkout.tsx"));
const About = lazy(() => import("./pages/About.tsx"));
const Contact = lazy(() => import("./pages/Contact.tsx"));
const FAQ = lazy(() => import("./pages/FAQ.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient();

function RouteFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <LogoLoader label="Loading" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <CartProvider>
          <ScrollToTop />
          <RouteProgress />
          {/* Skip link for keyboard / screen reader users (WCAG 2.4.1) */}
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:bg-ink focus:text-bone focus:px-4 focus:py-2 focus:eyebrow focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-bone"
          >
            Skip to main content
          </a>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/shop/:gender" element={<Shop />} />
              <Route path="/collection/:slug" element={<Collection />} />
              <Route path="/product/:slug" element={<ProductDetail />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/faq" element={<FAQ />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <CartDrawer />
        </CartProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
