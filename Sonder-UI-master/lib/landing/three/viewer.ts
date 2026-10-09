import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import gsap from "gsap";
import { AnatomyAssetManager, ORGAN_HOME_ROTATION, type LoadedOrgan } from "./loaders";
import { NeuronActivity } from "./neuron-activity";
import {
  LIGHT_AMBIENT,
  LIGHT_HEMI,
  LIGHT_KEY,
  LIGHT_FILL,
  LIGHT_RIM,
  LIGHT_POINT_COOL,
  LIGHT_GLOW_INTENSITY,
  ENV_TOP,
  ENV_BOTTOM,
  PLINTH_COLOR,
  PLINTH_ROUGHNESS,
  PLINTH_METALNESS,
  SHOW_PLINTH,
  SHADOW_RGB,
  SHADOW_OPACITY,
  PARTICLE_COLOR,
  PARTICLE_SIZE,
  PARTICLE_OPACITY,
  TONE_MAPPING_EXPOSURE,
} from "./teal-theme";
import {
  ENTRY_ARRIVED,
  ENTRY_ROLL_Z,
  ENTRY_SCALE_START,
  ENTRY_SPIN_Y,
  ENTRY_TILT_X,
  ENTRY_Y_START,
  ENTRY_Z_START,
} from "../hero/hero-theme";

type ViewerCallbacks = {
  onLoading: (loading: boolean, progress: number) => void;
  /**
   * When true the organ is parked below the camera frustum on load and its pose
   * is owned entirely by setEntryProgress(). The GSAP intro in setOrgan() is
   * skipped, because it would fight setEntryProgress for pivot.scale and
   * pivot.position.z during its first ~0.9s.
   */
  entryAnimation?: boolean;
};

const CAMERA_FOV = 34;
const DEPTH_PREPASS = "depth-prepass";
const PLINTH_Y = -2.5;
const PLINTH_TOP = PLINTH_Y + 0.17;
/** Slightly above eye level, so the plinth reads as a disc the organ sits on
 *  rather than an edge-on band across the background. */
const HOME_CAMERA = { x: 0, y: 0.35, z: 13.5 };
const HOME_TARGET = { x: 0, y: 0.02, z: 0 };

/**
 * A self-contained three.js viewer: a classic `THREE.WebGLRenderer` with
 * `OrbitControls`, a small light rig + PMREM environment probe, a plinth and a
 * baked contact shadow, and GSAP camera/intro moves.
 *
 * Extracted from app/lib/three/viewer.ts. Isolate / cross-section / wireframe
 * tools are kept.
 */
