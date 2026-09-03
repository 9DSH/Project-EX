import { useEffect, useRef } from "react";

// Number of wire rings that together outline the sphere.
const RING_COUNT = 26;
// Points sampled per ring — higher = smoother curve.
const SEGMENTS = 180;

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

// Same palette as WireHole: deep blue dominant, violet + steel-blue accents.
const HUE_BANDS = [
  { range: [215, 240], weight: 6 }, // deep blue — dominant
  { range: [255, 280], weight: 2 }, // violet accent
  { range: [190, 210], weight: 1 }, // steel-blue accent
];

function randomHue() {
  const total = HUE_BANDS.reduce((sum, b) => sum + b.weight, 0);
  let pick = Math.random() * total;
  for (const band of HUE_BANDS) {
    if (pick < band.weight) return rand(band.range[0], band.range[1]);
    pick -= band.weight;
  }
  return rand(HUE_BANDS[0].range[0], HUE_BANDS[0].range[1]);
}

// Rotate a 3D point around the X axis.
function rotateX(p, a) {
  const cos = Math.cos(a), sin = Math.sin(a);
  return { x: p.x, y: p.y * cos - p.z * sin, z: p.y * sin + p.z * cos };
}
// Rotate a 3D point around the Y axis.
function rotateY(p, a) {
  const cos = Math.cos(a), sin = Math.sin(a);
  return { x: p.x * cos + p.z * sin, y: p.y, z: -p.x * sin + p.z * cos };
}

/**
 * Same wire-sphere construction as WireHole, but meant to be viewed from
 * the inside: only the far hemisphere of every ring is drawn (the near
 * side, which would sit between the camera and the sphere's center, is
 * culled), and everything spins much slower for an ambient background.
 */
export default function WireHoleInside({ sphereRadius }) {
  const canvasRef = useRef(null);
  const ringsRef = useRef([]);
  const rafRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0, cx: 0, cy: 0 });
  const focalRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h, cx: w / 2, cy: h / 2 };
    };
    resize();
    window.addEventListener("resize", resize);

    ringsRef.current = Array.from({ length: RING_COUNT }, () => ({
      tiltX: rand(0, Math.PI),
      tiltY: rand(0, Math.PI),
      twists: Math.round(rand(4, 9)),
      twistAmp: rand(0.02, 0.07),
      phase: rand(0, Math.PI * 2),
      hue: randomHue(),
      baseWidth: rand(0.7, 1.8),
      // much slower per-ring spin than the landing-page sphere
      spinSpeed: rand(0.03, 0.08),
    }));

    let t = 0;
    const globalSpin = { y: 0, x: 0 };

    const animate = () => {
      t += 1;
      const { w, h, cx, cy } = sizeRef.current;
      const R = sphereRadius;
      // Smaller multiplier = camera closer to (or inside) the sphere =
      // stronger fisheye distortion = the far wall bows toward you at the
      // edges like the inside of a dome, instead of curving away like a
      // distant ball seen from outside. Try values between ~0.3 and 0.8.
      if (focalRef.current === null) focalRef.current = R * 0.55;
      const focal = focalRef.current;

      ctx.fillStyle = "#04050a";
      ctx.fillRect(0, 0, w, h);

      const glow = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 2.2);
      glow.addColorStop(0, "rgba(70, 95, 220, 0.27)");
      glow.addColorStop(0.6, "rgba(30, 45, 120, 0.2)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // much slower global rotation than the landing sphere
      globalSpin.y += 0.0016;
      globalSpin.x = Math.sin(t * 0.0007) * 0.2;

      ctx.lineCap = "round";

      const strokes = [];

      for (const ring of ringsRef.current) {
        const spin = t * 0.01 * ring.spinSpeed;
        const pts = [];
        let minZ = Infinity, maxZ = -Infinity;

        for (let s = 0; s <= SEGMENTS; s++) {
          const theta = (s / SEGMENTS) * Math.PI * 2;
          const twist = 1 + Math.sin(theta * ring.twists + ring.phase + t * 0.008) * ring.twistAmp;
          const r = R * twist;

          let p = { x: Math.cos(theta) * r, y: Math.sin(theta) * r, z: 0 };
          p = rotateX(p, ring.tiltX);
          p = rotateY(p, ring.tiltY + spin);
          p = rotateY(p, globalSpin.y);
          p = rotateX(p, globalSpin.x);

          minZ = Math.min(minZ, p.z);
          maxZ = Math.max(maxZ, p.z);
          pts.push(p);
        }

        const zRange = Math.max(maxZ - minZ, 1);
        const screenPts = pts.map((p) => {
          // Clamp so points that swing close to the focal plane (now that
          // the camera sits near the sphere) don't divide by ~0 and flip
          // to the wrong side of the screen.
          const denom = Math.max(focal + p.z, focal * 0.15);
          return {
            x: cx + (p.x * focal) / denom,
            y: cy + (p.y * focal) / denom,
            depth: (p.z - minZ) / zRange, // 0 = nearest, 1 = farthest
          };
        });

        strokes.push({ pts: screenPts, hue: ring.hue, baseWidth: ring.baseWidth });
      }

      ctx.globalCompositeOperation = "lighter";
      for (const stroke of strokes) {
        const pts = stroke.pts;
        for (let i = 1; i < pts.length; i++) {
          // Only draw the far hemisphere — the near side (which would sit
          // between the camera and the sphere's center when viewed from
          // inside) is culled so we only ever see the "back" of the sphere.
          const a = pts[i - 1];
          const b = pts[i];
          if (a.depth < 0.5 || b.depth < 0.5) continue;

          const far = b.depth; // 0.5..1, higher = further into the back
          const alpha = 0.06 + far * 0.48;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `hsla(${stroke.hue}, 85%, ${45 + far * 15}%, ${alpha})`;
          ctx.lineWidth = stroke.baseWidth * (0.4 + far * 0.5);
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = "source-over";

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className="wire-canvas" />;
}