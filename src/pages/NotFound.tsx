import { Suspense, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment, ContactShadows, Html, OrbitControls } from "@react-three/drei";
import { motion } from "framer-motion";
import * as THREE from "three";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";

/* ─────────────────────────────────────────────
   3D PIECES — abstract apparel + gear shapes
   ───────────────────────────────────────────── */

function FoldedTee({ color = "#0A0A0A" }: { color?: string }) {
  return (
    <group>
      {/* Body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.25, 1.2]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* Folded sleeve indent */}
      <mesh position={[0, 0.13, 0]} castShadow>
        <boxGeometry args={[1.55, 0.02, 0.4]} />
        <meshStandardMaterial color="#FAFAFA" roughness={0.6} />
      </mesh>
    </group>
  );
}

function Sneaker({ color = "#FAFAFA" }: { color?: string }) {
  return (
    <group rotation={[0, 0.4, 0]}>
      {/* Sole */}
      <mesh position={[0, -0.15, 0]} castShadow>
        <boxGeometry args={[1.4, 0.18, 0.55]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
      </mesh>
      {/* Upper */}
      <mesh position={[-0.05, 0.05, 0]} castShadow>
        <boxGeometry args={[1.2, 0.35, 0.5]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {/* Toe */}
      <mesh position={[0.55, 0, 0]} castShadow>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {/* Tongue */}
      <mesh position={[-0.2, 0.28, 0]} rotation={[0, 0, -0.2]} castShadow>
        <boxGeometry args={[0.4, 0.18, 0.4]} />
        <meshStandardMaterial color="#FF6A2C" roughness={0.6} />
      </mesh>
    </group>
  );
}

function Dumbbell() {
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.08, 0.08, 1.4, 24]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.7} roughness={0.3} />
      </mesh>
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[0, x, 0]} castShadow>
          <cylinderGeometry args={[0.4, 0.4, 0.3, 32]} />
          <meshStandardMaterial color="#0A0A0A" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function WaterBottle() {
  return (
    <group>
      <mesh castShadow>
        <cylinderGeometry args={[0.25, 0.28, 1.2, 32]} />
        <meshStandardMaterial color="#FF6A2C" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.2, 24]} />
        <meshStandardMaterial color="#0A0A0A" roughness={0.5} />
      </mesh>
    </group>
  );
}