export class AnatomyViewer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);
  private controls: OrbitControls;
  private assets: AnatomyAssetManager;
  private callbacks: ViewerCallbacks;
  private container: HTMLElement;
  private organ: LoadedOrgan | null = null;
  private plinth!: THREE.Mesh;
  private contactShadow!: THREE.Mesh;

  private frame = 0;
  private clock = new THREE.Clock();
  private resizeObserver: ResizeObserver;
  private intersectionObserver: IntersectionObserver;
  private clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  /** Writes depth only — used to resolve a fading organ to one surface. */
  private depthMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, depthTest: true });
  private crossSection = false;
  private isolated = false;

  private width = 1;
  private height = 1;
  private isVisible = true;
  private isPageVisible = true;

  // Render-on-demand bookkeeping: the loop only draws when something moved.
  private dirty = true;
  private busyUntil = 0;
  private loadRequest = 0;

  private basePixelRatio: number;

  private autoRotateWanted = true;
  private entryAnimation = false;
  private entryProgress = 0;
  /** Tracks the previous arrived state so we only snap the camera once per landing. */
  private entryWasArrived = false;
  private interactionUntil = 0;
  private fadeTween: gsap.core.Tween | null = null;
  private disposed = false;
  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();
  private neuronActivity = new NeuronActivity();
  private pointerTracking = false;
  private pointerStart = { x: 0, y: 0 };
  private pointerDragged = false;
  private hitPointScratch = new THREE.Vector3();

  constructor(container: HTMLElement, callbacks: ViewerCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.entryAnimation = callbacks.entryAnimation ?? false;
    // In entry mode the brain starts below frame and must not spin until it has
    // arrived; setEntryProgress() takes over this flag from here on.
    if (this.entryAnimation) this.autoRotateWanted = false;

    const lowPower = window.matchMedia("(max-width: 780px)").matches || (navigator.hardwareConcurrency ?? 8) < 6;
    // Fixed, decided once. A dynamic controller used to live here and it was a
    // net negative: frame *intervals* are vsync-quantised, so a brief hitch read
    // as GPU load, dropped the buffer, and — because a vsync-locked 16.7ms never
    // met the step-up threshold — never recovered. The scene renders in ~2ms, so
    // there is nothing to adapt away from.
    this.basePixelRatio = Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !lowPower,
      alpha: true,
      powerPreference: "high-performance",
      stencil: false,
      depth: true,
    });
    this.renderer.setPixelRatio(this.basePixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;
    // Shadow mapping would render every organ twice per frame; a baked contact
    // shadow gives the same read for free.
    this.renderer.shadowMap.enabled = false;
    this.renderer.localClippingEnabled = true;
    this.renderer.domElement.setAttribute("aria-label", "Interactive 3D anatomy model");
    this.renderer.domElement.tabIndex = 0;
    container.appendChild(this.renderer.domElement);

    this.camera.position.set(HOME_CAMERA.x, HOME_CAMERA.y, HOME_CAMERA.z);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.enablePan = false;
    this.controls.enableZoom = false;
    this.controls.minDistance = 4.8;
    this.controls.maxDistance = 16;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.65;
    this.controls.target.set(HOME_TARGET.x, HOME_TARGET.y, HOME_TARGET.z);

    this.assets = new AnatomyAssetManager(this.renderer);
    this.buildEnvironment();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        this.isVisible = entry.isIntersecting;
        if (this.isVisible) this.dirty = true;
      },
      { rootMargin: "120px" },
    );
    this.intersectionObserver.observe(container);

    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.controls.addEventListener("start", this.onControlStart);
    const canvas = this.renderer.domElement;
    // Capture phase so we gate rotate before OrbitControls sees the event.
    canvas.addEventListener("pointerdown", this.onPointerDownGate, true);
    canvas.addEventListener("pointermove", this.onPointerMoveGate);
    canvas.addEventListener("pointerup", this.onPointerUpGate);
    canvas.addEventListener("pointercancel", this.onPointerUpGate);
    canvas.addEventListener("keydown", this.onKeyDown);

    this.resize();
    this.animate();
  }

  // ---------------------------------------------------------------- scene

  private buildEnvironment() {
    this.scene.add(new THREE.AmbientLight(LIGHT_AMBIENT.color, LIGHT_AMBIENT.intensity));
    this.scene.add(
      new THREE.HemisphereLight(LIGHT_HEMI.sky, LIGHT_HEMI.ground, LIGHT_HEMI.intensity),
    );

    const key = new THREE.DirectionalLight(LIGHT_KEY.color, LIGHT_KEY.intensity);
    key.position.set(4.8, 6.5, 6.8);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(LIGHT_FILL.color, LIGHT_FILL.intensity);
    fill.position.set(-4.5, 1.2, 5.2);
    this.scene.add(fill);
    // A back rim is what separates a translucent object from its background —
    // it carries most of the read, so it is the strongest light in the rig.
    const rim = new THREE.DirectionalLight(LIGHT_RIM.color, LIGHT_RIM.intensity);
    rim.position.set(-4, 3.5, -5.5);
    this.scene.add(rim);
    const cool = new THREE.PointLight(LIGHT_POINT_COOL.color, LIGHT_POINT_COOL.intensity, 11, 2);
    cool.position.set(-3, -1.4, 3.5);
    this.scene.add(cool);
    const glow = new THREE.PointLight(0xffffff, LIGHT_GLOW_INTENSITY, 8, 2);
    glow.name = "organ-glow";
    glow.position.set(2.8, 0.4, 2.8);
    this.scene.add(glow);

    this.scene.environment = this.buildEnvironmentMap();

    this.plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 2.48, 0.34, 56),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(PLINTH_COLOR),
        roughness: PLINTH_ROUGHNESS,
        metalness: PLINTH_METALNESS,
      }),
    );
    this.plinth.position.y = PLINTH_Y;
    this.plinth.visible = SHOW_PLINTH;
    this.scene.add(this.plinth);

    this.contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 4.2),
      new THREE.MeshBasicMaterial({
        map: contactShadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: SHADOW_OPACITY,
        toneMapped: false,
      }),
    );
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = PLINTH_TOP + 0.005;
    this.contactShadow.renderOrder = 1;
    this.scene.add(this.contactShadow);

    const positions = new Float32Array(48 * 3);
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = (Math.random() - 0.5) * 9;
      positions[i + 1] = (Math.random() - 0.5) * 6;
      positions[i + 2] = (Math.random() - 0.5) * 5 - 2;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.scene.add(
      new THREE.Points(
        particleGeometry,
        new THREE.PointsMaterial({
          color: new THREE.Color(PARTICLE_COLOR),
          size: PARTICLE_SIZE,
          transparent: true,
          opacity: PARTICLE_OPACITY,
        }),
      ),
    );
  }

  /** A tiny cool gradient probe: better material response than a bare light rig,
   *  and it costs one PMREM bake instead of per-frame work. The transparent
   *  material leans on this heavily for its reflections. */
  private buildEnvironmentMap() {
    const width = 16;
    const height = 32;
    const data = new Uint8Array(width * height * 4);
    const top = new THREE.Color(ENV_TOP);
    const bottom = new THREE.Color(ENV_BOTTOM);
    const mixed = new THREE.Color();
    for (let y = 0; y < height; y += 1) {
      mixed.copy(bottom).lerp(top, Math.pow(1 - y / (height - 1), 0.7));
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        data[i] = mixed.r * 255;
        data[i + 1] = mixed.g * 255;
        data[i + 2] = mixed.b * 255;
        data[i + 3] = 255;
      }
    }
    const source = new THREE.DataTexture(data, width, height);
    source.mapping = THREE.EquirectangularReflectionMapping;
    source.colorSpace = THREE.SRGBColorSpace;
    source.needsUpdate = true;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const environment = pmrem.fromEquirectangular(source).texture;
    pmrem.dispose();
    source.dispose();
    return environment;
  }

  // ---------------------------------------------------------------- organs

  prefetch(url: string) {
    this.assets.prefetch(url);
  }

  async setOrgan(modelUrl: string, accent: string) {
    const request = ++this.loadRequest;
    this.callbacks.onLoading(true, 0);

    const outgoing = this.organ;
    if (outgoing) {
      // Switching mid-fade would otherwise leave the tween running and the
      // depth proxies attached to a released organ.
      this.fadeTween?.kill();
      this.fadeTween = null;
      this.setDepthPrepass(outgoing, false);
      this.neuronActivity.clear();
      this.busy(0.8);
      await gsap.to(outgoing.pivot.scale, {
        x: 0.72, y: 0.72, z: 0.72,
        duration: 0.34,
        ease: "power2.in",
        onUpdate: () => (this.dirty = true),
      });
      this.assets.release(outgoing);
      this.organ = null;
      this.dirty = true;
    }

    // The pull-back-then-settle camera move belongs to the old intro. In entry
    // mode the camera never moves — the brain travels instead.
    if (!this.entryAnimation) {
      this.tween(this.camera.position, { z: HOME_CAMERA.z + 1, duration: 0.42, ease: "power2.inOut" });
    }

    let organ: LoadedOrgan;
    try {
      organ = await this.assets.load(modelUrl, (progress) => {
        if (request === this.loadRequest) this.callbacks.onLoading(true, progress);
      });
    } catch (error) {
      if (request === this.loadRequest) this.callbacks.onLoading(false, 0);
      throw error;
    }
    if (request !== this.loadRequest || this.disposed) return;

    this.organ = organ;
    organ.pivot.scale.setScalar(1);
    organ.pivot.position.set(0, 0, 0);
    this.scene.add(organ.pivot);
    organ.pivot.updateWorldMatrix(true, true);
    this.neuronActivity.attach(organ.pivot, organ.meshes);

    if (this.crossSection) this.applyClipping(true);

    const glow = this.scene.getObjectByName("organ-glow") as THREE.PointLight | undefined;
    glow?.color.set(accent);

    if (this.entryAnimation) {
      // Fade the material in while the brain is still below frame, so it is fully
      // resolved by the time the scroll brings it up. No scale/position/camera
      // intro: applyEntry() owns the pose from here.
      this.busy(0.6);
      this.fade(organ, 1, 0.45);
      this.callbacks.onLoading(false, 1);
      this.applyEntry();
      return;
    }

    organ.pivot.scale.setScalar(0.58);
    organ.pivot.position.z = -1.3;
    this.busy(1.4);
    this.fade(organ, 1, 0.72);
    // The organ is on screen from here on, so the load is over as far as the UI
    // is concerned — the intro animation should play in the open, not behind a
    // loading panel.
    this.callbacks.onLoading(false, 1);
    gsap.timeline({ onUpdate: () => (this.dirty = true) })
      .to(organ.pivot.scale, { x: 1, y: 1, z: 1, duration: 0.9, ease: "back.out(1.25)" }, 0)
      .to(organ.pivot.position, { z: 0, duration: 0.85, ease: "power3.out" }, 0)
      .to(this.camera.position, { z: HOME_CAMERA.z, duration: 0.9, ease: "power2.out" }, 0.08);
  }

  private materials(organ: LoadedOrgan) {
    const list: THREE.Material[] = [];
    organ.meshes.forEach((mesh) => {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => list.includes(material) || list.push(material));
    });
    return list;
  }

  /**
   * Fades an organ in. The brain is permanently transparent, so there is no
   * depth prepass and no restore-to-opaque at the end: `opacity` ramps 0 → 1 and
   * then stays at 1, while the material's Fresnel term supplies the actual
   * see-through look. Depth writing stays off throughout so the far side and
   * interior remain visible.
   */
  private fade(organ: LoadedOrgan, to: number, duration: number) {
    const materials = this.materials(organ);
    const state = { value: to >= 1 ? 0 : 1 };
    materials.forEach((material) => {
      material.transparent = true;
      material.opacity = state.value;
      material.depthWrite = false;
    });
    this.busy(duration + 0.1);
    this.fadeTween = gsap.to(state, {
      value: to,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        materials.forEach((material) => (material.opacity = state.value));
        this.dirty = true;
      },
      onComplete: () => {
        if (to >= 1) {
          // Stays transparent for good — the Fresnel term in the material, not
          // `opacity`, is what controls how see-through the brain is.
          materials.forEach((material) => {
            material.transparent = true;
            material.opacity = 1;
            material.depthWrite = false;
          });
        }
        this.fadeTween = null;
        this.dirty = true;
      },
    });
  }

  /**
   * Lays down depth for the organ before it is shaded, so a partly transparent
   * mesh still resolves to a single nearest surface per pixel. The proxy is
   * parented to the mesh it mirrors, so it inherits the intro animation for
   * free. Opaque, therefore drawn before anything transparent. Alive only while
   * an organ fades; it costs one depth-only pass over ~120k triangles.
   */
  private setDepthPrepass(organ: LoadedOrgan, enabled: boolean) {
    organ.meshes.forEach((mesh) => {
      const existing = mesh.children.find((child) => child.name === DEPTH_PREPASS);
      if (!enabled) {
        existing?.removeFromParent();
        return;
      }
      if (existing) return;
      const proxy = new THREE.Mesh(mesh.geometry, this.depthMaterial);
      proxy.name = DEPTH_PREPASS;
      proxy.frustumCulled = mesh.frustumCulled;
      mesh.add(proxy);
    });
  }

  // ---------------------------------------------------------------- loop

  private animate = () => {
    this.frame = requestAnimationFrame(this.animate);
    if (!this.isVisible || !this.isPageVisible) return;

    const delta = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();

    this.applyAutoRotate(now);
    if (this.controls.update(delta)) this.dirty = true;
    if (this.assets.hasAnimation) {
      this.assets.update(delta);
      this.dirty = true;
    }
    if (this.neuronActivity.update(delta)) this.dirty = true;
    if (!this.dirty && now >= this.busyUntil) return;

    this.dirty = false;
    if (now < this.busyUntil) this.dirty = true;
    // Keep painting while bioelectric activity is running (even with auto-rotate off).
    if (this.neuronActivity.enabled) this.dirty = true;

    this.renderer.render(this.scene, this.camera);
  };

  private busy(seconds: number) {
    this.busyUntil = Math.max(this.busyUntil, performance.now() + seconds * 1000);
    this.dirty = true;
  }

  private tween(target: object, vars: gsap.TweenVars) {
    this.busy((vars.duration as number) ?? 0.5);
    return gsap.to(target, { ...vars, onUpdate: () => (this.dirty = true) });
  }

  private applyAutoRotate(now: number) {
    this.controls.autoRotate = this.autoRotateWanted && now >= this.interactionUntil;
  }

  private onVisibilityChange = () => {
    this.isPageVisible = !document.hidden;
    if (this.isPageVisible) {
      this.clock.start();
      this.dirty = true;
    }
  };

  private resize() {
    this.width = Math.max(this.container.clientWidth, 1);
    this.height = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height, false);
    this.dirty = true;
  }

  // ---------------------------------------------------------------- input

  private onControlStart = () => {
    this.interactionUntil = performance.now() + 3000;
    this.dirty = true;
  };

  /** Only allow orbit-drag when the press lands on the brain mesh. */
  private onPointerDownGate = (event: PointerEvent) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    this.controls.enableRotate = this.hitsOrgan(event);
    this.pointerTracking = true;
    this.pointerStart = { x: event.clientX, y: event.clientY };
    this.pointerDragged = false;
  };

  private onPointerMoveGate = (event: PointerEvent) => {
    if (!this.pointerTracking || this.pointerDragged) return;
    if (Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y) > 5) {
      this.pointerDragged = true;
    }
  };

  private onPointerUpGate = (event: PointerEvent) => {
    this.controls.enableRotate = true;
    const shouldBurst = this.pointerTracking && !this.pointerDragged;
    this.pointerTracking = false;
    if (!shouldBurst) return;
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const point = this.pickOrganPoint(event);
    if (point) {
      this.neuronActivity.burstAt(point);
      this.dirty = true;
    }
  };

  private hitsOrgan(event: PointerEvent): boolean {
    return this.pickOrganPoint(event) !== null;
  }

  /** Raycast the brain; returns the hit in organ-pivot local space. */
  private pickOrganPoint(event: PointerEvent): THREE.Vector3 | null {
    if (!this.organ) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const w = rect.width || 1;
    const h = rect.height || 1;
    this.pointerNdc.x = ((event.clientX - rect.left) / w) * 2 - 1;
    this.pointerNdc.y = -((event.clientY - rect.top) / h) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.organ.meshes, true);
    if (!hits.length) return null;
    return this.organ.pivot.worldToLocal(this.hitPointScratch.copy(hits[0].point));
  }

  private onKeyDown = (event: KeyboardEvent) => {
    const pivot = this.organ?.pivot;
    if (event.key === "ArrowLeft" && pivot) pivot.rotation.y -= 0.08;
    if (event.key === "ArrowRight" && pivot) pivot.rotation.y += 0.08;
    this.dirty = true;
  };

  // ---------------------------------------------------------------- tools

  setCanvasLabel(label: string) {
    this.renderer.domElement.setAttribute("aria-label", label);
  }

  /**
   * Drives the brain's scroll entry. `p` runs 0 (parked below the frustum, tilted,
   * spun back, pushed away) to 1 (exactly the canonical rest pose: origin,
   * ORGAN_HOME_ROTATION, scale 1).
   *
   * Safe to call before the model has loaded — the value is stored and applied by
   * setOrgan(). Safe to call at any rate; it is a handful of property writes.
   */
  setEntryProgress(p: number) {
    this.entryProgress = THREE.MathUtils.clamp(p, 0, 1);
    this.applyEntry();
  }

  /**
   * Writes the entry pose. Called from setEntryProgress and once from setOrgan.
   *
   * Note this drives pivot.rotation while OrbitControls' autoRotate drives the
   * CAMERA orbit — the two are orthogonal, which is why the handover at p = 1 is
   * seamless and needs no matching-up of angles.
   */
  private applyEntry() {
    const organ = this.organ;
    const p = this.entryProgress;
    const arrived = p >= ENTRY_ARRIVED;
    const justArrived = arrived && !this.entryWasArrived;
    this.entryWasArrived = arrived;

    // Entry mode never hands off to camera auto-rotate — the brain stays in its
    // frontal rest pose after landing.
    this.autoRotateWanted = false;

    if (organ) {
      const away = 1 - p;

      organ.pivot.position.set(0, ENTRY_Y_START * away, ENTRY_Z_START * away);
      organ.pivot.rotation.set(
        ORGAN_HOME_ROTATION.x + ENTRY_TILT_X * away,
        ORGAN_HOME_ROTATION.y + ENTRY_SPIN_Y * away,
        ORGAN_HOME_ROTATION.z + ENTRY_ROLL_Z * away,
      );
      organ.pivot.scale.setScalar(ENTRY_SCALE_START + (1 - ENTRY_SCALE_START) * p);

      // The contact shadow is a fixed plane at y = -2.33; without this it would sit
      // in empty space under nothing while the brain is still below frame.
      (this.contactShadow.material as THREE.MeshBasicMaterial).opacity = SHADOW_OPACITY * p;

      if (arrived) {
        organ.pivot.position.set(0, 0, 0);
        organ.pivot.rotation.set(
          ORGAN_HOME_ROTATION.x,
          ORGAN_HOME_ROTATION.y,
          ORGAN_HOME_ROTATION.z,
        );
        organ.pivot.scale.setScalar(1);
        (this.contactShadow.material as THREE.MeshBasicMaterial).opacity = SHADOW_OPACITY;
      }
    }

    // Re-seat the camera on each landing so scrub lag / prior orbit cannot leave
    // a side view as the "rest" shot.
    if (justArrived) {
      this.camera.position.set(HOME_CAMERA.x, HOME_CAMERA.y, HOME_CAMERA.z);
      this.controls.target.set(HOME_TARGET.x, HOME_TARGET.y, HOME_TARGET.z);
      this.controls.update();
    }

    this.dirty = true;
  }

  setAutoRotate(enabled: boolean) {
    this.autoRotateWanted = enabled;
    if (enabled) this.interactionUntil = 0;
    this.dirty = true;
  }

  reset() {
    // In entry mode the pivot's pose belongs to setEntryProgress(); resetting it
    // here would fight the scrub and leave the brain in a pose the scroll position
    // does not agree with. Camera and target are still fair game.
    if (this.entryAnimation) {
      this.tween(this.camera.position, { ...HOME_CAMERA, duration: 0.8, ease: "power3.out" });
      this.tween(this.controls.target, { ...HOME_TARGET, duration: 0.8, ease: "power3.out" });
      return;
    }
    this.tween(this.camera.position, { ...HOME_CAMERA, duration: 0.8, ease: "power3.out" });
    this.tween(this.controls.target, { ...HOME_TARGET, duration: 0.8, ease: "power3.out" });
    if (this.organ) this.tween(this.organ.pivot.rotation, { ...ORGAN_HOME_ROTATION, duration: 0.8, ease: "power3.out" });
  }

  zoom(_direction: 1 | -1) {
    void _direction;
    // Zoom is disabled — brain stays at a fixed camera distance.
  }

  toggleIsolate() {
    this.isolated = !this.isolated;
    const plinth = this.plinth.material as THREE.MeshStandardMaterial;
    plinth.transparent = true;
    this.tween(plinth, { opacity: this.isolated ? 0.15 : 1, duration: 0.45 });
    this.tween(this.contactShadow.material, {
      opacity: this.isolated ? 0.04 : SHADOW_OPACITY,
      duration: 0.45,
    });
    return this.isolated;
  }

  toggleCrossSection() {
    this.crossSection = !this.crossSection;
    this.applyClipping(this.crossSection);
    gsap.fromTo(
      this.clipPlane,
      { constant: -1.8 },
      {
        constant: this.crossSection ? 0 : -1.8,
        duration: 0.85,
        ease: "power2.inOut",
        onUpdate: () => (this.dirty = true),
      },
    );
    this.busy(0.95);
    return this.crossSection;
  }

  private applyClipping(enabled: boolean) {
    if (!this.organ) return;
    const planes = enabled ? [this.clipPlane] : null;
    [...this.materials(this.organ), this.depthMaterial].forEach((material) => {
      material.clippingPlanes = planes;
      material.needsUpdate = true;
    });
    this.dirty = true;
  }

  toggleLayers() {
    if (!this.organ) return false;
    let enabled = false;
    this.materials(this.organ).forEach((material) => {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.wireframe = !material.wireframe;
        enabled = material.wireframe;
      }
    });
    this.dirty = true;
    return enabled;
  }

  dispose() {
    this.disposed = true;
    this.loadRequest += 1;
    cancelAnimationFrame(this.frame);
    gsap.killTweensOf(this.camera.position);
    this.controls.removeEventListener("start", this.onControlStart);
    this.controls.dispose();
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibilityChange);

    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDownGate, true);
    canvas.removeEventListener("pointermove", this.onPointerMoveGate);
    canvas.removeEventListener("pointerup", this.onPointerUpGate);
    canvas.removeEventListener("pointercancel", this.onPointerUpGate);
    canvas.removeEventListener("keydown", this.onKeyDown);

    this.neuronActivity.dispose();
    this.depthMaterial.dispose();
    this.assets.dispose();
    this.scene.environment?.dispose();
    (this.contactShadow.material as THREE.MeshBasicMaterial).map?.dispose();
    this.renderer.dispose();
    canvas.remove();
  }
}

function contactShadowTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.04, size / 2, size / 2, size * 0.5);
  gradient.addColorStop(0, `rgba(${SHADOW_RGB}, 0.62)`);
  gradient.addColorStop(0.45, `rgba(${SHADOW_RGB}, 0.26)`);
  gradient.addColorStop(1, `rgba(${SHADOW_RGB}, 0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
