"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { aqiColor } from "@/lib/aqi";

interface PMParticlesProps {
  aqi: number;
  height?: number;
}

export default function PMParticles({ aqi, height = 180 }: PMParticlesProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const W = el.clientWidth || 360;
    const H = height;
    const count = Math.floor(200 + (Math.min(aqi, 500) / 500) * 800);
    const color = new THREE.Color(aqiColor(aqi));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 100);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 9;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 3;
      velocities[i * 3]     = (Math.random() - 0.5) * 0.004;
      velocities[i * 3 + 1] = 0.006 + Math.random() * 0.009;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.003;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color,
      size: 0.07,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.65,
    });

    const pts = new THREE.Points(geo, mat);
    scene.add(pts);

    let rafId: number;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const pos = geo.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        pos[i * 3]     += velocities[i * 3];
        pos[i * 3 + 1] += velocities[i * 3 + 1];
        pos[i * 3 + 2] += velocities[i * 3 + 2];
        if (pos[i * 3 + 1] >  3)   pos[i * 3 + 1] = -3;
        if (pos[i * 3]     >  5.5)  pos[i * 3]     = -5.5;
        if (pos[i * 3]     < -5.5)  pos[i * 3]     =  5.5;
      }
      geo.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      renderer.dispose();
      geo.dispose();
      mat.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, [aqi, height]);

  return (
    <div
      ref={mountRef}
      style={{ width: "100%", height, borderRadius: 12, overflow: "hidden", background: "#080f0a" }}
    />
  );
}