function Cap() {
  return (
    <group>
      <mesh castShadow>
        <sphereGeometry args={[0.55, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#0A0A0A" roughness={0.7} />
      </mesh>
      <mesh position={[0.5, -0.05, 0]} rotation={[0, 0, -0.2]} castShadow>
        <boxGeometry args={[0.6, 0.05, 0.7]} />
        <meshStandardMaterial color="#0A0A0A" roughness={0.7} />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────
   FLOATING ORBIT — items revolve around center
   ───────────────────────────────────────────── */

function OrbitingItem({
  radius,
  speed,
  yOffset = 0,
  startAngle = 0,
  children,
}: {
  radius: number;
  speed: number;
  yOffset?: number;
  startAngle?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed + startAngle;
    ref.current.position.x = Math.cos(t) * radius;
    ref.current.position.z = Math.sin(t) * radius;
    ref.current.position.y = yOffset + Math.sin(t * 1.3) * 0.15;
    ref.current.rotation.y = -t;
  });
  return (
    <group ref={ref}>
      <Float speed={2} rotationIntensity={0.4} floatIntensity={0.5}>
        {children}
      </Float>
    </group>
  );
}

/* ─────────────────────────────────────────────
   CENTER CONE = construction marker
   ───────────────────────────────────────────── */

function ConstructionCone() {
  const ref = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    ref.current.rotation.y = clock.getElapsedTime() * 0.4;
  });
  return (
    <group ref={ref}>
      {/* Cone body */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <coneGeometry args={[0.55, 1.2, 32]} />
        <meshStandardMaterial color="#FF6A2C" roughness={0.5} />
      </mesh>
      {/* Reflective stripe */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <coneGeometry args={[0.42, 0.18, 32]} />
        <meshStandardMaterial color="#FAFAFA" roughness={0.3} />
      </mesh>
      {/* Base */}
      <mesh position={[0, -0.2, 0]} castShadow>
        <boxGeometry args={[1, 0.12, 1]} />
        <meshStandardMaterial color="#0A0A0A" roughness={0.7} />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────
   SCENE
   ───────────────────────────────────────────── */

function Scene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-5, 3, -5]} intensity={0.4} color="#FF6A2C" />

      <ConstructionCone />

      <OrbitingItem radius={2.4} speed={0.5} yOffset={0.3} startAngle={0}>
        <FoldedTee color="#0A0A0A" />
      </OrbitingItem>
      <OrbitingItem radius={2.4} speed={0.5} yOffset={0.6} startAngle={Math.PI * 0.4}>
        <Sneaker color="#FAFAFA" />
      </OrbitingItem>
      <OrbitingItem radius={2.4} speed={0.5} yOffset={0.2} startAngle={Math.PI * 0.8}>
        <Dumbbell />
      </OrbitingItem>
      <OrbitingItem radius={2.4} speed={0.5} yOffset={0.5} startAngle={Math.PI * 1.2}>
        <WaterBottle />
      </OrbitingItem>
      <OrbitingItem radius={2.4} speed={0.5} yOffset={0.4} startAngle={Math.PI * 1.6}>
        <Cap />
      </OrbitingItem>

      <ContactShadows position={[0, -0.55, 0]} opacity={0.4} scale={10} blur={2.5} far={4} />
      <Environment preset="studio" />
    </>
  );
}

/* ─────────────────────────────────────────────
   PAGE
   ───────────────────────────────────────────── */

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.warn("Under-construction route hit:", location.pathname);
    document.title = "Under Construction — AFP";
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />

      <main id="main" className="flex-1 pt-24 md:pt-28">
        <section className="relative overflow-hidden">
          {/* 3D Canvas */}
          <div className="relative h-[60vh] md:h-[72vh] bg-gradient-to-b from-[hsl(var(--sand))] to-bone">
            <Canvas
              shadows
              camera={{ position: [0, 2.4, 6.5], fov: 38 }}
              dpr={[1, 1.6]}
              gl={{ antialias: true }}
            >
              <Suspense
                fallback={
                  <Html center>
                    <div className="font-stencil uppercase text-xs tracking-widest text-graphite">
                      Loading scene…
                    </div>
                  </Html>
                }
              >
                <Scene />
              </Suspense>
              <OrbitControls
                enableZoom={false}
                enablePan={false}
                autoRotate
                autoRotateSpeed={0.4}
                minPolarAngle={Math.PI / 3}
                maxPolarAngle={Math.PI / 2.1}
              />
            </Canvas>

            {/* Floating chip */}
            <div className="absolute top-6 left-6 md:top-10 md:left-10 flex items-center gap-2 bg-ink text-bone px-3 py-1.5 font-stencil uppercase text-[10px] tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-safety animate-pulse" />
              Live build · drag to spin
            </div>

            {/* Route badge */}
            <div className="absolute top-6 right-6 md:top-10 md:right-10 max-w-[60%] truncate bg-bone/90 backdrop-blur border border-border text-ink px-3 py-1.5 font-stencil uppercase text-[10px] tracking-widest">
              {location.pathname}
            </div>
          </div>

          {/* Copy block */}
          <div className="container py-12 md:py-20 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="eyebrow text-safety mb-4">— Under Construction</div>
              <h1 className="font-display text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight mb-6">
                Stitching this one<br />
                <span className="italic font-light">together.</span>
              </h1>
              <p className="max-w-xl mx-auto text-base md:text-lg text-graphite leading-relaxed mb-10">
                This page is currently in the workshop. Our team is sweating the details
                so it lands as sharp as the rest of AFP. In the meantime, keep moving —
                there's plenty more to explore.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/"
                  className="bg-ink text-bone px-8 py-4 eyebrow hover:bg-safety hover:text-bone transition-colors"
                >
                  Back to Home
                </Link>
                <Link
                  to="/shop/women"
                  className="border border-ink text-ink px-8 py-4 eyebrow hover:bg-ink hover:text-bone transition-colors"
                >
                  Shop Women
                </Link>
                <Link
                  to="/shop/men"
                  className="border border-ink text-ink px-8 py-4 eyebrow hover:bg-ink hover:text-bone transition-colors"
                >
                  Shop Men
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default NotFound;
