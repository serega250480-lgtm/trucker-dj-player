import React, { useState } from 'react';
import { triggerTactileFeedback } from '../utils/tactile';

export default function StartScreen({ onStart, audioContextRef }) {
  const [ignitionState, setIgnitionState] = useState('idle'); // idle | cranking | fired | fading

  const handleIgnitionClick = (e) => {
    e.stopPropagation(); // Prevent duplicate triggers
    if (ignitionState !== 'idle') return;

    // Trigger initial heavy haptic click
    triggerTactileFeedback('button_press');

    setIgnitionState('cranking');

    // 1. Initialize & unlock Audio Context
    let ctx = audioContextRef.current;
    if (!ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioContextClass();
      audioContextRef.current = ctx;
    }
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // 2. Synthesize heavy diesel starting sound
    playIgnitionSound(ctx);

    // 3. Cranking transitions: cranking (0s - 1.4s) -> fired (1.4s - 2.8s) -> fading (2.8s - 3.6s)
    setTimeout(() => {
      setIgnitionState('fired');
    }, 1400);

    setTimeout(() => {
      setIgnitionState('fading');
    }, 2800);

    setTimeout(() => {
      onStart(ctx); // Transition to main player cabin
    }, 3600);
  };

  const playIgnitionSound = (ctx) => {
    const now = ctx.currentTime;

    // --- PHASE 1: STARTER MOTOR HUM & CRANK CLICKING (0.0s - 1.4s) ---
    const crankOsc = ctx.createOscillator();
    const crankGain = ctx.createGain();
    crankOsc.type = 'sawtooth';
    crankOsc.frequency.setValueAtTime(42, now);
    crankOsc.frequency.linearRampToValueAtTime(75, now + 1.3);

    const crankFilter = ctx.createBiquadFilter();
    crankFilter.type = 'lowpass';
    crankFilter.frequency.setValueAtTime(160, now);

    crankOsc.connect(crankGain);
    crankGain.connect(crankFilter);
    crankFilter.connect(ctx.destination);

    crankGain.gain.setValueAtTime(0, now);
    crankGain.gain.linearRampToValueAtTime(0.28, now + 0.1);
    crankGain.gain.setValueAtTime(0.28, now + 1.25);
    crankGain.gain.exponentialRampToValueAtTime(0.001, now + 1.35);

    const clickInterval = 0.18;
    for (let t = 0; t < 1.3; t += clickInterval) {
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(80, now + t);
      clickOsc.frequency.exponentialRampToValueAtTime(20, now + t + 0.08);

      const clickFilter = ctx.createBiquadFilter();
      clickFilter.type = 'lowpass';
      clickFilter.frequency.setValueAtTime(180, now + t);

      clickOsc.connect(clickGain);
      clickGain.connect(clickFilter);
      clickFilter.connect(ctx.destination);

      clickGain.gain.setValueAtTime(0.45, now + t);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.08);

      clickOsc.start(now + t);
      clickOsc.stop(now + t + 0.1);
    }

    crankOsc.start(now);
    crankOsc.stop(now + 1.4);

    // --- PHASE 2: ENGINE FIRING (VROOOOM!) (1.4s - 2.0s) ---
    const fireOsc = ctx.createOscillator();
    const fireGain = ctx.createGain();
    fireOsc.type = 'sawtooth';
    fireOsc.frequency.setValueAtTime(140, now + 1.38);
    fireOsc.frequency.exponentialRampToValueAtTime(46, now + 2.0);

    const fireFilter = ctx.createBiquadFilter();
    fireFilter.type = 'lowpass';
    fireFilter.frequency.setValueAtTime(120, now + 1.38);

    fireOsc.connect(fireGain);
    fireGain.connect(fireFilter);
    fireFilter.connect(ctx.destination);

    fireGain.gain.setValueAtTime(0, now);
    fireGain.gain.setValueAtTime(0.75, now + 1.38);
    fireGain.gain.exponentialRampToValueAtTime(0.2, now + 2.0);

    fireOsc.start(now + 1.38);
    fireOsc.stop(now + 3.6);

    // --- PHASE 3: ENGINE IDLE RUMBLE (1.9s - 3.6s) ---
    const idleOsc1 = ctx.createOscillator();
    const idleOsc2 = ctx.createOscillator();
    const idleGain = ctx.createGain();

    idleOsc1.type = 'sawtooth';
    idleOsc1.frequency.setValueAtTime(29, now + 1.9);
    idleOsc2.type = 'sawtooth';
    idleOsc2.frequency.setValueAtTime(37, now + 1.9);

    const idleFilter = ctx.createBiquadFilter();
    idleFilter.type = 'lowpass';
    idleFilter.frequency.setValueAtTime(65, now + 1.9);

    idleOsc1.connect(idleGain);
    idleOsc2.connect(idleGain);
    idleGain.connect(idleFilter);
    idleFilter.connect(ctx.destination);

    idleGain.gain.setValueAtTime(0, now);
    idleGain.gain.setValueAtTime(0.25, now + 1.9);
    idleGain.gain.setValueAtTime(0.25, now + 2.8);
    idleGain.gain.exponentialRampToValueAtTime(0.001, now + 3.5);

    idleOsc1.start(now + 1.9);
    idleOsc2.start(now + 1.9);
    idleOsc1.stop(now + 3.6);
    idleOsc2.stop(now + 3.6);
  };

  // Determine CSS class modifiers based on state
  let overlayClass = 'start-screen-overlay';
  if (ignitionState === 'cranking') overlayClass += ' cranking';
  if (ignitionState === 'fired') overlayClass += ' cranking fired';
  if (ignitionState === 'fading') overlayClass += ' fade-out fired';

  return (
    <div className={overlayClass}>
      <div className="start-screen-content">
        {/* Decorative radial glows overlaying target image spots */}
        <div className="ignition-glow-effect" />

        {/* Circular Clickable Hotspot covering the START/STOP button */}
        {ignitionState === 'idle' && (
          <div 
            className="start-button-hotspot" 
            onClick={handleIgnitionClick} 
            title="Запустити двигун"
          />
        )}

        {/* Top Spacer */}
        <div style={{ height: '80px' }} />

        {/* Middle Spacer */}
        <div style={{ flex: 1 }} />

        {/* Status Text HUD overlay */}
        <div className="start-screen-prompt">
          {ignitionState === 'idle' && '🔑 НАДУШІТЬ КНОПКУ СТАРТ ДЛЯ ЗАПУСКУ'}
          {ignitionState === 'cranking' && '⌛ ЗАПУСК СТАРТЕРА...'}
          {ignitionState === 'fired' && '💚 ДВИГУН ЗАВЕДЕНО!'}
          {ignitionState === 'fading' && '🚚 ВХІД У КАБІНУ...'}
        </div>
      </div>
    </div>
  );
}
