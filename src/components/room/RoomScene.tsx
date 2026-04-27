"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  ContactShadows,
  AccumulativeShadows,
  RandomizedLight,
  MeshReflectorMaterial,
  Float,
  useHelper,
} from "@react-three/drei";
import * as THREE from "three";

// ─── Wood texture via procedural approach ───────────────────────────────

function useWoodTexture(
  baseColor: string = "#8B6F47",
  grainColor: string = "#6B5235",
  scale: number = 1
) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 120; i++) {
      ctx.strokeStyle =
        Math.random() > 0.5
          ? grainColor
          : `rgba(${60 + Math.random() * 40}, ${40 + Math.random() * 30}, ${
              20 + Math.random() * 20
            }, ${0.1 + Math.random() * 0.15})`;
      ctx.lineWidth = 0.5 + Math.random() * 2;
      ctx.beginPath();
      const y = Math.random() * 512;
      ctx.moveTo(0, y + Math.random() * 4);
      for (let x = 0; x < 512; x += 20) {
        ctx.lineTo(x, y + Math.sin(x * 0.02) * 3 + Math.random() * 2);
      }
      ctx.stroke();
    }

    // Add subtle knots
    for (let i = 0; i < 3; i++) {
      const kx = Math.random() * 512;
      const ky = Math.random() * 512;
      const gradient = ctx.createRadialGradient(kx, ky, 0, kx, ky, 8 + Math.random() * 12);
      gradient.addColorStop(0, "rgba(80, 50, 25, 0.4)");
      gradient.addColorStop(1, "rgba(80, 50, 25, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(kx, ky, 8 + Math.random() * 8, 5 + Math.random() * 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(scale, scale);
    return tex;
  }, [baseColor, grainColor, scale]);
}

function useFabricTexture(color: string = "#6B7B8D") {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;

    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 256, 256);

    for (let y = 0; y < 256; y += 2) {
      for (let x = 0; x < 256; x += 2) {
        const variation = Math.random() * 16 - 8;
        ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, r + variation))}, ${Math.max(
          0,
          Math.min(255, g + variation)
        )}, ${Math.max(0, Math.min(255, b + variation))})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
  }, [color]);
}

