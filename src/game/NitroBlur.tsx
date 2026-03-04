import { forwardRef, useMemo } from 'react';
import { Effect } from 'postprocessing';
import { Uniform, Vector2 } from 'three';

// Highly optimized radial blur shader for nitro effect
// Uses minimal samples and efficient blur algorithm for low-end devices
const fragmentShader = `
uniform float strength;
uniform vec2 center;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // Early exit if no blur needed (performance optimization)
  if (strength < 0.001) {
    outputColor = inputColor;
    return;
  }
  
  vec2 dir = uv - center;
  float dist = length(dir);
  
  // Vignette-style falloff: stronger blur at edges, minimal at center
  float radialFactor = smoothstep(0.0, 0.8, dist);
  float blurAmount = strength * radialFactor;
  
  // Efficient 5-sample radial blur (instead of expensive 16+ samples)
  vec4 color = inputColor;
  vec2 velocity = normalize(dir) * blurAmount * 0.02;
  
  // Optimized sampling pattern
  color += texture2D(inputBuffer, uv - velocity * 1.0);
  color += texture2D(inputBuffer, uv - velocity * 2.0);
  color += texture2D(inputBuffer, uv - velocity * 3.0);
  color += texture2D(inputBuffer, uv - velocity * 4.0);
  
  outputColor = color * 0.2; // Average of 5 samples
}
`;

// Custom effect class for radial blur
class NitroBlurEffect extends Effect {
  constructor({ strength = 0.0 } = {}) {
    super('NitroBlurEffect', fragmentShader, {
      uniforms: new Map<string, Uniform>([
        ['strength', new Uniform(strength)],
        ['center', new Uniform(new Vector2(0.5, 0.5))], // Center of screen
      ]),
    });
  }
}

// React component wrapper
export const NitroBlur = forwardRef<NitroBlurEffect, { strength?: number }>(
  ({ strength = 0.0 }, ref) => {
    const effect = useMemo(() => new NitroBlurEffect({ strength }), [strength]);

    // Update strength uniform when prop changes
    useMemo(() => {
      if (effect.uniforms.get('strength')) {
        effect.uniforms.get('strength')!.value = strength;
      }
    }, [effect, strength]);

    return <primitive ref={ref} object={effect} dispose={null} />;
  }
);

NitroBlur.displayName = 'NitroBlur';
