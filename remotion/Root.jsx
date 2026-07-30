import React from "react";
import {AbsoluteFill, Composition, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import hero from "../assets/strike-arena-hero.png";

const MistLayer = ({delay = 0, top = 0, opacity = 0.22}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const shift = interpolate((frame + delay) % durationInFrames, [0, durationInFrames], [-180, 220]);

  return (
    <div
      style={{
        position: "absolute",
        left: shift,
        top,
        width: 1700,
        height: 360,
        background:
          "linear-gradient(90deg, transparent, rgba(210,225,214,0.24), rgba(255,255,255,0.12), transparent)",
        filter: "blur(28px)",
        opacity,
        transform: "skewX(-10deg)",
      }}
    />
  );
};

const Rain = () => {
  const frame = useCurrentFrame();
  const drops = Array.from({length: 60}, (_, index) => {
    const x = (index * 137) % 1920;
    const y = ((index * 89 + frame * 18) % 1240) - 120;
    const alpha = 0.12 + ((index % 5) * 0.025);
    return (
      <i
        key={index}
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: 1,
          height: 42 + (index % 4) * 16,
          background: `rgba(220,238,255,${alpha})`,
          transform: "rotate(13deg)",
          filter: "blur(0.5px)",
        }}
      />
    );
  });
  return <>{drops}</>;
};

const LightRays = () => {
  const frame = useCurrentFrame();
  const pulse = interpolate(Math.sin(frame / 18), [-1, 1], [0.16, 0.28]);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 780,
          top: -80,
          width: 260,
          height: 1180,
          background: "linear-gradient(180deg, rgba(255,218,160,0.35), rgba(180,220,190,0.05), transparent)",
          opacity: pulse,
          transform: "rotate(28deg)",
          filter: "blur(12px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 960,
          top: -40,
          width: 190,
          height: 1050,
          background: "linear-gradient(180deg, rgba(255,236,190,0.24), rgba(160,210,180,0.04), transparent)",
          opacity: pulse * 0.8,
          transform: "rotate(24deg)",
          filter: "blur(18px)",
        }}
      />
    </>
  );
};

const StrikeScene = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const progress = frame / durationInFrames;
  const scale = interpolate(progress, [0, 1], [1.045, 1.105]);
  const panX = interpolate(progress, [0, 1], [-42, 36]);
  const panY = interpolate(Math.sin(frame / 42), [-1, 1], [-10, 10]);
  const vignette = interpolate(Math.sin(frame / 36), [-1, 1], [0.72, 0.84]);

  return (
    <AbsoluteFill style={{backgroundColor: "#050806", overflow: "hidden"}}>
      <img
        src={hero}
        style={{
          position: "absolute",
          inset: -30,
          width: "calc(100% + 60px)",
          height: "calc(100% + 60px)",
          objectFit: "cover",
          transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
          filter: "contrast(1.08) saturate(0.92) brightness(0.82)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.72), rgba(7,20,14,0.22) 45%, rgba(0,0,0,0.3)), linear-gradient(180deg, rgba(0,0,0,0.24), transparent 45%, rgba(0,0,0,0.72))",
        }}
      />
      <LightRays />
      <MistLayer top={520} opacity={0.2} />
      <MistLayer delay={72} top={650} opacity={0.16} />
      <MistLayer delay={128} top={410} opacity={0.12} />
      <Rain />
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: `inset 0 0 320px rgba(0,0,0,${vignette})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 54% 38%, rgba(255,210,145,0.18), transparent 16%), radial-gradient(circle at 42% 64%, rgba(120,190,155,0.1), transparent 24%)",
          mixBlendMode: "screen",
          opacity: 0.55,
        }}
      />
    </AbsoluteFill>
  );
};

export const Root = () => (
  <Composition id="StrikeScene" component={StrikeScene} durationInFrames={180} fps={30} width={1920} height={1080} />
);
