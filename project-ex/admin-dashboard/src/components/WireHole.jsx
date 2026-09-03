import { useEffect, useRef } from "react";

// Number of wire rings that together outline the sphere.
const RING_COUNT = 26;
// Points sampled per ring — higher = smoother curve.
const SEGMENTS = 140;

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

// Mostly blue, with a handful of rings picking up green / violet / yellow
// as accents. `weight` controls how often each band gets picked.
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

export default function WireHole({ sphereRadius, onFrameSphereRadius, warp = false, focalBasis, onFrameIntensity }) {
  const canvasRef = useRef(null);
  const ringsRef = useRef([]);
  const rafRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0, cx: 0, cy: 0 });
  const focalRef = useRef(null);
  const lastPtsRef = useRef([]);
  const warpRef = useRef(warp);
  warpRef.current = warp;

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

    // Each ring is a circle of fixed 3D radius, tilted at its own random
    // axis (like an armillary sphere), with a high-frequency wobble along
    // its own path so it reads as a twisted wire rather than a smooth hoop.
    // All rings share one global spin so the whole thing reads as one
    // rotating sphere.
    ringsRef.current = Array.from({ length: RING_COUNT }, () => ({
      tiltX: rand(0, Math.PI),
      tiltY: rand(0, Math.PI),
      twists: Math.round(rand(4, 9)),
      twistAmp: rand(0.02, 0.07), // fraction of sphere radius
      phase: rand(0, Math.PI * 2),
      hue: randomHue(),
      baseWidth: rand(0.7, 1.8),
      spinSpeed: rand(0.15, 0.4),
    }));

    let t = 0;
    const globalSpin = { y: 0, x: 0 };

    const animate = () => {
      t += 1;
      const { w, h, cx, cy } = sizeRef.current;
      const R = onFrameSphereRadius ? onFrameSphereRadius() : sphereRadius;
      // Fixed on the first frame, using `focalBasis` if given (the sphere's
      // true resting radius) rather than the live R — otherwise, if R
      // happens to already be huge on the first frame (reverse tunnel entry
      // starting mid-warp), the focal length would lock onto that instead
      // of the resting size, flattening the 3D look once it settles down.
      if (focalRef.current === null) {
        const basis = focalBasis != null ? focalBasis : R;
        focalRef.current = basis * 3.2;
      }
      const focal = focalRef.current;

      ctx.fillStyle = "#04050a";
      ctx.fillRect(0, 0, w, h);

      // ambient glow behind the sphere
      const glow = ctx.createRadialGradient(cx, cy, R * 0.15, cx, cy, R * 3.6);
      glow.addColorStop(0, "rgba(90,120,255,0.15)");
      glow.addColorStop(0.5, "rgba(40,60,160,0.05)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      globalSpin.y += 0.0005;
      globalSpin.x = Math.sin(t * 0.0025) * 0.25; // gentle nod, not full tumble

      ctx.lineCap = "round";

      // Project every point of every ring first, so we can depth-sort and
      // draw back-to-front (far wires dimmer/behind, near wires bright/on top).
      const strokes = [];

      for (const ring of ringsRef.current) {
        const spin = t * 0.01 * ring.spinSpeed;
        const pts = [];
        let minZ = Infinity, maxZ = -Infinity;

        for (let s = 0; s <= SEGMENTS; s++) {
          const theta = (s / SEGMENTS) * Math.PI * 2;
          const twist = 1 + Math.sin(theta * ring.twists + ring.phase + t * 0.02) * ring.twistAmp;
          const r = R * twist;

          // base circle in its own local plane
          let p = { x: Math.cos(theta) * r, y: Math.sin(theta) * r, z: 0 };
          // tilt the ring's plane to its own random orientation
          p = rotateX(p, ring.tiltX);
          p = rotateY(p, ring.tiltY + spin);
          // apply the shared global sphere rotation
          p = rotateY(p, globalSpin.y);
          p = rotateX(p, globalSpin.x);

          minZ = Math.min(minZ, p.z);
          maxZ = Math.max(maxZ, p.z);
          pts.push(p);
        }

        const zRange = Math.max(maxZ - minZ, 1);
        const screenPts = pts.map((p) => {
          const scale = focal / (focal + p.z);
          return {
            x: cx + p.x * scale,
            y: cy + p.y * scale,
            depth: (p.z - minZ) / zRange, // 0 = nearest, 1 = farthest
          };
        });

        strokes.push({ pts: screenPts, hue: ring.hue, baseWidth: ring.baseWidth, avgZ: (minZ + maxZ) / 2 });
      }

      const isWarping = warpRef.current;
      // Temporal brightness envelope during warp — e.g. forward brightens
      // as it accelerates away, reverse dims as it decelerates back.
      // Defaults to 1 (no change) if the caller doesn't drive it.
      const intensity = onFrameIntensity ? onFrameIntensity() : 1;

      if (isWarping) {
        // Tunnel effect: instead of the ring outline, stretch each point
        // from where it was last frame to where it is now. Since the sphere
        // radius is being ramped up fast during the click-through animation,
        // every point is flying outward from the center — connecting last
        // frame's position to this frame's turns that motion into radial
        // light streaks, like flying through a tunnel/warp speed.
        //
        // TUNABLE: fewer/more streaks
        //   - RING_STRIDE below: higher number = fewer wires drawn (skips rings)
        //   - POINT_STRIDE below: higher number = fewer streak segments per wire
        const RING_STRIDE = 2;   // draw only every 2nd ring
        const POINT_STRIDE = 6;  // sample every 6th point along each ring

        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";

        strokes.forEach((stroke, idx) => {
          const prev = lastPtsRef.current[idx];
          const pts = stroke.pts;

          if (idx % RING_STRIDE === 0 && prev && prev.length === pts.length) {
            for (let i = 0; i < pts.length; i += POINT_STRIDE) {
              const a = prev[i];
              const b = pts[i];
              const dx = b.x - a.x, dy = b.y - a.y;
              const dist = Math.hypot(dx, dy);
              if (dist < 1.5) continue; // skip near-static points, keep streaks clean

              const near = 1 - b.depth;
              // TUNABLE: lower these two numbers for a dimmer/calmer tunnel
              const alpha = Math.min(0.55, 0.08 + near * 0.35) * intensity;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.strokeStyle = `hsla(${stroke.hue}, 90%, ${55 + near * 15}%, ${alpha})`;
              ctx.lineWidth = stroke.baseWidth * (0.5 + near * 1.1);
              ctx.stroke();
            }
          }
          lastPtsRef.current[idx] = pts;
        });

        ctx.globalCompositeOperation = "source-over";
      } else {
        // draw far rings first so near rings visually sit "in front"
        strokes.sort((a, b) => b.avgZ - a.avgZ);

        ctx.globalCompositeOperation = "lighter";
        strokes.forEach((stroke, idx) => {
          const pts = stroke.pts;
          for (let i = 1; i < pts.length; i++) {
            const near = 1 - pts[i].depth; // 1 = closest to camera
            const alpha = 0.12 + near * 0.7;
            ctx.beginPath();
            ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
            ctx.lineTo(pts[i].x, pts[i].y);
            ctx.strokeStyle = `hsla(${stroke.hue}, 95%, ${60 + near * 20}%, ${alpha})`;
            ctx.lineWidth = stroke.baseWidth * (0.5 + near * 0.9);
            ctx.stroke();
          }
          lastPtsRef.current[idx] = pts;
        });
        ctx.globalCompositeOperation = "source-over";
      }

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