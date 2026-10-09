import * as THREE from "three";
import { NEURON_PATHS } from "../anatomy/neuron-paths";
import {
  SHOW_NEURON_ACTIVITY,
  NEURON_PATH_COLOR,
  NEURON_PATH_OPACITY,
  NEURON_PULSE_COLOR,
  NEURON_PULSE_SIZE,
  NEURON_PULSE_SPEED,
  NEURON_PULSE_SPEED_CLICK,
  NEURON_MAX_PULSES,
  NEURON_FLASH_COLOR,
  NEURON_FLASH_SIZE,
  NEURON_FLASH_SIZE_CLICK,
  NEURON_FLASH_PEAK,
  NEURON_FLASH_PEAK_CLICK,
  NEURON_FLASH_DURATION,
  NEURON_FLASH_DURATION_CLICK,
  NEURON_MAX_FLASHES,
  NEURON_PULSE_INTERVAL,
  NEURON_FLASH_INTERVAL,
  NEURON_CLICK_PULSE_COUNT,
} from "./teal-theme";

type Pulse = {
  sprite: THREE.Sprite;
  pathIndex: number;
  t: number;
  speed: number;
  active: boolean;
};

type Flash = {
  sprite: THREE.Sprite;
  age: number;
  duration: number;
  peak: number;
  baseSize: number;
  active: boolean;
};

type PathRuntime = {
  curve: THREE.CatmullRomCurve3;
  length: number;
  start: THREE.Vector3;
  end: THREE.Vector3;
};

