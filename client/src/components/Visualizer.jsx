import React, { useEffect, useRef, useState } from 'react';
import { triggerTactileFeedback } from '../utils/tactile';

export default function Visualizer({ 
  isPlaying, 
  analyser, 
  onShareClick, 
  onUploadSuccess,
  showToast,
  songs = [] 
}) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const needleValueRef = useRef(0);
  const rpmValueRef = useRef(0);
  const totalPlaytimeRef = useRef(0); // Total listening playtime in seconds
  const lastFrameTimeRef = useRef(Date.now());
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    let height = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      height = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.resetTransform();
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    window.addEventListener('resize', handleResize);

    // Audio Analysis buffer
    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

    // Dynamic sliding-window beat detection for turn indicators
    const bassHistory = [];
    const maxHistory = 25; // sliding history window of ~400ms
    let arrowIntensity = 0; // dynamic glow decay envelope (0.0 to 1.0)
    let beatCooldown = 0; // filter out close sub-peaks within same drum hit

    // Rain particle system for empty visualizer background zones
    const rainDrops = [];
    const maxRainDrops = 140;
    for (let i = 0; i < maxRainDrops; i++) {
      rainDrops.push({
        x: Math.random() * 1600, // wide initial horizontal spread
        y: Math.random() * 400 - 200,
        speed: 1.5 + Math.random() * 3.5,
        length: 6 + Math.random() * 10,
        opacity: 0.08 + Math.random() * 0.18,
        thickness: 0.6 + Math.random() * 0.6
      });
    }

    // Glass trickling droplets particle system (drawn on top of gauges, crawling slowly)
    const glassDroplets = [];
    const maxGlassDroplets = 45;
    for (let i = 0; i < maxGlassDroplets; i++) {
      glassDroplets.push({
        x: Math.random() * 1600,
        y: Math.random() * 400 - 100,
        radius: 1.2 + Math.random() * 2.2,
        speed: 0.15 + Math.random() * 0.45,
        wiggleSpeed: 0.02 + Math.random() * 0.05,
        wigglePhase: Math.random() * Math.PI * 2,
        trail: [],
        maxTrailLen: 12 + Math.floor(Math.random() * 12)
      });
    }


    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      
      // Calculate relative layout parameters for physics and water deflection
      const cx = w / 2;
      const cy = h * 0.82;
      const r = Math.min(w * 0.308, h * 0.715);
      const r_side = r * 0.62;
      const cx_left = cx - r * 1.23;
      const cy_left = h * 0.85;
      const cx_right = cx + r * 1.23;
      const cy_right = h * 0.85;
      
      // Calculate delta time for precise playtime tracking
      const now = Date.now();
      const delta = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;

      // Clear canvas
      ctx.fillStyle = '#0f1114';
      ctx.fillRect(0, 0, w, h);

      // 1. Get real volume level from Web Audio analyser
      let targetLevel = 0;
      if (isPlaying) {
        if (analyser && dataArray) {
          analyser.getByteFrequencyData(dataArray);
          
          // Calculate average of low-to-mid range frequencies (bass and beats drive the speedometer!)
          let sum = 0;
          const range = Math.min(dataArray.length, 64); // focus on lower 64 bins (bass/vocals)
          for (let i = 0; i < range; i++) {
            sum += dataArray[i];
          }
          targetLevel = sum / range / 160; // Normalize
        } else {
          // Fallback simulation (smooth bouncy behavior)
          targetLevel = 0.25 + Math.sin(Date.now() * 0.007) * 0.15 + Math.random() * 0.1;
          if (Math.random() > 0.94) targetLevel = Math.min(1.0, targetLevel + 0.3); // simulated beat spike
        }

        // Increment total playtime in seconds when playing
        totalPlaytimeRef.current += delta;
      } else {
        // Paused level decay
        targetLevel = 0.0;
      }

      // Smooth needles
      needleValueRef.current += (targetLevel - needleValueRef.current) * 0.18;
      const finalLevel = Math.max(0, Math.min(1.1, needleValueRef.current));

      // Tachometer Option 2: Cruise RPM (1600 RPM baseline when playing, fluctuates between 1.6 and 2.4 based on targetLevel, never exceeds 2.8 redline)
      let rpmTarget = 0;
      if (isPlaying) {
        const baseline = 1.6;
        const range = 0.8;
        const targetRpmVal = baseline + Math.min(1.0, targetLevel) * range; // yields 1.6 to 2.4 RPM
        rpmTarget = targetRpmVal / 4.0; // normalize to 0.0 - 1.0 (since max scale is 4)
      } else {
        rpmTarget = 0.8 / 4.0; // Idle RPM of 0.8 (800 RPM)
      }
      rpmValueRef.current += (rpmTarget - rpmValueRef.current) * 0.12;
      const finalRpm = Math.max(0, Math.min(1.0, rpmValueRef.current));

      const baseVoltage = 13.8;
      const voltageDip = arrowIntensity * 1.4;
      const voltageNoise = isPlaying ? (Math.random() * 0.14 - 0.07) : 0;
      const finalVoltageVal = isPlaying ? (baseVoltage - voltageDip + voltageNoise) : 12.6;

      // Dynamic onset beat detection for turn signals (isolated sub-bass and kick drum frequencies - ultra sensitive)
      let bassLevel = 0;
      if (isPlaying) {
        if (analyser && dataArray) {
          // Isolate sub-bass and drum kick frequencies: average bins 0 to 4 (up to ~860Hz)
          let bassSum = 0;
          const bassBins = Math.min(dataArray.length, 5);
          for (let i = 0; i < bassBins; i++) {
            bassSum += dataArray[i];
          }
          // Scale it up immensely (using 100 divisor instead of 255) to capture even subtle beats
          bassLevel = bassSum / bassBins / 100;
        } else {
          // Fallback simulation: clean truck blinker rhythm (~120 BPM, every 500ms)
          bassLevel = 0.1 + Math.sin(Date.now() * 0.012) * 0.05;
          if (Date.now() % 500 < 35) {
            bassLevel = 0.85; // clean simulated drum strike
          }
        }
      }

      // Calculate sliding average of bass history
      let historySum = 0;
      for (let i = 0; i < bassHistory.length; i++) {
        historySum += bassHistory[i];
      }
      const historyAvg = bassHistory.length > 0 ? historySum / bassHistory.length : 0.2;
      
      // Push current frame's energy to history
      bassHistory.push(bassLevel);
      if (bassHistory.length > maxHistory) {
        bassHistory.shift();
      }
      
      // Decay arrow intensity on every frame
      if (arrowIntensity > 0) {
        arrowIntensity -= 0.045; // slower decay over ~22 frames (~360ms) for high-visibility visual presence
        if (arrowIntensity < 0) arrowIntensity = 0;
      }
      
      if (beatCooldown > 0) {
        beatCooldown--;
      }
      
      // Detect transient drum beats (ultra-sensitive attack phase: 6% rise above history average, noise gate 0.08, cooldown 10 frames)
      if (isPlaying && beatCooldown === 0 && bassLevel > 0.08 && bassLevel > historyAvg * 1.06) {
        arrowIntensity = 1.0; // pop to full neon brightness instantly
        beatCooldown = 10; // block triggers for 10 frames (~160ms) to allow rapid kick sequences to register
      }

      // 1.5. Update and render background rain drops (grows slanted, faster, and brighter on beats!)
      const currentRainSpeedMult = 1.0 + (bassLevel * 2.5) + (arrowIntensity * 1.8);
      const rainAngle = 0.08 + Math.sin(Date.now() * 0.002) * 0.03 + (bassLevel * 0.15); // slants/shakes with bass beats
      
      ctx.save();
      for (let i = 0; i < rainDrops.length; i++) {
        const drop = rainDrops[i];
        const displayX = drop.x % w;
        
        // Update position
        drop.y += drop.speed * currentRainSpeedMult;
        
        // Wrap around when reaching canvas height
        if (drop.y > h) {
          drop.y = -drop.length - Math.random() * 20;
          drop.x = Math.random() * w;
          
          // Draw horizontal ripples/splashes at the bottom
          if (isPlaying) {
            ctx.beginPath();
            ctx.ellipse(displayX, h - 2, 2.5 + bassLevel * 5, 0.8 + bassLevel * 1.8, 0, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(147, 197, 253, ${drop.opacity * 0.35})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
        
        // Calculate slanted line points
        const xStart = displayX;
        const yStart = drop.y;
        const xEnd = displayX + Math.sin(rainAngle) * drop.length;
        const yEnd = drop.y + Math.cos(rainAngle) * drop.length;
        
        ctx.beginPath();
        ctx.moveTo(xStart, yStart);
        ctx.lineTo(xEnd, yEnd);
        
        // Pulsate drop brightness/opacity with the beat
        const alpha = Math.min(0.8, drop.opacity * (1.0 + arrowIntensity * 1.5));
        ctx.strokeStyle = `rgba(147, 197, 253, ${alpha})`;
        ctx.lineWidth = drop.thickness;
        ctx.stroke();
      }
      ctx.restore();

      // 3. Update and render trickling water droplets on the wood/leather background zones
      const dropletSpeedMult = 1.0; // Steady natural gravity crawl speed (completely non-reactive to music!)
      
      ctx.save();
      
      // Helper function to draw a realistic teardrop path pointing upwards (steady size parameters)
      const drawTeardropPath = (c, x, y, radius, tailLen, widthMult) => {
        c.beginPath();
        c.moveTo(x, y - tailLen);
        c.bezierCurveTo(x - radius * 1.25 * widthMult, y - radius * 0.4, x - radius * widthMult, y + radius, x, y + radius);
        c.bezierCurveTo(x + radius * widthMult, y + radius, x + radius * 1.25 * widthMult, y - radius * 0.4, x, y - tailLen);
        c.closePath();
      };

      for (let i = 0; i < glassDroplets.length; i++) {
        const drop = glassDroplets[i];
        
        // Wrap horizontal coordinate within canvas boundaries
        if (drop.x > w) drop.x = Math.random() * w;
        if (drop.x < 0) drop.x = w + (drop.x % w);
        
        const displayX = drop.x;
        
        // Constant, realistic water drop dimensions (completely independent of music!)
        const tailLen = drop.radius * 1.5;
        const widthMult = 1.0;
        
        // Steady horizontal zigzag wiggle sliding
        drop.wigglePhase += drop.wiggleSpeed;
        const zigzagOffset = Math.sin(drop.wigglePhase) * 0.15;
        
        // Move droplet down
        drop.y += drop.speed * dropletSpeedMult;
        drop.x += zigzagOffset;
        
        // Check collision with the three circular dials acting as raised physical surfaces!
        const dials = [
          { cx: cx_left, cy: cy_left, r: r_side + 3 },
          { cx: cx_right, cy: cy_right, r: r_side + 3 },
          { cx: cx, cy: cy, r: r + 3 }
        ];
        
        // Solve intersection boundary bug: identify the SINGLE closest dial and resolve collision ONLY against it!
        let closestDial = null;
        let minDist = Infinity;
        let closestDx = 0;
        let closestDy = 0;
        
        for (let d = 0; d < dials.length; d++) {
          const dial = dials[d];
          const dx = displayX - dial.cx;
          const dy = drop.y - dial.cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          // Only block in upper half (above dial centers)
          if (dist < dial.r && dy < 0) {
            if (dist < minDist) {
              minDist = dist;
              closestDial = dial;
              closestDx = dx;
              closestDy = dy;
            }
          }
        }
        
        if (closestDial) {
          // Avoid division by zero to prevent NaN position errors!
          const safeDist = minDist < 0.001 ? 0.001 : minDist;
          const nx = closestDx / safeDist;
          const ny = closestDy / safeDist;
          
          // Snap droplet precisely to perimeter boundary of the closest dial
          drop.x = closestDial.cx + nx * closestDial.r;
          drop.y = closestDial.cy + ny * closestDial.r;
          
          // Deflect gravity force horizontally (slide left or right down the dial shoulder)
          if (closestDx < 0) {
            drop.x -= 0.16; // steady, non-music speed
          } else {
            drop.x += 0.16; // steady, non-music speed
          }
        }
        
        // Record trail history for wet path trails
        drop.trail.push({ x: drop.x, y: drop.y });
        if (drop.trail.length > drop.maxTrailLen) {
          drop.trail.shift();
        }
        
        // Wrap drop back to top if it exits screen bottom
        if (drop.y > h + 15) {
          drop.y = -20;
          drop.x = Math.random() * w;
          drop.trail = [];
          drop.speed = 0.12 + Math.random() * 0.38;
          drop.radius = 1.3 + Math.random() * 2.2;
        }
        
        // Draw steady, wet glass trails (Double-stroke technique - completely non-reactive)
        if (drop.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(drop.trail[0].x, drop.trail[0].y);
          for (let j = 1; j < drop.trail.length; j++) {
            ctx.lineTo(drop.trail[j].x, drop.trail[j].y);
          }
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          // A. Outer refraction edge (darker refraction boundary)
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
          ctx.lineWidth = drop.radius * 2.2;
          ctx.stroke();
          
          // B. Inner glowing water trail film
          ctx.strokeStyle = 'rgba(160, 215, 255, 0.12)';
          ctx.lineWidth = drop.radius * 1.3;
          ctx.stroke();
        }
        
        // Draw 3D water droplet teardrop refractive structure (steady size, non-pulsing!)
        // A. Soft black refract drop-shadow (offset down-right)
        ctx.save();
        drawTeardropPath(ctx, drop.x + 0.8, drop.y + 0.8, drop.radius, tailLen, widthMult);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
        ctx.fill();
        ctx.restore();
        
        // B. Semi-transparent droplet body (cyan-blue reflection)
        ctx.save();
        drawTeardropPath(ctx, drop.x, drop.y, drop.radius, tailLen, widthMult);
        ctx.fillStyle = 'rgba(147, 197, 253, 0.16)';
        ctx.fill();
        ctx.restore();
        
        // C. Bottom-right interior refraction light reflection
        ctx.save();
        drawTeardropPath(ctx, drop.x + drop.radius * 0.15, drop.y + drop.radius * 0.15, drop.radius * 0.65, tailLen * 0.65, widthMult);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.fill();
        ctx.restore();
        
        // D. Top-left specular glare reflection dot (Cabin lights reflecting)
        ctx.save();
        ctx.beginPath();
        const glareR = drop.radius * 0.22;
        ctx.arc(drop.x - drop.radius * 0.35, drop.y - drop.radius * 0.45, glareR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      // 2. Draw Dashboard Gauge Cluster (drawn ON TOP of rain and trickling droplets so they never appear inside!)
      // [x] Step 19: Realistic 3D Trickling Water Droplets on Dashboard Background
      // - [x] Initialize glass trickling droplets state array in `useEffect` closure
      // - [x] Implement realistic, double-outlined, fading refractive wet trails (steady parameters)
      // - [x] Render authentic, elongated liquid **teardrop shapes** pointing upwards (steady size, non-pulsing)
      // - [x] Program organic **physics deflection** around circular dial boundaries (restricted to upper half)
      // - [x] Fix dial intersection boundary glitch by resolving collision **strictly for the closest dial** (preventing resets/disappearances)
      // - [x] Layer droplets rendering **behind the main speedometer and side dials** (guaranteeing they never appear inside dials)
      // - [x] Ensure completely steady droplet crawl speed, shape, trails, and glare (non-music reactive)
      // - [x] Recompile client Vite bundle and verify 60FPS performance
      drawSpeedometer(ctx, w, h, finalLevel, arrowIntensity, finalRpm, finalVoltageVal);

      animationRef.current = requestAnimationFrame(draw);
    };

    const drawTachometer = (c, cx, cy, r, rpmVal) => {
      c.save();

      // Gauge face gradient
      c.beginPath();
      c.arc(cx, cy, r, Math.PI * 0.9, Math.PI * 2.1);
      c.lineTo(cx, cy);
      c.closePath();
      
      const faceGrad = c.createRadialGradient(cx, cy - r * 0.3, r * 0.2, cx, cy - r * 0.3, r);
      faceGrad.addColorStop(0, '#1a1f26');
      faceGrad.addColorStop(0.8, '#12151a');
      faceGrad.addColorStop(1, '#0b0c0e');
      c.fillStyle = faceGrad;
      c.fill();

      // Outer Chrome Ring
      c.beginPath();
      c.arc(cx, cy, r, Math.PI * 0.9, Math.PI * 2.1);
      c.strokeStyle = '#2b313a';
      c.lineWidth = 2.5;
      c.stroke();

      c.beginPath();
      c.arc(cx, cy, r + 1, Math.PI * 0.9, Math.PI * 2.1);
      c.strokeStyle = '#4a5361';
      c.lineWidth = 0.5;
      c.stroke();

      // Scale markings (0 to 4 RPM x1000)
      const startAngle = Math.PI * 1.05;
      const endAngle = Math.PI * 1.95;
      const angleRange = endAngle - startAngle;

      c.textAlign = 'center';
      c.textBaseline = 'middle';

      // 40 steps total for fine minor ticks
      for (let i = 0; i <= 40; i++) {
        const angle = startAngle + (i / 40) * angleRange;
        const isMajor = i % 10 === 0;
        const isMedium = i % 5 === 0 && !isMajor;
        
        const tickStart = isMajor ? r - 8 : (isMedium ? r - 6 : r - 4);
        let tickColor = '#a0aec0';
        
        const val = i / 10;
        if (val >= 1.0 && val < 2.2) {
          tickColor = '#00ff66'; // Green economy zone
        } else if (val >= 2.2 && val < 2.8) {
          tickColor = '#ffb366'; // Yellow warning zone
        } else if (val >= 2.8) {
          tickColor = '#ff3333'; // Redline zone
        }

        c.beginPath();
        c.moveTo(cx + Math.cos(angle) * tickStart, cy + Math.sin(angle) * tickStart);
        c.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
        c.strokeStyle = tickColor;
        c.lineWidth = isMajor ? 1.5 : (isMedium ? 1.0 : 0.6);
        c.stroke();

        // Major numbers (0, 1, 2, 3, 4)
        if (isMajor) {
          const numVal = i / 10;
          const numX = cx + Math.cos(angle) * (r - 14);
          const numY = cy + Math.sin(angle) * (r - 14);

          c.font = 'bold 8px "Orbitron"';
          c.fillStyle = numVal >= 2.8 ? '#ff4d4d' : '#e2e8f0';
          c.fillText(numVal.toString(), numX, numY);
        }
      }

      // Economy Green band arc
      c.beginPath();
      c.arc(cx, cy, r - 2, startAngle + (10 / 40) * angleRange, startAngle + (22 / 40) * angleRange, false);
      c.strokeStyle = 'rgba(0, 255, 102, 0.35)';
      c.lineWidth = 2;
      c.stroke();

      // Redline warning arc
      c.beginPath();
      c.arc(cx, cy, r - 2, startAngle + (28 / 40) * angleRange, endAngle, false);
      c.strokeStyle = 'rgba(255, 51, 51, 0.4)';
      c.lineWidth = 2;
      c.stroke();

      // Gauge title label
      c.font = '900 7px "Share Tech Mono"';
      c.fillStyle = 'var(--color-amber)';
      c.fillText('x1000 RPM', cx, cy - r * 0.45);

      // Draw Center Hub
      c.beginPath();
      c.arc(cx, cy, r * 0.16, 0, Math.PI * 2);
      c.fillStyle = '#16191f';
      c.fill();
      c.strokeStyle = '#2d333f';
      c.lineWidth = 1;
      c.stroke();

      // Draw Swinging Needle
      const needleAngle = startAngle + rpmVal * angleRange;
      const needleLen = r - 6;

      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(needleAngle) * needleLen, cy + Math.sin(needleAngle) * needleLen);
      c.strokeStyle = '#ff2b2b';
      c.lineWidth = 1.5;
      c.lineCap = 'round';
      
      c.shadowColor = 'rgba(0,0,0,0.5)';
      c.shadowBlur = 3;
      c.stroke();
      
      c.restore();
    };

    const drawVoltmeter = (c, cx, cy, r, voltageVal) => {
      c.save();

      // Gauge face gradient
      c.beginPath();
      c.arc(cx, cy, r, Math.PI * 0.9, Math.PI * 2.1);
      c.lineTo(cx, cy);
      c.closePath();
      
      const faceGrad = c.createRadialGradient(cx, cy - r * 0.3, r * 0.2, cx, cy - r * 0.3, r);
      faceGrad.addColorStop(0, '#1a1f26');
      faceGrad.addColorStop(0.8, '#12151a');
      faceGrad.addColorStop(1, '#0b0c0e');
      c.fillStyle = faceGrad;
      c.fill();

      // Outer Chrome Ring
      c.beginPath();
      c.arc(cx, cy, r, Math.PI * 0.9, Math.PI * 2.1);
      c.strokeStyle = '#2b313a';
      c.lineWidth = 2.5;
      c.stroke();

      c.beginPath();
      c.arc(cx, cy, r + 1, Math.PI * 0.9, Math.PI * 2.1);
      c.strokeStyle = '#4a5361';
      c.lineWidth = 0.5;
      c.stroke();

      // Scale markings (8 to 16 Volts)
      const startAngle = Math.PI * 1.05;
      const endAngle = Math.PI * 1.95;
      const angleRange = endAngle - startAngle;

      c.textAlign = 'center';
      c.textBaseline = 'middle';

      for (let i = 0; i <= 8; i++) {
        const angle = startAngle + (i / 8) * angleRange;
        const voltVal = 8 + i;
        
        const tickStart = r - 8;
        const isRed = voltVal <= 10 || voltVal >= 15;
        const tickColor = isRed ? '#ff3333' : '#a0aec0';

        c.beginPath();
        c.moveTo(cx + Math.cos(angle) * tickStart, cy + Math.sin(angle) * tickStart);
        c.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
        c.strokeStyle = tickColor;
        c.lineWidth = 1.5;
        c.stroke();

        // Major numbers
        const numX = cx + Math.cos(angle) * (r - 14);
        const numY = cy + Math.sin(angle) * (r - 14);

        c.font = 'bold 7px "Orbitron"';
        c.fillStyle = isRed ? '#ff4d4d' : '#e2e8f0';
        c.fillText(voltVal.toString(), numX, numY);
      }

      // Red warning zone arcs
      c.beginPath();
      c.arc(cx, cy, r - 2, startAngle, startAngle + (2 / 8) * angleRange, false); // 8-10V
      c.strokeStyle = 'rgba(255, 51, 51, 0.4)';
      c.lineWidth = 2;
      c.stroke();

      c.beginPath();
      c.arc(cx, cy, r - 2, startAngle + (7 / 8) * angleRange, endAngle, false); // 15-16V
      c.strokeStyle = 'rgba(255, 51, 51, 0.4)';
      c.lineWidth = 2;
      c.stroke();

      // Gauge title label
      c.font = '900 6px "Share Tech Mono"';
      c.fillStyle = 'var(--color-amber)';
      c.fillText('BATT (VOLTS)', cx, cy - r * 0.45);

      // Draw Center Hub
      c.beginPath();
      c.arc(cx, cy, r * 0.16, 0, Math.PI * 2);
      c.fillStyle = '#16191f';
      c.fill();
      c.strokeStyle = '#2d333f';
      c.lineWidth = 1;
      c.stroke();

      // Draw Swinging Needle
      const voltPct = Math.max(0, Math.min(1.0, (voltageVal - 8) / 8));
      const needleAngle = startAngle + voltPct * angleRange;
      const needleLen = r - 6;

      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(needleAngle) * needleLen, cy + Math.sin(needleAngle) * needleLen);
      c.strokeStyle = '#ff2b2b';
      c.lineWidth = 1.5;
      c.lineCap = 'round';
      
      c.shadowColor = 'rgba(0,0,0,0.5)';
      c.shadowBlur = 3;
      c.stroke();
      
      c.restore();
    };

    const drawSpeedometer = (c, w, h, level, arrowIntensity, finalRpm, finalVoltageVal) => {
      // Relative dimensions for triple gauge layout - Speedometer increased by 10%!
      const cx = w / 2;
      const cy = h * 0.82;
      const r = Math.min(w * 0.308, h * 0.715); // Increased main speedometer radius by 10% (0.28 * 1.1 = 0.308, 0.65 * 1.1 = 0.715)

      // Keep side gauges at their original absolute size proportion
      const r_side = r * 0.62; // side gauges remain at their original size
      const cx_left = cx - r * 1.23; // optimal spacing to prevent dial collisions
      const cy_left = h * 0.85;
      const cx_right = cx + r * 1.23;
      const cy_right = h * 0.85;

      // 1. Draw Side Gauges first
      drawTachometer(c, cx_left, cy_left, r_side, finalRpm);
      drawVoltmeter(c, cx_right, cy_right, r_side, finalVoltageVal);

      // 2. Draw main Speedometer
      c.save();

      // Gauge face gradient
      c.beginPath();
      c.arc(cx, cy, r, Math.PI * 0.9, Math.PI * 2.1);
      c.lineTo(cx, cy);
      c.closePath();
      
      const faceGrad = c.createRadialGradient(cx, cy - r * 0.3, r * 0.2, cx, cy - r * 0.3, r);
      faceGrad.addColorStop(0, '#1a1f26');
      faceGrad.addColorStop(0.8, '#12151a');
      faceGrad.addColorStop(1, '#0b0c0e');
      c.fillStyle = faceGrad;
      c.fill();

      // Outer Chrome Ring
      c.beginPath();
      c.arc(cx, cy, r, Math.PI * 0.9, Math.PI * 2.1);
      c.strokeStyle = '#2b313a';
      c.lineWidth = 4;
      c.stroke();

      c.beginPath();
      c.arc(cx, cy, r + 2, Math.PI * 0.9, Math.PI * 2.1);
      c.strokeStyle = '#4a5361';
      c.lineWidth = 1;
      c.stroke();

      // Scale markings (0 to 160 km/h)
      const startAngle = Math.PI * 1.05;
      const endAngle = Math.PI * 1.95;
      const angleRange = endAngle - startAngle;

      c.textAlign = 'center';
      c.textBaseline = 'middle';

      for (let i = 0; i <= 80; i++) {
        const angle = startAngle + (i / 80) * angleRange;
        const isMajor = i % 10 === 0;
        const isMedium = i % 5 === 0 && !isMajor;
        
        const tickStart = isMajor ? r - 16 : (isMedium ? r - 10 : r - 6);
        const tickColor = i >= 65 ? '#ff3333' : '#a0aec0'; // Redline at 130 km/h

        c.beginPath();
        c.moveTo(cx + Math.cos(angle) * tickStart, cy + Math.sin(angle) * tickStart);
        c.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
        c.strokeStyle = tickColor;
        c.lineWidth = isMajor ? 2.5 : 1;
        c.stroke();

        // Major numbers
        if (isMajor) {
          const speedVal = i * 2; // scale maps 0 to 160
          const numX = cx + Math.cos(angle) * (r - 28);
          const numY = cy + Math.sin(angle) * (r - 28);

          c.font = '900 11px "Orbitron"';
          c.fillStyle = i >= 65 ? '#ff4d4d' : '#e2e8f0';
          c.fillText(speedVal.toString(), numX, numY);
        }
      }

      // Redline warning arc
      c.beginPath();
      c.arc(cx, cy, r - 3, startAngle + (65 / 80) * angleRange, endAngle, false);
      c.strokeStyle = 'rgba(255, 51, 51, 0.6)';
      c.lineWidth = 3;
      c.stroke();

      c.font = 'bold 9px "Share Tech Mono"';
      c.fillStyle = 'var(--color-amber)';
      c.shadowColor = 'rgba(255, 132, 0, 0.4)';
      c.shadowBlur = 4;
      c.fillText('km/h (dB)', cx, cy - r * 0.5);
      c.shadowBlur = 0; // reset

      // 3. Draw Odometer box (Mileage counter) - Made 25% smaller!
      const odoW = 56; // 75 * 0.75 = 56px (25% smaller width)
      const odoH = 12; // 16 * 0.75 = 12px (25% smaller height)
      const odoX = cx - odoW / 2;
      const odoY = cy - r * 0.5 + Math.max(6, r * 0.05); // placed directly under km/h!

      // Odo background
      c.fillStyle = '#080a0d';
      c.fillRect(odoX, odoY, odoW, odoH);
      c.strokeStyle = '#3e4652';
      c.lineWidth = 1.0; // slightly thinner borders for scaled odo
      c.strokeRect(odoX, odoY, odoW, odoH);

      // Format total playlist duration
      const totalPlaylistDuration = songs && songs.length > 0
        ? songs.reduce((sum, s) => sum + (s.duration || 0), 0)
        : 0;
      
      const mins = Math.floor(totalPlaylistDuration / 60);
      const secs = Math.floor(totalPlaylistDuration % 60);
      
      const minsStr = String(mins).padStart(4, '0');
      const secsStr = String(secs).padStart(2, '0');
      const mileageStr = `${minsStr}.${secsStr}`;
      c.font = 'bold 8px "Share Tech Mono"'; // smaller font size
      c.textAlign = 'left';
      c.textBaseline = 'top';
      
      const digitW = odoW / 7;
      for (let d = 0; d < 7; d++) {
        const char = mileageStr[d];
        const charX = odoX + d * digitW + 1.5; // adjusted padding

        if (d > 0) {
          c.beginPath();
          c.moveTo(odoX + d * digitW, odoY);
          c.lineTo(odoX + d * digitW, odoY + odoH);
          c.strokeStyle = '#222';
          c.lineWidth = 0.5;
          c.stroke();
        }

        c.fillStyle = d >= 5 ? '#ff3333' : '#00ff66';
        c.fillText(char, charX, odoY + 1.2); // adjusted vertical position
      }

      // 4. Draw Warning Dashboard Lights inside Speedometer face
      drawIndicatorLights(c, cx, cy, r, level, arrowIntensity, h);

      // 5. Draw speedometer center hub
      c.beginPath();
      c.arc(cx, cy, r * 0.16, 0, Math.PI * 2);
      c.fillStyle = '#16191f';
      c.fill();
      c.strokeStyle = '#2d333f';
      c.lineWidth = 2;
      c.stroke();

      // 6. Draw Swinging Needle
      const needleAngle = startAngle + level * angleRange;
      const needleLen = r - 12;

      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(needleAngle) * needleLen, cy + Math.sin(needleAngle) * needleLen);
      c.strokeStyle = '#ff2b2b';
      c.lineWidth = 2.5;
      c.lineCap = 'round';
      
      c.shadowColor = 'rgba(0,0,0,0.6)';
      c.shadowBlur = 6;
      c.shadowOffsetX = 2;
      c.shadowOffsetY = 3;
      c.stroke();
      
      c.shadowColor = 'transparent'; // reset
      c.shadowBlur = 0;
      c.shadowOffsetX = 0;
      c.shadowOffsetY = 0;

      // Small hub cap
      c.beginPath();
      c.arc(cx, cy, 10, 0, Math.PI * 2);
      c.fillStyle = '#090a0c';
      c.fill();
      c.strokeStyle = '#ff2b2b';
      c.lineWidth = 1;
      c.stroke();

      c.restore();
    };

    const drawIndicatorLights = (c, cx, cy, r, level, arrowIntensity, h) => {
      c.save();
      c.textAlign = 'center';
      
      // Relative dimensions for triple gauge layout to find side gauge positions
      const r_side = r * 0.62;
      const cx_left = cx - r * 1.23;
      const cy_left = h * 0.85;
      const cx_right = cx + r * 1.23;
      const cy_right = h * 0.85;

      // Indicators Y position (scaled inside center dial)
      const indY = cy - r * 0.22;
      const arrowSz = Math.max(5, r * 0.075);

      // 1. Left Turn Arrow (positioned under the zero mark of the Left Tachometer Dial, shifted 205px closer to center - pointed 180 deg, inwards to center)
      const arrowLX = cx_left - r_side * 0.9 + 205;
      const arrowLY = cy_left + r_side * 0.22;
      
      c.beginPath();
      c.moveTo(arrowLX + arrowSz, arrowLY);
      c.lineTo(arrowLX, arrowLY - arrowSz * 0.7);
      c.lineTo(arrowLX, arrowLY - arrowSz * 0.25);
      c.lineTo(arrowLX - arrowSz, arrowLY - arrowSz * 0.25);
      c.lineTo(arrowLX - arrowSz, arrowLY + arrowSz * 0.25);
      c.lineTo(arrowLX, arrowLY + arrowSz * 0.25);
      c.lineTo(arrowLX, arrowLY + arrowSz * 0.7);
      c.closePath();
      
      c.fillStyle = '#16221a';
      c.fill();
      
      if (arrowIntensity > 0) {
        c.save();
        c.fillStyle = `rgba(0, 255, 102, ${arrowIntensity})`;
        c.shadowColor = '#00ff66';
        c.shadowBlur = 5 * arrowIntensity;
        c.fill();
        c.restore();
      }

      // 2. Right Turn Arrow (positioned under the 16 mark of the Right Voltmeter Dial, shifted 205px closer to center - pointed 180 deg, inwards to center)
      const arrowRX = cx_right + r_side * 0.9 - 205;
      const arrowRY = cy_right + r_side * 0.22;
      
      c.beginPath();
      c.moveTo(arrowRX - arrowSz, arrowRY);
      c.lineTo(arrowRX, arrowRY - arrowSz * 0.7);
      c.lineTo(arrowRX, arrowRY - arrowSz * 0.25);
      c.lineTo(arrowRX + arrowSz, arrowRY - arrowSz * 0.25);
      c.lineTo(arrowRX + arrowSz, arrowRY + arrowSz * 0.25);
      c.lineTo(arrowRX, arrowRY + arrowSz * 0.25);
      c.lineTo(arrowRX, arrowRY + arrowSz * 0.7);
      c.closePath();
      
      c.fillStyle = '#16221a';
      c.fill();
      
      if (arrowIntensity > 0) {
        c.save();
        c.fillStyle = `rgba(0, 255, 102, ${arrowIntensity})`;
        c.shadowColor = '#00ff66';
        c.shadowBlur = 5 * arrowIntensity;
        c.fill();
        c.restore();
      }

      // 3. High Beam Light (Blue)
      const highBeamActive = isPlaying && level > 0.82;
      c.beginPath();
      c.arc(cx, indY, Math.max(2, r * 0.035), 0, Math.PI * 2);
      c.fillStyle = highBeamActive ? '#0077ff' : '#0e1724';
      if (highBeamActive) {
        c.shadowColor = '#0077ff';
        c.shadowBlur = 6;
      }
      c.fill();
      c.shadowBlur = 0;

      c.font = '900 6px "Inter"';
      c.fillStyle = highBeamActive ? '#94c5ff' : '#333';
      c.fillText('BEAM', cx, indY + Math.max(6, r * 0.08));

      // 4. Oil Warning Light (Red)
      const oilActive = !isPlaying;
      c.beginPath();
      c.arc(cx - r * 0.4, indY, Math.max(1.5, r * 0.026), 0, Math.PI * 2);
      c.fillStyle = oilActive ? '#ff3333' : '#2d1414';
      if (oilActive) {
        c.shadowColor = '#ff3333';
        c.shadowBlur = 5;
      }
      c.fill();
      c.shadowBlur = 0;

      c.fillStyle = oilActive ? '#ff9999' : '#333';
      c.fillText('PAUSED', cx - r * 0.4, indY + Math.max(5, r * 0.07));

      // 5. Check Engine Light (Amber)
      const checkEngineActive = isPlaying && level < 0.05;
      c.beginPath();
      c.arc(cx + r * 0.4, indY, Math.max(1.5, r * 0.026), 0, Math.PI * 2);
      c.fillStyle = checkEngineActive ? '#ff8400' : '#2d2014';
      if (checkEngineActive) {
        c.shadowColor = '#ff8400';
        c.shadowBlur = 5;
      }
      c.fill();
      c.shadowBlur = 0;

      c.fillStyle = checkEngineActive ? '#ffb366' : '#333';
      c.fillText('IDLE', cx + r * 0.4, indY + Math.max(5, r * 0.07));

      c.restore();
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [isPlaying, analyser]);

  const onUploadButtonClick = () => {
    triggerTactileFeedback('button_press');
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(Array.from(e.target.files));
    }
  };

  const uploadFiles = async (files) => {
    const audioFiles = files.filter(file => 
      file.type.startsWith('audio/') || 
      file.name.endsWith('.mp3') || 
      file.name.endsWith('.wav')
    );
    
    if (audioFiles.length === 0) {
      if (showToast) showToast('МОЖНА ЗАВАНТАЖУВАТИ ТІЛЬКИ АУДІОФАЙЛИ!');
      return;
    }

    setUploading(true);
    setUploadProgress('0%');

    const formData = new FormData();
    audioFiles.forEach(file => {
      formData.append('audio', file);
    });

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/playlist/upload');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(`${percentComplete}%`);
      }
    };

    xhr.onload = () => {
      setUploading(false);
      setUploadProgress('');
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const addedSongs = JSON.parse(xhr.responseText);
          onUploadSuccess(addedSongs);
          if (showToast) showToast(`УСПІШНО ЗАВАНТАЖЕНО ${addedSongs.length} ПІСЕНЬ!`);
        } catch (e) {
          console.error('Error parsing upload response:', e);
          if (showToast) showToast('ПОМИЛКА ОБРОБКИ ФАЙЛІВ');
        }
      } else {
        if (showToast) showToast('ПОМИЛКА ЗАВАНТАЖЕННЯ');
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setUploadProgress('');
      if (showToast) showToast('ПОМИЛКА МЕРЕЖІ');
    };

    xhr.send(formData);
  };

  return (
    <div className="digital-display carbon-panel" style={{ padding: '4px', borderRadius: '10px', position: 'relative' }}>
      

      {/* Hidden file input for file selection */}
      <input 
        ref={fileInputRef}
        type="file" 
        multiple
        accept="audio/*" 
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Add Songs button in top-left corner */}
      <button 
        className="share-vu-btn"
        onClick={onUploadButtonClick}
        disabled={uploading}
        title="Додати аудіофайли з комп'ютера"
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
        }}
      >
        <span>{uploading ? '⌛' : '📻'}</span> {uploading ? `ЗАВАНТАЖЕННЯ (${uploadProgress})` : 'ДОДАТИ ПІСНЮ'}
      </button>

      {/* Share button in top-right corner */}
      <button 
        className="share-vu-btn"
        onClick={() => {
          triggerTactileFeedback('button_press');
          onShareClick();
        }}
        title="Поділитися плеером"
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
        }}
      >
        <span>🔗</span> ПОДІЛИТИСЬ
      </button>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', borderRadius: '4px' }} />
    </div>
  );
}
