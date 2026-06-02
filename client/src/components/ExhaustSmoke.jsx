import React, { useEffect, useRef } from 'react';

export default function ExhaustSmoke({ isPlaying, analyser }) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animationRef = useRef(null);
  const lastSpawnRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    // Dynamically calculate width and height of parent banner
    let w = canvas.offsetWidth;
    let h = canvas.offsetHeight;
    
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const handleResize = () => {
      if (!canvas) return;
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
    };

    window.addEventListener('resize', handleResize);

    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

    const updateAndDraw = () => {
      // Clear canvas using transparent clear
      ctx.clearRect(0, 0, w, h);

      // 1. Get real-time bass energy from active frequencies
      let bassLevel = 0;
      if (isPlaying && analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
        // Average low frequency bins (0 to 5) for deep bass
        let sum = 0;
        const count = 6;
        for (let i = 0; i < count; i++) {
          sum += dataArray[i];
        }
        bassLevel = sum / count; // 0 to 255
      } else if (isPlaying) {
        // Fallback simulation beats
        bassLevel = 80 + Math.sin(Date.now() * 0.007) * 45;
        if (Math.random() > 0.94) bassLevel += 80;
      }

      // 2. Control emission rate and size based on bass intensity
      const now = Date.now();
      // Thicker spawning: spawn interval drops dramatically on bass hits
      const spawnInterval = Math.max(12, 110 - (bassLevel * 0.45));

      if (isPlaying && (now - lastSpawnRef.current > spawnInterval)) {
        lastSpawnRef.current = now;

        // Spawn multiple puffs on heavy bass to represent thick diesel "rolling coal" smoke!
        const countToSpawn = bassLevel > 180 ? 4 : (bassLevel > 110 ? 2 : 1);
        for (let k = 0; k < countToSpawn; k++) {
          // Smoke starts behind the truck emoji (around x = 20px, y = 20px)
          particlesRef.current.push({
            x: 20 + (Math.random() - 0.5) * 4,
            y: 20 + (Math.random() - 0.5) * 4,
            // Slide horizontally from left to right!
            vx: 1.8 + (bassLevel / 65) + Math.random() * 0.8, // shoots rightwards, faster on beats!
            vy: (Math.random() - 0.5) * 0.35,                // subtle wavy vertical drift
            size: 3.5 + (bassLevel / 45) + Math.random() * 2.5,  // thicker/larger on beats!
            alpha: 0.65 + (bassLevel / 380),                    // dense/thick exhaust!
            growth: 0.08 + Math.random() * 0.06,
            life: 0,
            maxLife: 280 + Math.random() * 60 // Long lifespan to survive the journey to the right edge
          });
        }
      }

      // 3. Physics update and canvas drawing
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;

        // Kinematics: drift horizontally rightwards, expand and fade
        p.x += p.vx;
        p.y += p.vy;
        p.vy += (Math.sin(p.life * 0.05 + p.size) * 0.02); // sine-wave path for organic smoke wave
        p.size += p.growth;

        const lifeRatio = p.life / p.maxLife;
        const currentAlpha = p.alpha * (1 - lifeRatio);

        // Remove dead particles or particles that went off-screen
        if (lifeRatio >= 1.0 || p.size <= 0 || p.x > w + 40) {
          particles.splice(i, 1);
          continue;
        }

        // Draw soft volumetric smoke puffs
        ctx.save();
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        
        // Highly dense carbon black and charcoal diesel smoke colors
        grad.addColorStop(0, `rgba(40, 40, 40, ${currentAlpha * 0.85})`);
        grad.addColorStop(0.3, `rgba(52, 52, 52, ${currentAlpha * 0.7})`);
        grad.addColorStop(0.65, `rgba(80, 80, 80, ${currentAlpha * 0.25})`);
        grad.addColorStop(1, 'rgba(80, 80, 80, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animationRef.current = requestAnimationFrame(updateAndDraw);
    };

    updateAndDraw();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [isPlaying, analyser]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ 
        position: 'absolute', 
        top: '-10px', 
        left: '0', 
        width: '100%', 
        height: '50px', 
        pointerEvents: 'none',
        zIndex: 2 // behind title text but in front of wood grain
      }} 
    />
  );
}
