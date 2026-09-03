import { useEffect, useRef, useState } from "react";
import WireHole from "../components/WireHole.jsx";
import "./Landing.css";

export default function Landing({ onEnter, reverseEntry = false }) {
  const [expanding, setExpanding] = useState(false);
  const [entering, setEntering] = useState(reverseEntry);
  // Plays after a fresh landing load AND after the reverse tunnel finishes
  // shrinking — either way, the sphere blooms from a point at the center
  // up to its resting size.
  const [growingIn, setGrowingIn] = useState(!reverseEntry);
  const [hovering, setHovering] = useState(false);
  const rafRef = useRef(null);
  const hoverRafRef = useRef(null);
  const restRadiusRef = useRef(null);
  const sphereRadiusRef = useRef(null);
  const hoveringRef = useRef(false);
  const expandingRef = useRef(false);
  const enteringRef = useRef(reverseEntry);
  const growingInRef = useRef(!reverseEntry);
  const intensityRef = useRef(1);

  // TUNABLE: how small the "point" the sphere blooms from is, as a
  // fraction of the resting radius. Used both on a fresh landing load and
  // as the target the reverse tunnel shrinks down to before blooming.
  const GROW_START_FRACTION = 0.04;

  // Computed synchronously during render (not inside an effect) so the
  // correct values already exist the moment WireHole mounts as a child —
  // child effects run before parent effects, so anything set in a Landing
  // useEffect would arrive one frame too late for WireHole's first paint.
  if (restRadiusRef.current === null) {
    restRadiusRef.current = Math.min(window.innerWidth, window.innerHeight) * 0.16;
  }
  if (sphereRadiusRef.current === null) {
    sphereRadiusRef.current = reverseEntry
      ? restRadiusRef.current * 60 // reverse tunnel: starts huge/warped
      : restRadiusRef.current * GROW_START_FRACTION; // fresh load: starts as a point
  }

  // Grows from a point up to resting size — plain scale-up, no tunnel/warp
  // streaks. Shared by the fresh-landing entrance and the tail end of the
  // reverse-tunnel entrance.
  const startGrowIn = (startRadius) => {
    const r = restRadiusRef.current;
    const start = performance.now();
    // TUNABLE: how long the bloom takes; lower = faster.
    const duration = 500;

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      // ease-out: springs open quickly then settles, like unfurling
      const eased = 1 - Math.pow(1 - progress, 3);
      sphereRadiusRef.current = startRadius + eased * (r - startRadius);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        sphereRadiusRef.current = r;
        growingInRef.current = false;
        setGrowingIn(false);
      }
    };

    rafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    if (!reverseEntry) return;

    // Decelerate from the huge starting radius down to the same tiny
    // "point" size the fresh-landing bloom starts from, then hand off to
    // startGrowIn — so returning from Login plays: tunnel shrink -> bloom.
    //
    // TUNABLE: keep `duration` and the `60` multiplier (used above for the
    // starting radius) in sync with the forward animation for a symmetric
    // feel. Lower duration = faster arrival.
    const pointRadius = restRadiusRef.current * GROW_START_FRACTION;
    const startRadius = sphereRadiusRef.current;
    const start = performance.now();
    const duration = 350;

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      // ease-out: fast start, decelerates like arriving/settling
      const eased = 1 - Math.pow(1 - progress, 3);
      sphereRadiusRef.current = startRadius + eased * (pointRadius - startRadius);
      // Reversed lighting curve vs the forward entrance: starts bright (as
      // if still carrying speed from the tunnel) and dims down as it
      // decelerates toward the point it'll bloom from.
      intensityRef.current = 1 - eased * 0.8;

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        sphereRadiusRef.current = pointRadius;
        intensityRef.current = 1;
        enteringRef.current = false;
        setEntering(false);
        // hand off straight into the bloom
        startGrowIn(pointRadius);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reverseEntry) return; // handled by the reverse-entry effect above, chained
    startGrowIn(sphereRadiusRef.current);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Smoothly grows the sphere while hovered, eases back to resting size
  // otherwise. Runs continuously and independently of the click-through
  // animation (which takes over sphereRadiusRef itself once triggered).
  useEffect(() => {
    // TUNABLE: 1.1 = how much bigger the sphere gets on hover (10%).
    const HOVER_SCALE = 1.1;
    // TUNABLE: 0.12 = how quickly it eases toward that size each frame.
    const EASE_SPEED = 0.12;

    const loop = () => {
      if (!expandingRef.current && !enteringRef.current && !growingInRef.current) {
        const target = restRadiusRef.current * (hoveringRef.current ? HOVER_SCALE : 1);
        sphereRadiusRef.current += (target - sphereRadiusRef.current) * EASE_SPEED;
      }
      hoverRafRef.current = requestAnimationFrame(loop);
    };
    hoverRafRef.current = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(hoverRafRef.current);
  }, []);

  const getSphereRadius = () => sphereRadiusRef.current;

  const isOverSphere = (clientX, clientY) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const dist = Math.hypot(clientX - cx, clientY - cy);
    return dist <= restRadiusRef.current * 1.5;
  };

  const handleMouseMove = (e) => {
    if (expanding || entering || growingIn) return;
    const over = isOverSphere(e.clientX, e.clientY);
    hoveringRef.current = over;
    setHovering(over);
  };

  const handleClick = (e) => {
    if (expanding || entering || growingIn) return;
    if (!isOverSphere(e.clientX, e.clientY)) return;

    setExpanding(true);
    expandingRef.current = true;
    setHovering(false);
    cancelAnimationFrame(hoverRafRef.current);

    const startRadius = restRadiusRef.current;
    // Grown far past any sane screen size — combined with the fixed focal
    // length in WireHole, this blows the wires outward past the corners
    // instead of just rescaling in place, giving a "flying through it" feel.
    //
    // TUNABLE: to make the whole click-through transition faster/slower,
    // adjust `duration` (ms). Lower = faster. You can also raise the `60`
    // multiplier on targetRadius for a more violent snap outward, or lower
    // it for a gentler stretch.
    const targetRadius = startRadius * 60;
    const start = performance.now();
    const duration = 350;

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      // ease-in: slow start, accelerates like being pulled through
      const eased = progress * progress * progress;
      sphereRadiusRef.current = startRadius + eased * (targetRadius - startRadius);
      // Brightens as it accelerates away — opposite curve from the reverse
      // entrance (which starts bright and dims as it decelerates/settles).
      intensityRef.current = 0.35 + eased * 0.65;

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        onEnter();
      }
    };

    rafRef.current = requestAnimationFrame(step);
  };

  const hidden = expanding || entering || growingIn;

  return (
    <div
      className="landing-root"
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      style={{ cursor: hovering ? "pointer" : "default" }}
    >
      <WireHole
        sphereRadius={sphereRadiusRef.current}
        onFrameSphereRadius={getSphereRadius}
        warp={expanding || entering}
        focalBasis={restRadiusRef.current}
        onFrameIntensity={() => intensityRef.current}
      />

      <div className="site-logo" style={{ opacity: hidden ? 0 : 1 }}>
        <img src="/WIRES-txt-LOGO.png" alt="WRIES" className="site-logo-img" />
      </div>

      <div className="landing-label" style={{ opacity: hidden ? 0 : 1 }}>
        <p>enter</p>
      </div>
    </div>
  );
}