import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import limeRomper from "@/assets/afp-lime-romper.jpg";
import golfDress from "@/assets/afp-golf-dress.jpg";

export const Hero = () => {
  return (
    <section className="relative bg-background pt-20 md:pt-24 pb-12 md:pb-20 overflow-hidden">
      <div className="container">
        {/* Eyebrow row */}
        <div className="flex items-center justify-between mb-6 md:mb-10">
          <span className="eyebrow text-graphite">SS26 — In Motion</span>
          <span className="eyebrow text-graphite hidden sm:block">@alofitnesspro</span>
        </div>

        {/* Editorial headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="display-xl text-foreground max-w-[14ch]"
        >
          Built for the<br />
          <em className="italic font-serif text-graphite/70">life you live.</em>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 md:mt-10 grid md:grid-cols-12 gap-6 md:gap-8 items-end"
        >
          <p className="md:col-span-5 text-base md:text-lg text-graphite max-w-md leading-relaxed">
            Performance fits engineered for the gym, the green, the pool deck.
            Worn by women and men who don't sit still.
          </p>

          <div className="md:col-span-4 md:col-start-9 flex flex-col sm:flex-row gap-3">
            <Button asChild variant="afp-primary" size="afp" className="group flex-1 justify-between">
              <Link to="/shop/women">
                Shop Women
                <ArrowUpRight className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button asChild variant="afp-outline" size="afp" className="group flex-1 justify-between">
              <Link to="/shop/men">
                Shop Men
                <ArrowUpRight className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </Button>
          </div>
        </motion.div>

        {/* Twin lifestyle imagery */}
        <div className="mt-10 md:mt-16 grid grid-cols-12 gap-3 md:gap-5">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="col-span-7 md:col-span-7 relative aspect-[4/5] md:aspect-[3/4] overflow-hidden bg-[hsl(var(--sand))]"
          >
            <img
              src={limeRomper}
              alt="AFP athlete in lime green seamless romper"
              fetchPriority="high"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 flex items-end justify-between text-background">
              <div>
                <div className="eyebrow text-background/80 mb-1">01 / Womens</div>
                <div className="font-serif text-2xl md:text-4xl leading-none">The Romper</div>
              </div>
              <Link
                to="/shop/women"
                className="hidden md:inline-flex w-12 h-12 items-center justify-center bg-background text-foreground hover:bg-[hsl(var(--lime))] transition-colors"
                aria-label="Shop the romper"
              >
                <ArrowUpRight className="w-5 h-5" />
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="col-span-5 md:col-span-5 relative aspect-[4/5] md:aspect-[3/4] overflow-hidden bg-[hsl(var(--sand))] mt-8 md:mt-16"
          >
            <img
              src={golfDress}
              alt="AFP athlete in navy golf dress on the green"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 flex items-end justify-between text-background">
              <div>
                <div className="eyebrow text-background/80 mb-1">02 / On the Green</div>
                <div className="font-serif text-xl md:text-3xl leading-none">The Dress</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
