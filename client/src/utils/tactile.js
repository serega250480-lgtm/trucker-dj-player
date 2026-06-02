// Tactile and Mechanical Haptic Feedback Utility for Road DJ Player

const playMechanicalSound = (type) => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    
    // Short-lived, high-priority AudioContext for absolute zero latency
    const ctx = new AudioContextClass();
    
    // Helper to generate a short burst of white noise
    const createNoiseSource = (duration) => {
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      return source;
    };
    
    const now = ctx.currentTime;
    
    if (type === 'button_press') {
      // Solid mechanical button click: metallic impact + low cabinet thud
      // 1. High frequency transient (contact impact)
      const noise = createNoiseSource(0.02);
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(3000, now);
      noiseFilter.Q.setValueAtTime(3, now);
      
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.2, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
      
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      
      // 2. Low-frequency thud (button housing resonance)
      const bodyOsc = ctx.createOscillator();
      bodyOsc.type = 'sine';
      bodyOsc.frequency.setValueAtTime(180, now);
      bodyOsc.frequency.exponentialRampToValueAtTime(60, now + 0.035);
      
      const bodyGain = ctx.createGain();
      bodyGain.gain.setValueAtTime(0.35, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      
      bodyOsc.connect(bodyGain);
      bodyGain.connect(ctx.destination);
      
      noise.start(now);
      bodyOsc.start(now);
      bodyOsc.stop(now + 0.05);
      
    } else if (type === 'switch_on') {
      // Heavy double-click of a mechanical spring toggle flipping ON
      // First click (impact)
      const noise = createNoiseSource(0.012);
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(4000, now);
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.01);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.015);
      
      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.25, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
      
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.02);
      noise.start(now);
      
      // Second spring rebound click 15ms later
      setTimeout(() => {
        try {
          const noise2 = createNoiseSource(0.01);
          const filter2 = ctx.createBiquadFilter();
          filter2.type = 'bandpass';
          filter2.frequency.setValueAtTime(2500, ctx.currentTime);
          
          const gain2 = ctx.createGain();
          gain2.gain.setValueAtTime(0.12, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.008);
          
          noise2.connect(filter2);
          filter2.connect(gain2);
          gain2.connect(ctx.destination);
          
          noise2.start(ctx.currentTime);
        } catch (e) {}
      }, 15);
      
    } else if (type === 'switch_off') {
      // Lower pitch spring release click for flipping OFF
      const noise = createNoiseSource(0.018);
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(2500, now);
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.022);
      
      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.22, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);
      
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.025);
      noise.start(now);
      
      // Secondary spring release rebound 20ms later
      setTimeout(() => {
        try {
          const noise2 = createNoiseSource(0.015);
          const filter2 = ctx.createBiquadFilter();
          filter2.type = 'bandpass';
          filter2.frequency.setValueAtTime(1800, ctx.currentTime);
          
          const gain2 = ctx.createGain();
          gain2.gain.setValueAtTime(0.08, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.012);
          
          noise2.connect(filter2);
          filter2.connect(gain2);
          gain2.connect(ctx.destination);
          
          noise2.start(ctx.currentTime);
        } catch (e) {}
      }, 20);
      
    } else if (type === 'dial_tick') {
      // Small plastic/metal knurled dial gear tick
      const noise = createNoiseSource(0.005);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(6000, now);
      filter.Q.setValueAtTime(5, now);
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.004);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      noise.start(now);
    } else if (type === 'radio_static') {
      // Radio tuning white static sweep ("пшш-ш-ш-ууп")
      const noise = createNoiseSource(0.35); // 350ms of static
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      // Sweep bandpass frequency from 1000Hz to 3200Hz to simulate dial turning!
      filter.frequency.setValueAtTime(1000, now);
      filter.frequency.exponentialRampToValueAtTime(3200, now + 0.15);
      filter.frequency.exponentialRampToValueAtTime(1800, now + 0.35);
      filter.Q.setValueAtTime(1.5, now);
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.24, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      noise.start(now);
    }
  } catch (e) {
    console.warn('Tactile sound playback blocked or unsupported:', e);
  }
};

const triggerHapticFeedback = (intensity) => {
  try {
    if ('vibrate' in navigator) {
      if (intensity === 'light') {
        navigator.vibrate(8); // Ultra short tap for scrollwheels and seek ticks
      } else if (intensity === 'medium') {
        navigator.vibrate(18); // Solid button click vibration
      } else if (intensity === 'heavy') {
        navigator.vibrate([12, 25, 12]); // Tactile toggle switch rebound snap
      }
    }
  } catch (e) {
    // Silent fail if haptics are not supported or blocked by user permissions
  }
};

export const triggerTactileFeedback = (type) => {
  // 1. Play zero-latency synthetic sound
  playMechanicalSound(type);
  
  // 2. Trigger physical phone vibration based on control type
  if (type === 'dial_tick') {
    triggerHapticFeedback('light');
  } else if (type === 'button_press') {
    triggerHapticFeedback('medium');
  } else if (type === 'switch_on' || type === 'switch_off') {
    triggerHapticFeedback('heavy');
  } else if (type === 'radio_static') {
    triggerHapticFeedback('medium');
  }
};
