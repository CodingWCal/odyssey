"use client";

import { useEffect, useRef } from "react";

interface Globe3DProps {
  /** Rendered size in px (square). */
  size?: number;
}

/**
 * An interactive 3D globe for the landing hero. Auto-rotates, and can be
 * grabbed and spun with the pointer (drag to rotate, with inertia). Themed in
 * the Odyssey periwinkle: a purple sphere with a lavender lat/long graticule,
 * cream landmass speckles, and a soft periwinkle atmosphere. three.js is
 * imported inside the effect so nothing WebGL-related runs during SSR.
 */
export function Globe3D({ size = 300 }: Globe3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      if (cancelled || !mountRef.current) return;

      const el = mountRef.current;
      const width = el.clientWidth || size;
      const height = el.clientHeight || size;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
      camera.position.z = 3.2;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      el.appendChild(renderer.domElement);
      renderer.domElement.style.cursor = "grab";
      renderer.domElement.style.touchAction = "none";

      // Group holds the globe so we rotate it (not the camera).
      const globe = new THREE.Group();
      scene.add(globe);

      // Sphere — Odyssey periwinkle.
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(1, 48, 48),
        new THREE.MeshStandardMaterial({
          color: 0x7f77c0,
          roughness: 0.82,
          metalness: 0.06,
        })
      );
      globe.add(sphere);

      // Lat/long graticule — soft lavender wireframe just above the surface.
      const grid = new THREE.Mesh(
        new THREE.SphereGeometry(1.005, 24, 18),
        new THREE.MeshBasicMaterial({ color: 0xcfc9f0, wireframe: true, transparent: true, opacity: 0.35 })
      );
      globe.add(grid);

      // A scatter of "landmass" points in cream for warmth and texture.
      const pointGeo = new THREE.BufferGeometry();
      const count = 900;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const r = 1.02;
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.cos(phi);
        positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      pointGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      globe.add(
        new THREE.Points(
          pointGeo,
          new THREE.PointsMaterial({ color: 0xf5d9b0, size: 0.022, transparent: true, opacity: 0.9 })
        )
      );

      // Soft periwinkle atmosphere halo.
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(1.12, 48, 48),
        new THREE.MeshBasicMaterial({ color: 0x7f77c0, transparent: true, opacity: 0.08, side: THREE.BackSide })
      );
      scene.add(halo);

      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const key = new THREE.DirectionalLight(0xffffff, 1.1);
      key.position.set(3, 2, 4);
      scene.add(key);

      // Gentle initial tilt.
      globe.rotation.x = 0.35;

      // --- Pointer drag to spin (with inertia) ---
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      let velX = 0.004; // auto-spin speed
      let velY = 0;

      const onDown = (e: PointerEvent) => {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        velX = 0;
        velY = 0;
        renderer.domElement.style.cursor = "grabbing";
        renderer.domElement.setPointerCapture(e.pointerId);
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        velX = dx * 0.005;
        velY = dy * 0.005;
        globe.rotation.y += velX;
        globe.rotation.x += velY;
      };
      const onUp = (e: PointerEvent) => {
        dragging = false;
        renderer.domElement.style.cursor = "grab";
        try { renderer.domElement.releasePointerCapture(e.pointerId); } catch {}
      };
      renderer.domElement.addEventListener("pointerdown", onDown);
      renderer.domElement.addEventListener("pointermove", onMove);
      renderer.domElement.addEventListener("pointerup", onUp);
      renderer.domElement.addEventListener("pointerleave", onUp);

      let raf = 0;
      const tick = () => {
        if (!dragging) {
          // Inertia decay, settling back to a slow idle spin.
          velX += (0.004 - velX) * 0.02;
          velY *= 0.92;
          globe.rotation.y += velX;
          globe.rotation.x += velY;
          // Keep the tilt from drifting too far.
          globe.rotation.x += (0.35 - globe.rotation.x) * 0.01;
        }
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      tick();

      const onResize = () => {
        const w = el.clientWidth || size;
        const h = el.clientHeight || size;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", onResize);

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
        renderer.domElement.removeEventListener("pointerdown", onDown);
        renderer.domElement.removeEventListener("pointermove", onMove);
        renderer.domElement.removeEventListener("pointerup", onUp);
        renderer.domElement.removeEventListener("pointerleave", onUp);
        renderer.dispose();
        sphere.geometry.dispose();
        (sphere.material as { dispose(): void }).dispose();
        grid.geometry.dispose();
        (grid.material as { dispose(): void }).dispose();
        pointGeo.dispose();
        halo.geometry.dispose();
        (halo.material as { dispose(): void }).dispose();
        if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
      };
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [size]);

  return (
    <div
      ref={mountRef}
      aria-label="Interactive globe — drag to spin"
      className="globe-wrap"
      style={{ "--globe-size": `${size}px` } as React.CSSProperties}
    />
  );
}
