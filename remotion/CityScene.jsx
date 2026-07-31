import React from "react";
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from "remotion";

// Deterministic PRNG so the skyline is stable across frames.
const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Build a layer of city buildings as a single div each (windows via CSS gradients).
const buildLayer = (seed, count, minH, maxH, baseColor, litColor, wallColor, winW, winH, gapX, gapY) => {
  const rng = mulberry32(seed);
  const buildings = [];
  let cursor = -40;
  for (let i = 0; i < count; i++) {
    const width = 70 + rng() * 130;
    const height = minH + rng() * (maxH - minH);
    buildings.push({
      left: cursor,
      width,
      height,
      litOpacity: 0.35 + rng() * 0.6,
      hasAntenna: rng() > 0.62,
      beaconPhase: rng() * Math.PI * 2,
    });
    cursor += width + 6 + rng() * 26;
  }
  return {buildings, baseColor, litColor, wallColor, winW, winH, gapX, gapY};
};

const BuildingLayer = ({layer, bottom, dim, beaconColor}) => {
  const frame = useCurrentFrame();
  return (
    <>
      {layer.buildings.map((b, i) => {
        const beacon = b.hasAntenna
          ? 0.35 + 0.65 * Math.max(0, Math.sin(frame / 14 + b.beaconPhase))
          : 0;
        return (
          <div key={i}>
            {b.hasAntenna && (
              <div
                style={{
                  position: "absolute",
                  left: b.left + b.width / 2 - 1.5,
                  bottom: bottom + b.height,
                  width: 3,
                  height: 34,
                  background: "rgba(10,14,20,0.9)",
                }}
              />
            )}
            {b.hasAntenna && (
              <div
                style={{
                  position: "absolute",
                  left: b.left + b.width / 2 - 4,
                  bottom: bottom + b.height + 30,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: beaconColor,
                  opacity: beacon,
                  boxShadow: `0 0 14px 4px ${beaconColor}`,
                }}
              />
            )}
            <div
              style={{
                position: "absolute",
                left: b.left,
                bottom,
                width: b.width,
                height: b.height,
                opacity: dim,
                background: `repeating-linear-gradient(90deg, transparent 0 ${layer.winW}px, ${layer.wallColor} ${layer.winW}px ${layer.winW + layer.gapX}px), repeating-linear-gradient(0deg, transparent 0 ${layer.winH}px, ${layer.litColor} ${layer.winH}px ${layer.winH + layer.gapY}px), ${layer.baseColor}`,
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25)",
              }}
            />
          </div>
        );
      })}
    </>
  );
};

const Clouds = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const t = frame / durationInFrames;
  const clouds = [
    {top: 90, w: 620, h: 130, o: 0.16, speed: 1},
    {top: 200, w: 480, h: 110, o: 0.12, speed: 1.6},
    {top: 40, w: 760, h: 150, o: 0.1, speed: 0.7},
  ];
  return (
    <>
      {clouds.map((c, i) => {
        // Periodic drift so the loop is seamless.
        const drift = Math.sin(t * Math.PI * 2 * c.speed + i * 2.1) * 140;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 300 + i * 480 + drift,
              top: c.top,
              width: c.w,
              height: c.h,
              borderRadius: "50%",
              background: "radial-gradient(ellipse, rgba(190,205,225,0.5), transparent 70%)",
              opacity: c.o,
              filter: "blur(30px)",
            }}
          />
        );
      })}
    </>
  );
};

export const CityScene = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  const far = buildLayer(101, 26, 120, 300, "#101623", "rgba(255,196,120,0.16)", "#0b101c", 7, 9, 6, 8);
  const mid = buildLayer(202, 20, 200, 440, "#0c111d", "rgba(255,200,130,0.3)", "#080c16", 9, 12, 7, 9);
  const near = buildLayer(303, 14, 300, 560, "#070a13", "rgba(255,206,140,0.5)", "#05070d", 12, 15, 9, 11);

  // Slow global exposure breathing for a living feel.
  const glow = interpolate(Math.sin(frame / 40), [-1, 1], [0.85, 1.05]);

  return (
    <AbsoluteFill style={{backgroundColor: "#04060d", overflow: "hidden"}}>
      {/* Night sky gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, #050810 0%, #0a1224 42%, #1a2740 68%, #31405c 88%, #4a5a76 100%)",
        }}
      />
      {/* Moon glow */}
      <div
        style={{
          position: "absolute",
          left: 1380,
          top: 120,
          width: 90,
          height: 90,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(235,240,250,0.95), rgba(200,215,240,0.35) 55%, transparent 75%)",
          boxShadow: "0 0 120px 50px rgba(190,210,245,0.22)",
        }}
      />
      <Clouds />
      {/* Skyline layers (back to front) */}
      <BuildingLayer layer={far} bottom={250} dim={0.55} beaconColor="rgba(255,80,90,0.8)" />
      <BuildingLayer layer={mid} bottom={150} dim={0.8} beaconColor="rgba(255,80,90,0.85)" />
      <BuildingLayer layer={near} bottom={-10} dim={1} beaconColor="rgba(255,70,80,0.9)" />
      {/* Horizon haze */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 340,
          background: "linear-gradient(180deg, transparent, rgba(70,90,120,0.28) 55%, rgba(90,110,140,0.4))",
          filter: "blur(6px)",
        }}
      />
      {/* City light pollution glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 96%, rgba(255,180,110,0.2), transparent 55%)",
          mixBlendMode: "screen",
          opacity: glow,
        }}
      />
      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: "inset 0 0 300px rgba(0,0,0,0.75)",
        }}
      />
    </AbsoluteFill>
  );
};
