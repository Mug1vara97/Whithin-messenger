import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { extractFirstHexFromThemeValue } from '../../../lib/theme/appTheme';
import './StartupPreloader.css';

function readCssVar(name, fallback = '') {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function cssVarToHex(name, fallback) {
  return extractFirstHexFromThemeValue(readCssVar(name, fallback)) || fallback;
}

function hexToNumber(hex) {
  return parseInt(hex.replace('#', ''), 16);
}

function hexLuminance(hex) {
  const normalized = extractFirstHexFromThemeValue(hex);
  if (!normalized) return 0.5;
  const n = parseInt(normalized.replace('#', ''), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function readThemePalette() {
  const primaryHex = cssVarToHex('--primary', '#5865f2');
  const primaryHoverHex = cssVarToHex('--primary-hover', '#4752c4');
  const backgroundHex = cssVarToHex('--background', '#36393f');
  const backgroundPrimaryHex = cssVarToHex('--background-primary', '#2f3136');
  const surfaceHoverHex = cssVarToHex('--surface-hover', '#40444b');
  const textHex = cssVarToHex('--text', '#dcddde');
  const textSecondaryHex = cssVarToHex('--text-secondary', '#b9bbbe');
  const borderHex = cssVarToHex('--border', '#4f545c');

  const isLightTheme = hexLuminance(backgroundHex) > 0.45;
  const primaryIsTooDark = hexLuminance(primaryHex) < 0.22;
  const accentHex = primaryIsTooDark ? textHex : primaryHex;
  const accentHoverHex = primaryIsTooDark ? borderHex : primaryHoverHex;
  const pixelTintHex = primaryIsTooDark
    ? (isLightTheme ? surfaceHoverHex : textSecondaryHex)
    : primaryHex;

  return {
    primary: hexToNumber(accentHex),
    primaryHover: hexToNumber(accentHoverHex),
    background: hexToNumber(backgroundHex),
    backgroundPrimary: hexToNumber(backgroundPrimaryHex),
    text: textHex,
    textSecondary: hexToNumber(isLightTheme ? textHex : textSecondaryHex),
    isLightTheme,
    pixelTintHex,
  };
}

function applyPixelTint(pixelPass, pixelTintHex, isLightTheme) {
  if (!pixelPass) return;

  const tintLuminance = hexLuminance(pixelTintHex);
  if (tintLuminance < 0.15) {
    pixelPass.uniforms.tint.value.set(
      isLightTheme ? 0.94 : 1,
      isLightTheme ? 0.94 : 1,
      isLightTheme ? 0.96 : 1,
    );
    return;
  }

  const n = parseInt(pixelTintHex.replace('#', ''), 16);
  if (Number.isNaN(n)) return;
  pixelPass.uniforms.tint.value.set(
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
  );
}

function applyThemeToD20({
  keyLight,
  rimLight,
  ambientLight,
  innerMaterial,
  d20Material,
  edgeMaterial,
  edgeGlowMaterial,
  labelMaterials,
  pixelPass,
}) {
  const theme = readThemePalette();
  if (keyLight) keyLight.color.setHex(theme.primary);
  if (rimLight) rimLight.color.setHex(theme.primaryHover);
  if (ambientLight) ambientLight.color.setHex(theme.textSecondary);
  if (innerMaterial) innerMaterial.color.setHex(theme.backgroundPrimary);
  if (d20Material) {
    d20Material.color.setHex(theme.background);
    d20Material.opacity = theme.isLightTheme ? 0.52 : 0.32;
  }
  if (edgeMaterial) edgeMaterial.color.setHex(theme.primary);
  if (edgeGlowMaterial) edgeGlowMaterial.color.setHex(theme.primary);
  labelMaterials?.forEach((material) => {
    material.color.setHex(theme.textSecondary);
  });
  applyPixelTint(pixelPass, theme.pixelTintHex, theme.isLightTheme);
}

const PIXELATE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    pixelSize: { value: 2.8 },
    resolution: { value: new THREE.Vector2(1, 1) },
    tint: { value: new THREE.Vector3(0.96, 0.97, 1.02) }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float pixelSize;
    uniform vec2 resolution;
    uniform vec3 tint;
    varying vec2 vUv;

    void main() {
      vec2 dxy = pixelSize / resolution;
      vec2 coord = dxy * floor(vUv / dxy);
      vec4 color = texture2D(tDiffuse, coord);
      color.rgb *= tint;
      gl_FragColor = color;
    }
  `
};

const CRT_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0.0 },
    scanlineIntensity: { value: 0.045 },
    scanlineCount: { value: 620.0 },
    flickerAmount: { value: 0.025 },
    vignetteAmount: { value: 0.35 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float scanlineIntensity;
    uniform float scanlineCount;
    uniform float flickerAmount;
    uniform float vignetteAmount;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      vec4 color = texture2D(tDiffuse, uv);
      float scanline = sin(uv.y * scanlineCount + time * 11.0) * 0.5 + 0.5;
      float flicker = 1.0 + sin(time * 93.0) * flickerAmount;
      vec2 vv = (uv - 0.5) * 2.0;
      float vignette = 1.0 - dot(vv, vv) * vignetteAmount;
      color.rgb *= (1.0 - scanline * scanlineIntensity) * flicker * vignette;
      gl_FragColor = color;
    }
  `
};

const StartupPreloader = ({ isExiting = false, loadingText = 'Booting Whithin' }) => {
  const viewportRef = useRef(null);
  const d20FaceNumbers = [9, 6, 16, 3, 19, 14, 11, 1, 17, 8, 18, 5, 15, 12, 2, 4, 13, 7, 10, 20];

  useEffect(() => {
    window.__startupPreloaderActive = true;
    const viewport = viewportRef.current;
    if (!viewport) {
      return () => {
        window.__startupPreloaderActive = false;
      };
    }

    let scene;
    let camera;
    let renderer;
    let d20Geometry;
    let d20Material;
    let edgeGeometry;
    let edgeMaterial;
    let edgeGlowMaterial;
    let innerGeometry;
    let innerMaterial;
    let lineGeometry;
    let lineGlowGeometry;
    let d20;
    let labelGroup;
    const labelTextures = [];
    const labelMaterials = [];
    let keyLight;
    let rimLight;
    let ambientLight;
    let composer;
    let pixelPass;
    let crtPass;
    let frameId = 0;
    let handleThemeChange = null;

    const resize = () => {
      if (!renderer || !camera || !composer) return;
      const width = viewport.clientWidth || 1;
      const height = viewport.clientHeight || 1;
      const aspect = width / height;
      camera.left = -4.8 * aspect;
      camera.right = 4.8 * aspect;
      camera.top = 4.8;
      camera.bottom = -4.8;
      renderer.setSize(width, height, false);
      camera.updateProjectionMatrix();
      if (edgeMaterial) {
        edgeMaterial.resolution.set(width, height);
      }
      if (edgeGlowMaterial) {
        edgeGlowMaterial.resolution.set(width, height);
      }
      if (pixelPass) {
        pixelPass.uniforms.resolution.value.set(width, height);
      }
      composer.setSize(width, height);
    };

    try {
      scene = new THREE.Scene();
      scene.background = null;
      camera = new THREE.OrthographicCamera(-4.8, 4.8, 4.8, -4.8, 0.1, 100);
      camera.position.set(7, 6.2, 7);
      camera.lookAt(0, 0, 0);

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      viewport.appendChild(renderer.domElement);

      const theme = readThemePalette();

      ambientLight = new THREE.AmbientLight(theme.textSecondary, 0.28);
      keyLight = new THREE.DirectionalLight(theme.primary, 0.42);
      rimLight = new THREE.DirectionalLight(theme.primaryHover, 0.28);
      keyLight.position.set(8, 7, 6);
      rimLight.position.set(-6, -4, 5);
      scene.add(ambientLight, keyLight, rimLight);

      d20Geometry = new THREE.IcosahedronGeometry(2.7, 0);
      innerGeometry = new THREE.IcosahedronGeometry(2.56, 0);
      innerMaterial = new THREE.MeshBasicMaterial({
        color: theme.backgroundPrimary,
        transparent: true,
        opacity: 0.96
      });
      const innerMesh = new THREE.Mesh(innerGeometry, innerMaterial);

      d20Material = new THREE.MeshBasicMaterial({
        color: theme.background,
        transparent: true,
        opacity: 0.32
      });
      d20 = new THREE.Mesh(d20Geometry, d20Material);
      d20.add(innerMesh);
      const baseScale = 1.45;
      d20.scale.setScalar(baseScale);
      scene.add(d20);

      edgeGeometry = new THREE.EdgesGeometry(d20Geometry);
      lineGeometry = new LineSegmentsGeometry();
      lineGeometry.setPositions(edgeGeometry.attributes.position.array);
      edgeMaterial = new LineMaterial({
        color: theme.primary,
        linewidth: 2.8,
        transparent: true,
        opacity: 0.95
      });
      const d20Edges = new LineSegments2(lineGeometry, edgeMaterial);
      d20.add(d20Edges);

      lineGlowGeometry = new LineSegmentsGeometry();
      lineGlowGeometry.setPositions(edgeGeometry.attributes.position.array);
      edgeGlowMaterial = new LineMaterial({
        color: theme.primary,
        linewidth: 7.2,
        transparent: true,
        opacity: 0.2
      });
      const d20EdgesGlow = new LineSegments2(lineGlowGeometry, edgeGlowMaterial);
      d20.add(d20EdgesGlow);

      labelGroup = new THREE.Group();
      const positionAttribute = d20Geometry.attributes.position;
      const vA = new THREE.Vector3();
      const vB = new THREE.Vector3();
      const vC = new THREE.Vector3();
      for (let i = 0; i < positionAttribute.count; i += 3) {
        vA.fromBufferAttribute(positionAttribute, i);
        vB.fromBufferAttribute(positionAttribute, i + 1);
        vC.fromBufferAttribute(positionAttribute, i + 2);

        const center = new THREE.Vector3()
          .add(vA)
          .add(vB)
          .add(vC)
          .divideScalar(3)
          .normalize()
          .multiplyScalar(2.46);

        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = theme.text;
        ctx.fillText(String(d20FaceNumbers[i / 3] ?? (i / 3) + 1), 8, 8.5);

        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        labelTextures.push(texture);

        const material = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          depthTest: true,
          depthWrite: false,
          opacity: 0.92
        });
        labelMaterials.push(material);

        const sprite = new THREE.Sprite(material);
        sprite.scale.set(0.6, 0.6, 1);
        sprite.renderOrder = 2;

        const holder = new THREE.Object3D();
        holder.position.copy(center);
        holder.add(sprite);
        labelGroup.add(holder);
      }
      d20.add(labelGroup);

      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      pixelPass = new ShaderPass(PIXELATE_SHADER);
      crtPass = new ShaderPass(CRT_SHADER);
      composer.addPass(pixelPass);
      composer.addPass(crtPass);
      composer.addPass(new OutputPass());

      applyThemeToD20({
        keyLight,
        rimLight,
        ambientLight,
        innerMaterial,
        d20Material,
        edgeMaterial,
        edgeGlowMaterial,
        labelMaterials,
        pixelPass,
      });

      handleThemeChange = () => {
        applyThemeToD20({
          keyLight,
          rimLight,
          ambientLight,
          innerMaterial,
          d20Material,
          edgeMaterial,
          edgeGlowMaterial,
          labelMaterials,
          pixelPass,
        });
      };
      window.addEventListener('themePresetChanged', handleThemeChange);

      resize();
      window.addEventListener('resize', resize);

      const animate = (now) => {
        const t = now * 0.001;
        const cycle = t % 4.8;
        const isRolling = cycle < 2.2;
        const rollFactor = isRolling ? 1 : 0.2;
        const wobble = Math.sin(t * 1.4) * 0.05;

        d20.rotation.x += 0.012 * rollFactor;
        d20.rotation.y += 0.016 * rollFactor;
        d20.rotation.z += 0.009 * rollFactor;
        d20.position.y = Math.sin(t * 1.2) * 0.15;
        d20.scale.setScalar(baseScale + wobble);
        if (crtPass) crtPass.uniforms.time.value = t;

        composer.render();
        frameId = window.requestAnimationFrame(animate);
      };
      frameId = window.requestAnimationFrame(animate);
    } catch (error) {
      console.warn('StartupPreloader: WebGL unavailable.', error);
    }

    return () => {
      window.__startupPreloaderActive = false;
      if (handleThemeChange) {
        window.removeEventListener('themePresetChanged', handleThemeChange);
      }
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      if (d20Geometry) d20Geometry.dispose();
      if (innerGeometry) innerGeometry.dispose();
      if (d20Material) d20Material.dispose();
      if (innerMaterial) innerMaterial.dispose();
      if (edgeGeometry) edgeGeometry.dispose();
      if (edgeMaterial) edgeMaterial.dispose();
      if (edgeGlowMaterial) edgeGlowMaterial.dispose();
      if (lineGeometry) lineGeometry.dispose();
      if (lineGlowGeometry) lineGlowGeometry.dispose();
      labelTextures.forEach((texture) => texture.dispose());
      labelMaterials.forEach((material) => material.dispose());
      if (renderer) {
        renderer.dispose();
        if (viewport.contains(renderer.domElement)) {
          viewport.removeChild(renderer.domElement);
        }
      }
    };
  }, []);

  return (
    <div className={`startup-preloader ${isExiting ? 'is-exiting' : ''}`} data-nosnippet>
      <div className="startup-preloader__noise" />
      <div className="startup-preloader__scanlines" />

      <div className="startup-preloader__panel">
        <div ref={viewportRef} className="startup-preloader__viewport" aria-hidden="true" />

        <h1 className="startup-preloader__title">Whithin</h1>
        <p className="startup-preloader__subtitle">{loadingText}</p>
        <div className="startup-preloader__progress">
          <span />
        </div>
      </div>
    </div>
  );
};

export default StartupPreloader;