function softGlowTexture(hex: string) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const c = size / 2;
  const color = new THREE.Color(hex);
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);

  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
  gradient.addColorStop(0.25, `rgba(${r}, ${g}, ${b}, 0.65)`);
  gradient.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, 0.18)`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function randRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/**
 * Dim pathway filaments, traveling charge pulses, and cortex surface flashes.
 * Parent group is attached to the organ pivot so everything rotates with the brain.
 */
export class NeuronActivity {
  private group = new THREE.Group();
  private meshes: THREE.Mesh[] = [];
  private paths: PathRuntime[] = [];
  private pulses: Pulse[] = [];
  private flashes: Flash[] = [];
  private pulseTexture: THREE.Texture;
  private flashTexture: THREE.Texture;
  private pulseMat: THREE.SpriteMaterial;
  private flashMat: THREE.SpriteMaterial;
  private pathMat: THREE.LineBasicMaterial;
  private attached = false;
  private pulseCooldown = 0;
  private flashCooldown = 0;
  private scratch = new THREE.Vector3();

  constructor() {
    this.group.name = "neuron-activity";
    this.pulseTexture = softGlowTexture(NEURON_PULSE_COLOR);
    this.flashTexture = softGlowTexture(NEURON_FLASH_COLOR);
    this.pulseMat = new THREE.SpriteMaterial({
      map: this.pulseTexture,
      color: new THREE.Color(NEURON_PULSE_COLOR),
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.flashMat = new THREE.SpriteMaterial({
      map: this.flashTexture,
      color: new THREE.Color(NEURON_FLASH_COLOR),
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      opacity: 0,
    });
    this.pathMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(NEURON_PATH_COLOR),
      transparent: true,
      opacity: NEURON_PATH_OPACITY,
      depthWrite: false,
      toneMapped: false,
    });

    for (let i = 0; i < NEURON_MAX_PULSES; i += 1) {
      const sprite = new THREE.Sprite(this.pulseMat.clone());
      sprite.visible = false;
      sprite.scale.setScalar(NEURON_PULSE_SIZE);
      sprite.renderOrder = 3;
      this.group.add(sprite);
      this.pulses.push({ sprite, pathIndex: 0, t: 0, speed: NEURON_PULSE_SPEED, active: false });
    }
    for (let i = 0; i < NEURON_MAX_FLASHES; i += 1) {
      const sprite = new THREE.Sprite(this.flashMat.clone());
      sprite.visible = false;
      sprite.scale.setScalar(NEURON_FLASH_SIZE);
      sprite.renderOrder = 4;
      this.group.add(sprite);
      this.flashes.push({
        sprite,
        age: 0,
        duration: NEURON_FLASH_DURATION,
        peak: NEURON_FLASH_PEAK,
        baseSize: NEURON_FLASH_SIZE,
        active: false,
      });
    }
  }

  get enabled() {
    return SHOW_NEURON_ACTIVITY && this.attached;
  }

  attach(pivot: THREE.Group, meshes: THREE.Mesh[]) {
    this.clear();
    if (!SHOW_NEURON_ACTIVITY) return;

    this.meshes = meshes;
    this.paths = NEURON_PATHS.map((points) => {
      const curve = new THREE.CatmullRomCurve3(
        points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
        false,
        "catmullrom",
        0.35,
      );
      const length = curve.getLength();
      const samples = curve.getPoints(48);
      const geometry = new THREE.BufferGeometry().setFromPoints(samples);
      const line = new THREE.Line(geometry, this.pathMat);
      line.frustumCulled = false;
      line.renderOrder = 2;
      this.group.add(line);
      return {
        curve,
        length,
        start: curve.getPoint(0),
        end: curve.getPoint(1),
      };
    });

    pivot.add(this.group);
    this.attached = true;
    this.pulseCooldown = randRange(...NEURON_PULSE_INTERVAL);
    this.flashCooldown = randRange(...NEURON_FLASH_INTERVAL);
  }

  clear() {
    while (this.group.children.length) {
      const child = this.group.children[0];
      this.group.remove(child);
      if (child instanceof THREE.Line) {
        child.geometry.dispose();
      }
    }
    // Re-add pooled sprites (lines were disposed; sprites reused).
    this.pulses.forEach((pulse) => {
      pulse.active = false;
      pulse.sprite.visible = false;
      this.group.add(pulse.sprite);
    });
    this.flashes.forEach((flash) => {
      flash.active = false;
      flash.sprite.visible = false;
      (flash.sprite.material as THREE.SpriteMaterial).opacity = 0;
      this.group.add(flash.sprite);
    });
    this.group.removeFromParent();
    this.paths = [];
    this.meshes = [];
    this.attached = false;
  }

  /**
   * Advances ambient spawners, pulses, and flashes.
   * @returns true when the viewer should keep rendering.
   */
  update(delta: number): boolean {
    if (!this.enabled) return false;

    this.pulseCooldown -= delta;
    if (this.pulseCooldown <= 0) {
      this.spawnPulse(Math.floor(Math.random() * this.paths.length), 0, NEURON_PULSE_SPEED, false);
      this.pulseCooldown = randRange(...NEURON_PULSE_INTERVAL);
    }

    this.flashCooldown -= delta;
    if (this.flashCooldown <= 0) {
      const point = this.randomSurfacePoint();
      if (point) this.spawnFlash(point, false);
      this.flashCooldown = randRange(...NEURON_FLASH_INTERVAL);
    }

    for (const pulse of this.pulses) {
      if (!pulse.active) continue;
      const path = this.paths[pulse.pathIndex];
      if (!path) {
        pulse.active = false;
        pulse.sprite.visible = false;
        continue;
      }
      const scale = Math.max(path.length, 0.5);
      pulse.t += (Math.abs(pulse.speed) * delta) / scale;
      if (pulse.t >= 1) {
        pulse.active = false;
        pulse.sprite.visible = false;
        continue;
      }
      const sampleT = pulse.speed >= 0 ? pulse.t : 1 - pulse.t;
      path.curve.getPoint(sampleT, this.scratch);
      pulse.sprite.position.copy(this.scratch);
    }

    for (const flash of this.flashes) {
      if (!flash.active) continue;
      flash.age += delta;
      const u = flash.age / flash.duration;
      if (u >= 1) {
        flash.active = false;
        flash.sprite.visible = false;
        (flash.sprite.material as THREE.SpriteMaterial).opacity = 0;
        continue;
      }
      const envelope = u < 0.25 ? u / 0.25 : 1 - (u - 0.25) / 0.75;
      const mat = flash.sprite.material as THREE.SpriteMaterial;
      mat.opacity = flash.peak * Math.max(0, envelope);
      const size = flash.baseSize * (1 + u * 0.85);
      flash.sprite.scale.setScalar(size);
    }

    return true;
  }

  /** Stronger local flash + fan of pulses from pathways nearest to `point` (pivot space). */
  burstAt(point: THREE.Vector3) {
    if (!this.enabled || !this.paths.length) return;

    this.spawnFlash(point, true);

    const ranked = this.paths
      .map((path, index) => {
        const dStart = path.start.distanceToSquared(point);
        const dEnd = path.end.distanceToSquared(point);
        const fromStart = dStart <= dEnd;
        return { index, dist: Math.min(dStart, dEnd), fromStart };
      })
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 3);

    let spawned = 0;
    for (const entry of ranked) {
      if (spawned >= NEURON_CLICK_PULSE_COUNT) break;
      this.spawnPulse(
        entry.index,
        entry.fromStart ? 0 : 1,
        NEURON_PULSE_SPEED_CLICK,
        true,
        entry.fromStart ? 1 : -1,
      );
      spawned += 1;
      if (spawned >= NEURON_CLICK_PULSE_COUNT) break;
      this.spawnPulse(
        entry.index,
        entry.fromStart ? 0.08 : 0.92,
        NEURON_PULSE_SPEED_CLICK * 0.9,
        true,
        entry.fromStart ? 1 : -1,
      );
      spawned += 1;
    }
  }

  dispose() {
    this.clear();
    this.pulses.forEach((pulse) => {
      (pulse.sprite.material as THREE.SpriteMaterial).dispose();
    });
    this.flashes.forEach((flash) => {
      (flash.sprite.material as THREE.SpriteMaterial).dispose();
    });
    this.pulseMat.dispose();
    this.flashMat.dispose();
    this.pathMat.dispose();
    this.pulseTexture.dispose();
    this.flashTexture.dispose();
  }

  private spawnPulse(
    pathIndex: number,
    t: number,
    speed: number,
    fromClick: boolean,
    direction = 1,
  ) {
    if (!this.paths[pathIndex]) return;
    const pulse = this.pulses.find((item) => !item.active);
    if (!pulse) return;

    // When starting from the end with negative direction, t=1 means begin at end
    // and sampleT = 1 - progress moves toward the start.
    const startT = direction >= 0 ? THREE.MathUtils.clamp(t, 0, 0.99) : THREE.MathUtils.clamp(t, 0.01, 1);
    pulse.pathIndex = pathIndex;
    pulse.t = direction >= 0 ? startT : 1 - startT;
    pulse.speed = Math.abs(speed) * (direction >= 0 ? 1 : -1);
    pulse.active = true;
    pulse.sprite.visible = true;
    const size = fromClick ? NEURON_PULSE_SIZE * 1.35 : NEURON_PULSE_SIZE;
    pulse.sprite.scale.setScalar(size);
    const mat = pulse.sprite.material as THREE.SpriteMaterial;
    mat.opacity = fromClick ? 1 : 0.85;

    const sampleT = pulse.speed >= 0 ? pulse.t : 1 - pulse.t;
    this.paths[pathIndex].curve.getPoint(sampleT, this.scratch);
    pulse.sprite.position.copy(this.scratch);
  }

  private spawnFlash(point: THREE.Vector3, fromClick: boolean) {
    const flash = this.flashes.find((item) => !item.active);
    if (!flash) return;
    flash.active = true;
    flash.age = 0;
    flash.duration = fromClick ? NEURON_FLASH_DURATION_CLICK : NEURON_FLASH_DURATION;
    flash.peak = fromClick ? NEURON_FLASH_PEAK_CLICK : NEURON_FLASH_PEAK;
    flash.baseSize = fromClick ? NEURON_FLASH_SIZE_CLICK : NEURON_FLASH_SIZE;
    flash.sprite.visible = true;
    flash.sprite.position.copy(point);
    flash.sprite.scale.setScalar(flash.baseSize);
    (flash.sprite.material as THREE.SpriteMaterial).opacity = flash.peak * 0.35;
  }

  private randomSurfacePoint(): THREE.Vector3 | null {
    if (!this.meshes.length) return null;
    const mesh = this.meshes[Math.floor(Math.random() * this.meshes.length)];
    const geometry = mesh.geometry;
    const position = geometry.getAttribute("position");
    if (!position || position.count < 3) return null;

    const index = geometry.getIndex();
    let i0: number;
    let i1: number;
    let i2: number;
    if (index) {
      const faceCount = index.count / 3;
      if (faceCount < 1) return null;
      const face = Math.floor(Math.random() * faceCount) * 3;
      i0 = index.getX(face);
      i1 = index.getX(face + 1);
      i2 = index.getX(face + 2);
    } else {
      const faceCount = Math.floor(position.count / 3);
      if (faceCount < 1) return null;
      const face = Math.floor(Math.random() * faceCount) * 3;
      i0 = face;
      i1 = face + 1;
      i2 = face + 2;
    }

    const a = new THREE.Vector3(position.getX(i0), position.getY(i0), position.getZ(i0));
    const b = new THREE.Vector3(position.getX(i1), position.getY(i1), position.getZ(i1));
    const c = new THREE.Vector3(position.getX(i2), position.getY(i2), position.getZ(i2));

    mesh.updateWorldMatrix(true, false);
    const localA = mesh.localToWorld(a);
    const localB = mesh.localToWorld(b);
    const localC = mesh.localToWorld(c);
    const pivot = this.group.parent;
    if (pivot) {
      pivot.worldToLocal(localA);
      pivot.worldToLocal(localB);
      pivot.worldToLocal(localC);
    }

    let u = Math.random();
    let v = Math.random();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const w = 1 - u - v;
    return localA.multiplyScalar(u).add(localB.multiplyScalar(v)).add(localC.multiplyScalar(w));
  }
}