/** Seeded random for repeatable parquet pattern */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = ((s * 16807) | 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const c = parseInt(hex.replace("#", ""), 16);
  return [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
}

function clamp255(v: number) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function drawParquetGrain(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  grainColor: string, alpha: number, rng: () => number
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const numGrains = 8 + Math.floor(rng() * 6);
  for (let g = 0; g < numGrains; g++) {
    const gx = x + (g / numGrains) * w + (rng() - 0.5) * (w * 0.08);
    ctx.strokeStyle = grainColor;
    ctx.globalAlpha = alpha * (0.4 + rng() * 0.6);
    ctx.lineWidth = 0.25 + rng() * 0.6;
    ctx.beginPath();
    ctx.moveTo(gx, y);
    const segments = 6 + Math.floor(rng() * 4);
    for (let s = 1; s <= segments; s++) {
      const sy = y + (s / segments) * h;
      const sx = gx + (rng() - 0.5) * h * 0.08;
      ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawParquetKnot(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  knotColor: string, alpha: number
) {
  if (r <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const grad = ctx.createRadialGradient(cx, cy, 0.001, cx, cy, Math.max(0.001, r));
  grad.addColorStop(0, knotColor);
  grad.addColorStop(0.7, knotColor);
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

function useParquetFloorTextures() {
  return useMemo(() => {
    const W = 2048;
    const H = 2048;
    const blockLen = 130;
    const blockWid = 26;
    const gap = 2;
    const cos45 = 0.7071;
    const stepX = blockLen * cos45 + gap * 2;
    const stepY = blockLen * cos45 + gap;
    const hw = (blockLen - gap) / 2;
    const hh = (blockWid - gap) / 2;

    const palette = {
      planks: ["#c9a876", "#b8956a", "#d4b088", "#ad8558", "#be9870", "#cfac84"],
      grain: "#8a6b48",
      gap: "#9a7d5a",
      knot: "#7a5a38",
    };

    const blocks: Array<{ cx: number; cy: number; angle: number }> = [];
    for (let row = 0; row < 20; row++) {
      for (let col = 0; col < 20; col++) {
        blocks.push({
          cx: col * stepX + (row % 2) * (stepX / 2) + stepX / 2,
          cy: row * stepY + stepY / 2,
          angle: (row % 2 === 0 ? 1 : -1) * Math.PI / 4,
        });
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = palette.gap;
    ctx.fillRect(0, 0, W, H);

    for (let idx = 0; idx < blocks.length; idx++) {
      const b = blocks[idx];
      const plankRng = seededRandom(42 + idx * 17);
      ctx.save();
      ctx.translate(b.cx, b.cy);
      ctx.rotate(b.angle);
      ctx.translate(-hw, -hh);

      const baseColor = palette.planks[idx % palette.planks.length];
      const [br, bg, bb] = hexToRgb(baseColor);
      const pv = (plankRng() - 0.5) * 22;
      const warm = (plankRng() - 0.5) * 12;
      ctx.fillStyle = `rgb(${clamp255(br + pv + warm)},${clamp255(bg + pv)},${clamp255(bb + pv - warm)})`;
      ctx.fillRect(0, 0, hw * 2, hh * 2);

      const grad = ctx.createLinearGradient(0, 0, hw * 2, hh * 2);
      const sign = plankRng() > 0.5 ? 1 : -1;
      grad.addColorStop(0, `rgba(${sign > 0 ? 255 : 0},${sign > 0 ? 255 : 0},${sign > 0 ? 255 : 0},0.025)`);
      grad.addColorStop(1, `rgba(${sign > 0 ? 0 : 255},${sign > 0 ? 0 : 255},${sign > 0 ? 0 : 255},0.025)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, hw * 2, hh * 2);

      drawParquetGrain(ctx, 0, 0, hw * 2, hh * 2, palette.grain, 0.22, plankRng);
      if (plankRng() > 0.82) {
        const kx = hw * 2 * (0.2 + plankRng() * 0.6);
        const ky = hh * 2 * (0.25 + plankRng() * 0.5);
        drawParquetKnot(ctx, kx, ky, 3 + plankRng() * 5, palette.knot, 0.06 + plankRng() * 0.05);
      }
      ctx.restore();
    }

    ctx.strokeStyle = palette.gap;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;
    for (let idx = 0; idx < blocks.length; idx++) {
      const b = blocks[idx];
      ctx.save();
      ctx.translate(b.cx, b.cy);
      ctx.rotate(b.angle);
      ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    for (let idx = 0; idx < blocks.length; idx++) {
      const b = blocks[idx];
      ctx.save();
      ctx.translate(b.cx, b.cy);
      ctx.rotate(b.angle);
      const grad = ctx.createLinearGradient(0, 0, 0, hh * 2);
      grad.addColorStop(0, "rgba(255,255,255,0.05)");
      grad.addColorStop(0.25, "rgba(255,255,255,0.02)");
      grad.addColorStop(0.5, "rgba(0,0,0,0.01)");
      grad.addColorStop(0.75, "rgba(0,0,0,0.015)");
      grad.addColorStop(1, "rgba(0,0,0,0.03)");
      ctx.fillStyle = grad;
      ctx.fillRect(-hw, -hh, hw * 2, hh * 2);
      ctx.restore();
    }

    const mapTex = new THREE.CanvasTexture(canvas);
    mapTex.wrapS = mapTex.wrapT = THREE.RepeatWrapping;
    mapTex.repeat.set(4, 4);
    mapTex.colorSpace = THREE.SRGBColorSpace;
    mapTex.anisotropy = 16;

    const roughImg = new ImageData(W, H);
    const rpx = roughImg.data;
    const jointRough = 95;
    const woodSmooth = 38;
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        let val = jointRough;
        for (const b of blocks) {
          const dx = px - b.cx;
          const dy = py - b.cy;
          const lx = dx * Math.cos(b.angle) + dy * Math.sin(b.angle);
          const ly = -dx * Math.sin(b.angle) + dy * Math.cos(b.angle);
          if (Math.abs(lx) <= hw && Math.abs(ly) <= hh) {
            const edge = Math.min(1 - Math.abs(lx) / hw, 1 - Math.abs(ly) / hh);
            val = edge < 0.1 ? jointRough : woodSmooth;
            break;
          }
        }
        const i = (py * W + px) * 4;
        rpx[i] = rpx[i + 1] = rpx[i + 2] = val;
        rpx[i + 3] = 255;
      }
    }
    const roughCanvas = document.createElement("canvas");
    roughCanvas.width = W;
    roughCanvas.height = H;
    roughCanvas.getContext("2d")!.putImageData(roughImg, 0, 0);
    const roughTex = new THREE.CanvasTexture(roughCanvas);
    roughTex.wrapS = roughTex.wrapT = THREE.RepeatWrapping;
    roughTex.repeat.set(4, 4);
    roughTex.anisotropy = 16;

    const normImg = new ImageData(W, H);
    const npx = normImg.data;
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        let r = 128, g = 128, b = 255;
        for (const b0 of blocks) {
          const dx = px - b0.cx;
          const dy = py - b0.cy;
          const lx = dx * Math.cos(b0.angle) + dy * Math.sin(b0.angle);
          const ly = -dx * Math.sin(b0.angle) + dy * Math.cos(b0.angle);
          const ax = Math.abs(lx);
          const ay = Math.abs(ly);
          if (ax <= hw && ay <= hh) {
            const edgeX = 1 - ax / hw;
            const edgeY = 1 - ay / hh;
            if (edgeX < 0.08 || edgeY < 0.08) {
              const t = Math.min(edgeX, edgeY) / 0.08;
              const tilt = (1 - t) * 25;
              r = Math.round(128 + (lx < 0 ? -tilt : tilt));
              g = Math.round(128 + (ly < 0 ? -tilt : tilt));
              b = Math.round(255 - Math.abs(tilt) * 0.5);
            }
            break;
          }
        }
        const i = (py * W + px) * 4;
        npx[i] = Math.max(0, Math.min(255, r));
        npx[i + 1] = Math.max(0, Math.min(255, g));
        npx[i + 2] = Math.max(0, Math.min(255, b));
        npx[i + 3] = 255;
      }
    }
    const normCanvas = document.createElement("canvas");
    normCanvas.width = W;
    normCanvas.height = H;
    normCanvas.getContext("2d")!.putImageData(normImg, 0, 0);
    const normTex = new THREE.CanvasTexture(normCanvas);
    normTex.wrapS = normTex.wrapT = THREE.RepeatWrapping;
    normTex.repeat.set(4, 4);
    normTex.anisotropy = 16;

    return { mapTex, roughTex, normTex };
  }, []);
}

function useWallTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#F5F0E8";
    ctx.fillRect(0, 0, 512, 512);

    // subtle plaster texture
    for (let y = 0; y < 512; y += 1) {
      for (let x = 0; x < 512; x += 1) {
        const v = Math.random() * 6 - 3;
        ctx.fillStyle = `rgba(${240 + v}, ${235 + v}, ${228 + v}, 0.3)`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }, []);
}

function useRugTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#8B6F5E";
    ctx.fillRect(0, 0, 512, 512);

    // geometric pattern
    ctx.strokeStyle = "#A08070";
    ctx.lineWidth = 2;
    for (let i = 20; i < 256; i += 30) {
      ctx.strokeRect(256 - i, 256 - i, i * 2, i * 2);
    }

    // border
    ctx.strokeStyle = "#6B4F3E";
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, 500, 500);
    ctx.strokeStyle = "#9B7F6E";
    ctx.lineWidth = 4;
    ctx.strokeRect(14, 14, 484, 484);

    // fiber noise
    for (let y = 0; y < 512; y += 2) {
      for (let x = 0; x < 512; x += 2) {
        const v = Math.random() * 20 - 10;
        ctx.fillStyle = `rgba(${139 + v}, ${111 + v}, ${94 + v}, 0.15)`;
        ctx.fillRect(x, y, 2, 2);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, []);
}

// ─── Room Structure ─────────────────────────────────────────────────────

function Room() {
  const wallTexture = useWallTexture();
  const { colorTex: floorTexture, normalTex: floorNormalMap, roughTex: floorRoughnessMap } = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const colorTex = loader.load("/textures/wood/color.jpg");
    const normalTex = loader.load("/textures/wood/normal.jpg");
    const roughTex = loader.load("/textures/wood/roughness.jpg");

    [colorTex, normalTex, roughTex].forEach((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(6, 6);
    });
    colorTex.colorSpace = THREE.SRGBColorSpace;

    return { colorTex, normalTex, roughTex };
  }, []);

  const roomWidth = 6;
  const roomDepth = 5;
  const roomHeight = 2.8;
  const wallThickness = 0.12;

  const wallNormalMap = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#8080FF";
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const n = Math.random() * 4;
        ctx.fillStyle = `rgb(${128 + n}, ${128 + n}, 255)`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  }, []);

  return (
    <group>
      {/* Floor — realistic wooden parquet with grain, depth, polished finish */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[roomWidth, roomDepth]} />
        <meshStandardMaterial
          map={floorTexture}
          normalMap={floorNormalMap}
          roughnessMap={floorRoughnessMap}
          roughness={0.7}
          metalness={0}
        />
      </mesh>

      {/* Back Wall */}
      <mesh position={[0, roomHeight / 2, -roomDepth / 2]} receiveShadow>
        <boxGeometry args={[roomWidth, roomHeight, wallThickness]} />
        <meshStandardMaterial
          map={wallTexture}
          normalMap={wallNormalMap}
          normalScale={new THREE.Vector2(0.05, 0.05)}
          roughness={0.85}
          metalness={0}
        />
      </mesh>

      {/* Left Wall */}
      <mesh
        position={[-roomWidth / 2, roomHeight / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        receiveShadow
      >
        <boxGeometry args={[roomDepth, roomHeight, wallThickness]} />
        <meshStandardMaterial
          map={wallTexture}
          normalMap={wallNormalMap}
          normalScale={new THREE.Vector2(0.05, 0.05)}
          roughness={0.85}
          metalness={0}
        />
      </mesh>

      {/* Right Wall */}
      <mesh
        position={[roomWidth / 2, roomHeight / 2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        receiveShadow
      >
        <boxGeometry args={[roomDepth, roomHeight, wallThickness]} />
        <meshStandardMaterial
          map={wallTexture}
          normalMap={wallNormalMap}
          normalScale={new THREE.Vector2(0.05, 0.05)}
          roughness={0.85}
          metalness={0}
        />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, roomHeight, 0]}>
        <planeGeometry args={[roomWidth, roomDepth]} />
        <meshStandardMaterial color="#FAFAF7" roughness={0.95} metalness={0} />
      </mesh>

      {/* Baseboards */}
      <Baseboard position={[0, 0.04, -roomDepth / 2 + 0.06]} width={roomWidth} rotation={[0, 0, 0]} />
      <Baseboard position={[-roomWidth / 2 + 0.06, 0.04, 0]} width={roomDepth} rotation={[0, Math.PI / 2, 0]} />
      <Baseboard position={[roomWidth / 2 - 0.06, 0.04, 0]} width={roomDepth} rotation={[0, -Math.PI / 2, 0]} />

      {/* Crown molding */}
      <CrownMolding position={[0, roomHeight - 0.04, -roomDepth / 2 + 0.06]} width={roomWidth} rotation={[0, 0, 0]} />
      <CrownMolding position={[-roomWidth / 2 + 0.06, roomHeight - 0.04, 0]} width={roomDepth} rotation={[0, Math.PI / 2, 0]} />
      <CrownMolding position={[roomWidth / 2 - 0.06, roomHeight - 0.04, 0]} width={roomDepth} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
}

function Baseboard({ position, width, rotation }: { position: [number, number, number]; width: number; rotation: [number, number, number] }) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={[width, 0.08, 0.015]} />
      <meshStandardMaterial color="#E8E0D4" roughness={0.5} metalness={0} />
    </mesh>
  );
}

function CrownMolding({ position, width, rotation }: { position: [number, number, number]; width: number; rotation: [number, number, number] }) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={[width, 0.04, 0.03]} />
      <meshStandardMaterial color="#EDE8E0" roughness={0.5} metalness={0} />
    </mesh>
  );
}

// ─── Window ─────────────────────────────────────────────────────────────

function WindowFrame() {
  const glassColor = new THREE.Color("#C8DDF0");
  
  return (
    <group position={[-2.94, 1.5, -0.5]}>
      {/* Window frame outer */}
      <mesh castShadow>
        <boxGeometry args={[0.08, 1.3, 0.9]} />
        <meshStandardMaterial color="#E8E0D4" roughness={0.4} metalness={0} />
      </mesh>

      {/* Glass pane */}
      <mesh position={[0.01, 0, 0]}>
        <boxGeometry args={[0.01, 1.15, 0.75]} />
        <meshPhysicalMaterial
          color={glassColor}
          transparent
          opacity={0.25}
          roughness={0.05}
          metalness={0.1}
          transmission={0.9}
          thickness={0.02}
        />
      </mesh>

      {/* Horizontal divider */}
      <mesh>
        <boxGeometry args={[0.06, 0.025, 0.78]} />
        <meshStandardMaterial color="#E0D8CC" roughness={0.4} />
      </mesh>

      {/* Vertical divider */}
      <mesh>
        <boxGeometry args={[0.06, 1.18, 0.025]} />
        <meshStandardMaterial color="#E0D8CC" roughness={0.4} />
      </mesh>

      {/* Window sill */}
      <mesh position={[0.06, -0.68, 0]} castShadow>
        <boxGeometry args={[0.15, 0.03, 0.95]} />
        <meshStandardMaterial color="#E8E0D4" roughness={0.35} metalness={0} />
      </mesh>

      {/* Sunlight simulation from window */}
      <pointLight
        position={[0.5, 0, 0]}
        intensity={2}
        distance={5}
        color="#FFF5E0"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
    </group>
  );
}

// ─── Sofa ───────────────────────────────────────────────────────────────

function Sofa() {
  const fabricTexture = useFabricTexture("#7B8B8E");
  const woodTexture = useWoodTexture("#5C4033", "#4A3328", 2);

  return (
    <group position={[0, 0, -2]}>
      {/* Base / Seat */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.2, 0.85]} />
        <meshStandardMaterial
          map={fabricTexture}
          roughness={0.9}
          metalness={0}
        />
      </mesh>

      {/* Seat cushions */}
      <SeatCushion position={[-0.55, 0.47, 0.02]} fabric="#7B8B8E" />
      <SeatCushion position={[0, 0.47, 0.02]} fabric="#7B8B8E" />
      <SeatCushion position={[0.55, 0.47, 0.02]} fabric="#7B8B8E" />

      {/* Back */}
      <mesh position={[0, 0.65, -0.35]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.55, 0.15]} />
        <meshStandardMaterial
          map={fabricTexture}
          roughness={0.9}
          metalness={0}
        />
      </mesh>

      {/* Back cushions */}
      <BackCushion position={[-0.55, 0.65, -0.2]} fabric="#8B9B9E" />
      <BackCushion position={[0, 0.65, -0.2]} fabric="#8B9B9E" />
      <BackCushion position={[0.55, 0.65, -0.2]} fabric="#8B9B9E" />

      {/* Armrest left */}
      <mesh position={[-1.05, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.12, 0.35, 0.85]} />
        <meshStandardMaterial
          map={fabricTexture}
          roughness={0.9}
          metalness={0}
        />
      </mesh>

      {/* Armrest right */}
      <mesh position={[1.05, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.12, 0.35, 0.85]} />
        <meshStandardMaterial
          map={fabricTexture}
          roughness={0.9}
          metalness={0}
        />
      </mesh>

      {/* Wooden legs */}
      {[[-0.95, -0.33], [0.95, -0.33], [-0.95, 0.33], [0.95, 0.33]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.07, z]} castShadow>
          <cylinderGeometry args={[0.025, 0.02, 0.14, 8]} />
          <meshStandardMaterial
            map={woodTexture}
            roughness={0.4}
            metalness={0.05}
          />
        </mesh>
      ))}

      {/* Throw pillow */}
      <ThrowPillow position={[-0.7, 0.6, 0.05]} rotation={[0, 0.2, 0.15]} color="#C4785C" />
      <ThrowPillow position={[0.75, 0.58, 0.05]} rotation={[0, -0.3, -0.1]} color="#5C7878" />
    </group>
  );
}

function SeatCushion({ position, fabric }: { position: [number, number, number]; fabric: string }) {
  const tex = useFabricTexture(fabric);
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={[0.5, 0.12, 0.75]} />
      <meshStandardMaterial
        map={tex}
        roughness={0.92}
        metalness={0}
      />
    </mesh>
  );
}

function BackCushion({ position, fabric }: { position: [number, number, number]; fabric: string }) {
  const tex = useFabricTexture(fabric);
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={[0.48, 0.42, 0.14]} />
      <meshStandardMaterial
        map={tex}
        roughness={0.92}
        metalness={0}
      />
    </mesh>
  );
}

function ThrowPillow({ position, rotation, color }: { position: [number, number, number]; rotation: [number, number, number]; color: string }) {
  const tex = useFabricTexture(color);
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <boxGeometry args={[0.35, 0.35, 0.1]} />
      <meshStandardMaterial
        map={tex}
        roughness={0.95}
        metalness={0}
      />
    </mesh>
  );
}

// ─── Coffee Table ───────────────────────────────────────────────────────

function CoffeeTable() {
  const woodTex = useWoodTexture("#A08060", "#8B6B4A", 1.5);

  return (
    <group position={[0, 0, -0.7]}>
      {/* Tabletop */}
      <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.04, 0.55]} />
        <meshStandardMaterial
          map={woodTex}
          roughness={0.25}
          metalness={0.05}
          envMapIntensity={0.4}
        />
      </mesh>

      {/* Lower shelf */}
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.95, 0.02, 0.45]} />
        <meshStandardMaterial
          map={woodTex}
          roughness={0.35}
          metalness={0.05}
        />
      </mesh>

      {/* Legs */}
      {[[-0.48, -0.22], [0.48, -0.22], [-0.48, 0.22], [0.48, 0.22]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.19, z]} castShadow>
          <boxGeometry args={[0.04, 0.38, 0.04]} />
          <meshStandardMaterial
            map={woodTex}
            roughness={0.3}
            metalness={0.05}
          />
        </mesh>
      ))}

      {/* Decorative items on table */}
      <BookStack position={[-0.3, 0.44, 0]} />
      <Vase position={[0.3, 0.44, 0.05]} />
    </group>
  );
}

function BookStack({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.2, 0.025, 0.15]} />
        <meshStandardMaterial color="#2C3E50" roughness={0.8} />
      </mesh>
      <mesh position={[0.01, 0.025, 0]} castShadow>
        <boxGeometry args={[0.19, 0.02, 0.14]} />
        <meshStandardMaterial color="#8E6F3E" roughness={0.7} />
      </mesh>
      <mesh position={[-0.005, 0.045, 0]} castShadow>
        <boxGeometry args={[0.21, 0.018, 0.13]} />
        <meshStandardMaterial color="#6B3A3A" roughness={0.75} />
      </mesh>
    </group>
  );
}

function Vase({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 0.16, 16]} />
        <meshStandardMaterial
          color="#D4C5B0"
          roughness={0.3}
          metalness={0.05}
        />
      </mesh>
      {/* Plant stem */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.003, 0.003, 0.12, 4]} />
        <meshStandardMaterial color="#4A6B3A" roughness={0.8} />
      </mesh>
      {/* Leaves */}
      {[0, 1.2, 2.4, 3.6, 4.8].map((angle, i) => (
        <mesh
          key={i}
          position={[
            Math.cos(angle) * 0.04,
            0.22 + i * 0.015,
            Math.sin(angle) * 0.04,
          ]}
          rotation={[Math.random() * 0.3, angle, Math.random() * 0.5 - 0.25]}
        >
          <planeGeometry args={[0.06, 0.03]} />
          <meshStandardMaterial color="#5A8B4A" roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Bookshelf ──────────────────────────────────────────────────────────

function Bookshelf() {
  const woodTex = useWoodTexture("#7A5C3C", "#6B4D2D", 2);

  const shelfY = [0, 0.45, 0.9, 1.35, 1.8];

  return (
    <group position={[2.5, 0, -2]}>
      {/* Side panels */}
      <mesh position={[-0.42, 0.95, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.025, 1.9, 0.35]} />
        <meshStandardMaterial map={woodTex} roughness={0.35} metalness={0.03} />
      </mesh>
      <mesh position={[0.42, 0.95, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.025, 1.9, 0.35]} />
        <meshStandardMaterial map={woodTex} roughness={0.35} metalness={0.03} />
      </mesh>

      {/* Shelves */}
      {shelfY.map((y, i) => (
        <mesh key={i} position={[0, y + 0.01, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.86, 0.02, 0.35]} />
          <meshStandardMaterial map={woodTex} roughness={0.35} metalness={0.03} />
        </mesh>
      ))}

      {/* Back panel */}
      <mesh position={[0, 0.95, -0.17]} receiveShadow>
        <boxGeometry args={[0.86, 1.9, 0.01]} />
        <meshStandardMaterial map={woodTex} roughness={0.5} metalness={0.02} />
      </mesh>

      {/* Books on shelves */}
      <ShelfBooks y={0.03} />
      <ShelfBooks y={0.47} />
      <ShelfBooks y={0.92} />
      <ShelfDecor y={1.37} />
    </group>
  );
}

function ShelfBooks({ y }: { y: number }) {
  const bookColors = ["#2C3E50", "#8E3B3B", "#3B6E5E", "#5B4A8E", "#8E6F3E", "#3B5B8E", "#6B3A5B"];

  const books = useMemo(() => {
    const items = [];
    let x = -0.36;
    while (x < 0.32) {
      const width = 0.02 + Math.random() * 0.03;
      const height = 0.25 + Math.random() * 0.15;
      const color = bookColors[Math.floor(Math.random() * bookColors.length)];
      items.push({ x, width, height, color });
      x += width + 0.005;
    }
    return items;
  }, []);

  return (
    <group>
      {books.map((book, i) => (
        <mesh
          key={i}
          position={[book.x + book.width / 2, y + book.height / 2, 0]}
          castShadow
        >
          <boxGeometry args={[book.width, book.height, 0.18]} />
          <meshStandardMaterial color={book.color} roughness={0.7} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

function ShelfDecor({ y }: { y: number }) {
  return (
    <group>
      {/* Small plant pot */}
      <mesh position={[-0.15, y + 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.04, 0.1, 12]} />
        <meshStandardMaterial color="#C4785C" roughness={0.6} />
      </mesh>
      <mesh position={[-0.15, y + 0.14, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#4A7B3A" roughness={0.85} />
      </mesh>

      {/* Photo frame */}
      <mesh position={[0.15, y + 0.1, -0.08]} castShadow>
        <boxGeometry args={[0.14, 0.18, 0.015]} />
        <meshStandardMaterial color="#3A3A3A" roughness={0.4} />
      </mesh>
      <mesh position={[0.15, y + 0.1, -0.071]}>
        <planeGeometry args={[0.1, 0.14]} />
        <meshStandardMaterial color="#B8A890" roughness={0.8} />
      </mesh>
    </group>
  );
}

// ─── Floor Lamp ─────────────────────────────────────────────────────────

function FloorLamp() {
  return (
    <group position={[-2, 0, -1.8]}>
      {/* Base */}
      <mesh position={[0, 0.015, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.16, 0.03, 24]} />
        <meshStandardMaterial color="#2A2A2A" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Pole */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <cylinderGeometry args={[0.015, 0.018, 1.5, 12]} />
        <meshStandardMaterial color="#3A3A3A" roughness={0.2} metalness={0.8} />
      </mesh>

      {/* Shade */}
      <mesh position={[0, 1.52, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 0.28, 24, 1, true]} />
        <meshStandardMaterial
          color="#F5E8D0"
          roughness={0.7}
          metalness={0}
          side={THREE.DoubleSide}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* Light */}
      <pointLight
        position={[0, 1.45, 0]}
        intensity={1.5}
        distance={4}
        color="#FFE4C4"
        castShadow
      />
    </group>
  );
}

// ─── TV Stand ───────────────────────────────────────────────────────────

function TVStand() {
  const woodTex = useWoodTexture("#4A3828", "#3A2818", 2);

  return (
    <group position={[0, 0, -2.35]}>
      {/* Cabinet body */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.5, 0.4]} />
        <meshStandardMaterial map={woodTex} roughness={0.3} metalness={0.03} />
      </mesh>

      {/* Cabinet doors / drawers lines */}
      <mesh position={[-0.4, 0.3, 0.201]}>
        <planeGeometry args={[0.75, 0.44]} />
        <meshStandardMaterial color="#3A2818" roughness={0.35} metalness={0.03} />
      </mesh>
      <mesh position={[0.4, 0.3, 0.201]}>
        <planeGeometry args={[0.75, 0.44]} />
        <meshStandardMaterial color="#3A2818" roughness={0.35} metalness={0.03} />
      </mesh>

      {/* Handles */}
      {[-0.4, 0.4].map((x, i) => (
        <mesh key={i} position={[x, 0.3, 0.21]} castShadow>
          <boxGeometry args={[0.08, 0.015, 0.015]} />
          <meshStandardMaterial color="#B8A080" roughness={0.2} metalness={0.6} />
        </mesh>
      ))}

      {/* Legs */}
      {[[-0.72, -0.16], [0.72, -0.16], [-0.72, 0.16], [0.72, 0.16]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.03, z]} castShadow>
          <boxGeometry args={[0.04, 0.06, 0.04]} />
          <meshStandardMaterial color="#3A2818" roughness={0.35} metalness={0.05} />
        </mesh>
      ))}

      {/* TV */}
      <TV position={[0, 0.58, 0]} />
    </group>
  );
}

function TV({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Screen bezel */}
      <mesh castShadow>
        <boxGeometry args={[1.1, 0.65, 0.03]} />
        <meshStandardMaterial color="#1A1A1A" roughness={0.3} metalness={0.5} />
      </mesh>
      {/* Screen */}
      <mesh position={[0, 0.01, 0.016]}>
        <planeGeometry args={[1.02, 0.58]} />
        <meshStandardMaterial color="#0A0A12" roughness={0.1} metalness={0.3} envMapIntensity={0.3} />
      </mesh>
      {/* Stand */}
      <mesh position={[0, -0.36, 0.03]} castShadow>
        <boxGeometry args={[0.35, 0.04, 0.18]} />
        <meshStandardMaterial color="#1A1A1A" roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[0, -0.32, 0.02]} castShadow>
        <boxGeometry args={[0.06, 0.04, 0.04]} />
        <meshStandardMaterial color="#1A1A1A" roughness={0.3} metalness={0.5} />
      </mesh>
    </group>
  );
}

// ─── Side Table ─────────────────────────────────────────────────────────

function SideTable() {
  const woodTex = useWoodTexture("#9B7B5B", "#8A6A4A", 2);

  return (
    <group position={[-2, 0, -2.2]}>
      {/* Top */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.03, 24]} />
        <meshStandardMaterial map={woodTex} roughness={0.25} metalness={0.05} />
      </mesh>
      {/* Leg */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.03, 0.5, 12]} />
        <meshStandardMaterial color="#3A3A3A" roughness={0.2} metalness={0.7} />
      </mesh>
      {/* Base */}
      <mesh position={[0, 0.01, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.14, 0.02, 24]} />
        <meshStandardMaterial color="#3A3A3A" roughness={0.2} metalness={0.7} />
      </mesh>

      {/* Table lamp */}
      <TableLamp position={[0, 0.52, 0]} />
    </group>
  );
}

function TableLamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.06, 0.07, 0.02, 16]} />
        <meshStandardMaterial color="#B8A890" roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.01, 0.012, 0.2, 8]} />
        <meshStandardMaterial color="#B8A890" roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.1, 0.15, 16, 1, true]} />
        <meshStandardMaterial
          color="#F5E8D0"
          roughness={0.7}
          side={THREE.DoubleSide}
          transparent
          opacity={0.85}
        />
      </mesh>
      <pointLight position={[0, 0.2, 0]} intensity={0.5} distance={2} color="#FFE4C4" />
    </group>
  );
}

// ─── Area Rug ───────────────────────────────────────────────────────────

function AreaRug() {
  const rugTexture = useRugTexture();

  return (
    <mesh position={[0, 0.005, -1.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[2.5, 1.8]} />
      <meshStandardMaterial map={rugTexture} roughness={0.95} metalness={0} />
    </mesh>
  );
}

// ─── Armchair ───────────────────────────────────────────────────────────

function Armchair() {
  const fabricTex = useFabricTexture("#8B7355");
  const woodTex = useWoodTexture("#5C4033", "#4A3328", 2);

  return (
    <group position={[2, 0, -0.5]} rotation={[0, -0.5, 0]}>
      {/* Seat */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.75, 0.12, 0.7]} />
        <meshStandardMaterial map={fabricTex} roughness={0.9} />
      </mesh>
      {/* Seat cushion */}
      <mesh position={[0, 0.4, 0.02]} castShadow>
        <boxGeometry args={[0.6, 0.1, 0.58]} />
        <meshStandardMaterial map={fabricTex} roughness={0.92} />
      </mesh>
      {/* Back */}
      <mesh position={[0, 0.6, -0.28]} castShadow receiveShadow>
        <boxGeometry args={[0.75, 0.5, 0.12]} />
        <meshStandardMaterial map={fabricTex} roughness={0.9} />
      </mesh>
      {/* Back cushion */}
      <mesh position={[0, 0.58, -0.18]} castShadow>
        <boxGeometry args={[0.55, 0.38, 0.1]} />
        <meshStandardMaterial map={fabricTex} roughness={0.92} />
      </mesh>
      {/* Armrests */}
      <mesh position={[-0.33, 0.42, 0]} castShadow>
        <boxGeometry args={[0.1, 0.22, 0.6]} />
        <meshStandardMaterial map={fabricTex} roughness={0.9} />
      </mesh>
      <mesh position={[0.33, 0.42, 0]} castShadow>
        <boxGeometry args={[0.1, 0.22, 0.6]} />
        <meshStandardMaterial map={fabricTex} roughness={0.9} />
      </mesh>
      {/* Legs */}
      {[[-0.3, -0.28], [0.3, -0.28], [-0.3, 0.28], [0.3, 0.28]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.07, z]} castShadow>
          <cylinderGeometry args={[0.02, 0.018, 0.14, 8]} />
          <meshStandardMaterial map={woodTex} roughness={0.4} metalness={0.05} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Wall Art ───────────────────────────────────────────────────────────

function WallArt() {
  return (
    <group position={[0, 1.6, -2.44]}>
      {/* Frame */}
      <mesh castShadow>
        <boxGeometry args={[0.85, 0.6, 0.025]} />
        <meshStandardMaterial color="#2A2A2A" roughness={0.3} metalness={0.15} />
      </mesh>
      {/* Canvas / art */}
      <mesh position={[0, 0, 0.014]}>
        <planeGeometry args={[0.75, 0.5]} />
        <meshStandardMaterial color="#D4C5A8" roughness={0.7} />
      </mesh>
      {/* Abstract art brushstrokes */}
      <mesh position={[-0.15, 0.05, 0.015]}>
        <planeGeometry args={[0.3, 0.15]} />
        <meshStandardMaterial color="#6B8B7B" roughness={0.8} />
      </mesh>
      <mesh position={[0.1, -0.08, 0.015]}>
        <planeGeometry args={[0.25, 0.12]} />
        <meshStandardMaterial color="#8B6B5E" roughness={0.8} />
      </mesh>
      <mesh position={[0.05, 0.12, 0.015]}>
        <planeGeometry args={[0.18, 0.08]} />
        <meshStandardMaterial color="#5B6B8B" roughness={0.8} />
      </mesh>
    </group>
  );
}

// ─── Ceiling Light ──────────────────────────────────────────────────────

function CeilingLight() {
  return (
    <group position={[0, 2.78, -1.2]}>
      {/* Canopy */}
      <mesh>
        <cylinderGeometry args={[0.06, 0.06, 0.02, 16]} />
        <meshStandardMaterial color="#2A2A2A" roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Cord */}
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.4, 6]} />
        <meshStandardMaterial color="#1A1A1A" roughness={0.5} />
      </mesh>
      {/* Shade */}
      <mesh position={[0, -0.45, 0]}>
        <sphereGeometry args={[0.15, 24, 24]} />
        <meshPhysicalMaterial
          color="#FFFAF0"
          roughness={0.4}
          metalness={0}
          transparent
          opacity={0.7}
          transmission={0.3}
        />
      </mesh>
      <pointLight
        position={[0, -0.45, 0]}
        intensity={1.2}
        distance={6}
        color="#FFF5E0"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
    </group>
  );
}

// ─── Scene Composition ──────────────────────────────────────────────────

function SceneContent() {
  return (
    <>
      {/* Ambient & environment lighting for realism */}
      <hemisphereLight args={[0xffffff, 0x444444, 1]} />
      <directionalLight
        position={[3, 5, 2]}
        intensity={0.6}
        color="#FFF5E8"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={20}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-bias={-0.0005}
      />

      {/* Soft fill light */}
      <directionalLight
        position={[-2, 3, 4]}
        intensity={0.2}
        color="#E8F0FF"
      />

      {/* Room structure */}
      <Room />
      <WindowFrame />
      <CeilingLight />

      {/* Furniture */}
      <Sofa />
      <CoffeeTable />
      <Bookshelf />
      <FloorLamp />
      <TVStand />
      <SideTable />
      <Armchair />
      <AreaRug />
      <WallArt />

      {/* Contact shadows on the floor */}
      <ContactShadows
        position={[0, 0.001, -1]}
        opacity={0.4}
        scale={10}
        blur={2}
        far={4}
      />
    </>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────

export default function RoomScene() {
  return (
    <div className="w-full h-full">
      <Canvas
        shadows
        camera={{
          position: [3.5, 2.5, 3.5],
          fov: 45,
          near: 0.1,
          far: 100,
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        dpr={[1, 2]}
      >
        <color attach="background" args={["#1a1a2e"]} />
        <fog attach="fog" args={["#1a1a2e", 12, 25]} />

        <SceneContent />

        <OrbitControls
          target={[0, 1.2, -1.2]}
          maxPolarAngle={Math.PI / 2 - 0.05}
          minDistance={1.5}
          maxDistance={8}
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={-0.5}
        />

        <Environment preset="apartment" background={false} environmentIntensity={0.4} />
      </Canvas>
    </div>
  );
}
