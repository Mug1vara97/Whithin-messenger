import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import './StartupPreloader.css';

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
  const [useFallback, setUseFallback] = useState(false);
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
    let composer;
    let pixelPass;
    let crtPass;
    let frameId = 0;

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

      const ambientLight = new THREE.AmbientLight(0xb9bbbe, 0.28);
      const keyLight = new THREE.DirectionalLight(0x5865f2, 0.42);
      const rimLight = new THREE.DirectionalLight(0x7289da, 0.28);
      keyLight.position.set(8, 7, 6);
      rimLight.position.set(-6, -4, 5);
      scene.add(ambientLight, keyLight, rimLight);

      d20Geometry = new THREE.IcosahedronGeometry(2.7, 0);
      innerGeometry = new THREE.IcosahedronGeometry(2.56, 0);
      innerMaterial = new THREE.MeshBasicMaterial({
        color: 0x2f3136,
        transparent: true,
        opacity: 0.96
      });
      const innerMesh = new THREE.Mesh(innerGeometry, innerMaterial);

      d20Material = new THREE.MeshBasicMaterial({
        color: 0x36393f,
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
        color: 0x5865f2,
        linewidth: 2.8,
        transparent: true,
        opacity: 0.95
      });
      const d20Edges = new LineSegments2(lineGeometry, edgeMaterial);
      d20.add(d20Edges);

      lineGlowGeometry = new LineSegmentsGeometry();
      lineGlowGeometry.setPositions(edgeGeometry.attributes.position.array);
      edgeGlowMaterial = new LineMaterial({
        color: 0x5865f2,
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
        ctx.fillStyle = '#dcddde';
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
      console.warn('StartupPreloader: WebGL unavailable, using fallback animation.', error);
      setUseFallback(true);
    }

    return () => {
      window.__startupPreloaderActive = false;
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
    <div className={`startup-preloader ${isExiting ? 'is-exiting' : ''}`}>
      <div className="startup-preloader__noise" />
      <div className="startup-preloader__scanlines" />

      <div className="startup-preloader__panel">
        <div ref={viewportRef} className={`startup-preloader__viewport ${useFallback ? 'is-hidden' : ''}`} aria-hidden="true" />
        {useFallback && (
          <div className="startup-preloader__fallback-d20" aria-hidden="true">
            ◇
          </div>
        )}

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

