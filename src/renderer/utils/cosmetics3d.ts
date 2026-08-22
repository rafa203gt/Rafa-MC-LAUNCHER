import * as THREE from 'three';
import { SkinViewer } from 'skinview3d';
import { ShopCosmetic } from '../types';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  opacity: number;
}

export class Cosmetics3DRenderer {
  private viewer: SkinViewer;
  private attachedObjects: THREE.Object3D[] = [];
  private animationFrameId: number | null = null;
  private wingLeft: THREE.Object3D | null = null;
  private wingRight: THREE.Object3D | null = null;
  private wingLeftTip: THREE.Object3D | null = null;
  private wingRightTip: THREE.Object3D | null = null;
  private haloMesh: THREE.Object3D | null = null;

  // Sistema de Partículas de Humo Negro / Sombras del Vacío
  private particleGroup: THREE.Group | null = null;
  private particlePoints: THREE.Points | null = null;
  private particleData: Particle[] = [];
  private particleGeo: THREE.BufferGeometry | null = null;
  private particlePositions: Float32Array | null = null;

  constructor(viewer: SkinViewer) {
    this.viewer = viewer;
    this.startAnimationLoop();
  }

  private startAnimationLoop() {
    let time = 0;
    const animate = () => {
      time += 0.04;

      // Animar aleteo de doble articulación hiperrealista
      if (this.wingLeft && this.wingRight) {
        // Articulación principal (Hombro)
        const shoulderFlap = Math.sin(time * 3) * 0.35 + 0.15;
        this.wingLeft.rotation.y = shoulderFlap;
        this.wingRight.rotation.y = -shoulderFlap;

        // Articulación secundaria (Codo / Puntas con desfasaje armónico)
        if (this.wingLeftTip && this.wingRightTip) {
          const elbowFlap = Math.sin(time * 3 + 0.6) * 0.25;
          this.wingLeftTip.rotation.y = elbowFlap;
          this.wingRightTip.rotation.y = -elbowFlap;
        }
      }

      // Animar rotación suave del Halo 3D
      if (this.haloMesh) {
        this.haloMesh.rotation.y += 0.02;
        this.haloMesh.position.y = 8.5 + Math.sin(time * 2) * 0.3;
      }

      // Actualizar partículas de sombras y humo negro
      this.updateParticles(time);

      this.animationFrameId = requestAnimationFrame(animate);
    };

    animate();
  }

  private updateParticles(time: number) {
    if (!this.particlePoints || !this.particleGeo || !this.particlePositions) return;

    for (let i = 0; i < this.particleData.length; i++) {
      const p = this.particleData[i];
      p.life += 0.03;

      if (p.life >= p.maxLife) {
        // Renacer en la punta de una de las dos alas
        p.life = 0;
        const isLeft = Math.random() > 0.5;
        const tipObj = isLeft ? this.wingLeftTip || this.wingLeft : this.wingRightTip || this.wingRight;

        if (tipObj) {
          const worldPos = new THREE.Vector3();
          tipObj.getWorldPosition(worldPos);
          p.position.copy(worldPos);
          p.position.x += (Math.random() - 0.5) * 1.5;
          p.position.y += (Math.random() - 0.5) * 1.5;
          p.position.z += (Math.random() - 0.5) * 1.0;
        }

        p.velocity.set(
          (Math.random() - 0.5) * 0.08,
          0.05 + Math.random() * 0.09, // Ascenso suave
          (Math.random() - 0.5) * 0.08
        );
      } else {
        // Movimiento etéreo flotante
        p.position.x += p.velocity.x + Math.sin(time * 2 + i) * 0.02;
        p.position.y += p.velocity.y;
        p.position.z += p.velocity.z + Math.cos(time * 2 + i) * 0.02;
      }

      this.particlePositions[i * 3] = p.position.x;
      this.particlePositions[i * 3 + 1] = p.position.y;
      this.particlePositions[i * 3 + 2] = p.position.z;
    }

    this.particleGeo.attributes.position.needsUpdate = true;
  }

  public clearAllCosmetics() {
    for (const obj of this.attachedObjects) {
      if (obj.parent) {
        obj.parent.remove(obj);
      }
    }
    this.attachedObjects = [];
    this.wingLeft = null;
    this.wingRight = null;
    this.wingLeftTip = null;
    this.wingRightTip = null;
    this.haloMesh = null;
    this.particleGroup = null;
    this.particlePoints = null;
    this.particleData = [];
    this.particleGeo = null;
    this.particlePositions = null;
    this.viewer.resetCape();
  }

  public updateCosmetics(
    activeCape: ShopCosmetic | null,
    activeWings: ShopCosmetic | null,
    activeHat: ShopCosmetic | null,
    activeBandana: ShopCosmetic | null
  ) {
    this.clearAllCosmetics();

    const player = this.viewer.playerObject;
    if (!player || !player.skin) return;

    const head = player.skin.head;
    const body = player.skin.body;

    // 1. Renderizar Capa
    if (activeCape && activeCape.texture_url) {
      this.viewer.loadCape(activeCape.texture_url);
    }

    // 2. Renderizar Alas 3D con doble articulación y partículas
    if (activeWings && body) {
      this.attachWings(body, activeWings);
    }

    // 3. Renderizar Sombreros / Coronas / Halos 3D
    if (activeHat && head) {
      this.attachHat(head, activeHat);
    }

    // 4. Renderizar Bandanas / Máscaras / Visores 3D
    if (activeBandana && head) {
      this.attachBandana(head, activeBandana);
    }
  }

  private initParticleEmitter(parent: THREE.Object3D, count: number = 35) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    this.particleData = [];
    for (let i = 0; i < count; i++) {
      const p: Particle = {
        position: new THREE.Vector3(0, 0, 0),
        velocity: new THREE.Vector3(0, 0.05, 0),
        life: Math.random(),
        maxLife: 1.0 + Math.random() * 0.8,
        size: 2.5 + Math.random() * 2.0,
        opacity: 0.8
      };
      this.particleData.push(p);

      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particleGeo = geo;
    this.particlePositions = positions;

    const mat = new THREE.PointsMaterial({
      color: 0x6b21a8, // Púrpura oscuro abisal / sombras
      size: 2.2,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geo, mat);
    this.particlePoints = points;
    parent.add(points);
  }

  private attachWings(body: THREE.Object3D, cosmetic: ShopCosmetic) {
    const wingsGroup = new THREE.Group();
    wingsGroup.position.set(0, 4, 2.2); // Espalda del torso

    const isFallenAngel =
      cosmetic.id === 'wings-fallen-angel-void' ||
      cosmetic.model_type === 'wings_fallen_angel_3d' ||
      cosmetic.id.includes('angel') ||
      cosmetic.id.includes('void');

    const isDragon = cosmetic.model_type === 'dragon' || cosmetic.id.includes('dragon');
    const isMecha = cosmetic.model_type === 'mecha';

    // Colores base y acento
    const wingColor = isFallenAngel ? 0x110e1c : isMecha ? 0x00ffff : isDragon ? 0x7e22ce : 0xef4444;
    const featherColor = isFallenAngel ? 0x221a38 : isDragon ? 0x581c87 : 0x334155;
    const spineColor = isFallenAngel ? 0x050508 : isDragon ? 0x2e1065 : 0x1e293b;

    // === ALA IZQUIERDA (Doble Articulación: Hombro + Codo) ===
    const leftShoulder = new THREE.Group();
    leftShoulder.position.set(1.5, 0, 0);

    // Hueso / Espina superior
    const spineGeo = new THREE.BoxGeometry(0.7, 7, 0.7);
    const spineMat = new THREE.MeshBasicMaterial({ color: spineColor });
    const spineMesh = new THREE.Mesh(spineGeo, spineMat);
    spineMesh.position.set(2.5, 2.5, 0);
    spineMesh.rotation.z = -Math.PI / 4;
    leftShoulder.add(spineMesh);

    // Plumas base interiores
    const baseFeatherGeo = new THREE.BoxGeometry(4.5, 6, 0.25);
    const baseFeatherMat = new THREE.MeshBasicMaterial({
      color: wingColor,
      transparent: true,
      opacity: 0.95
    });
    const baseFeather = new THREE.Mesh(baseFeatherGeo, baseFeatherMat);
    baseFeather.position.set(2.8, 1.5, 0);
    baseFeather.rotation.z = -Math.PI / 6;
    leftShoulder.add(baseFeather);

    // Articulación del codo / Plumas exteriores largas
    const leftElbow = new THREE.Group();
    leftElbow.position.set(4.5, 4.5, 0);

    // Pluma larga superior
    const outerFeatherGeo1 = new THREE.BoxGeometry(5.5, 7, 0.2);
    const outerFeatherMat = new THREE.MeshBasicMaterial({
      color: featherColor,
      transparent: true,
      opacity: 0.9
    });
    const outerFeather1 = new THREE.Mesh(outerFeatherGeo1, outerFeatherMat);
    outerFeather1.position.set(2.8, 0, 0);
    outerFeather1.rotation.z = -0.3;
    leftElbow.add(outerFeather1);

    // Pluma rasgada inferior
    const outerFeatherGeo2 = new THREE.BoxGeometry(4, 5.5, 0.15);
    const outerFeather2 = new THREE.Mesh(outerFeatherGeo2, baseFeatherMat);
    outerFeather2.position.set(2.2, -3.2, 0);
    outerFeather2.rotation.z = -0.15;
    leftElbow.add(outerFeather2);

    leftShoulder.add(leftElbow);

    // === ALA DERECHA (Simétrica) ===
    const rightShoulder = new THREE.Group();
    rightShoulder.position.set(-1.5, 0, 0);

    const spineMeshR = spineMesh.clone();
    spineMeshR.position.set(-2.5, 2.5, 0);
    spineMeshR.rotation.z = Math.PI / 4;
    rightShoulder.add(spineMeshR);

    const baseFeatherR = baseFeather.clone();
    baseFeatherR.position.set(-2.8, 1.5, 0);
    baseFeatherR.rotation.z = Math.PI / 6;
    rightShoulder.add(baseFeatherR);

    const rightElbow = new THREE.Group();
    rightElbow.position.set(-4.5, 4.5, 0);

    const outerFeather1R = outerFeather1.clone();
    outerFeather1R.position.set(-2.8, 0, 0);
    outerFeather1R.rotation.z = 0.3;
    rightElbow.add(outerFeather1R);

    const outerFeather2R = outerFeather2.clone();
    outerFeather2R.position.set(-2.2, -3.2, 0);
    outerFeather2R.rotation.z = 0.15;
    rightElbow.add(outerFeather2R);

    rightShoulder.add(rightElbow);

    wingsGroup.add(leftShoulder);
    wingsGroup.add(rightShoulder);

    // Inicializar emisor de partículas si son alas legendarias de ángel caído
    if (isFallenAngel) {
      this.initParticleEmitter(wingsGroup, 40);
    }

    body.add(wingsGroup);
    this.attachedObjects.push(wingsGroup);
    this.wingLeft = leftShoulder;
    this.wingRight = rightShoulder;
    this.wingLeftTip = leftElbow;
    this.wingRightTip = rightElbow;
  }

  private attachHat(head: THREE.Object3D, cosmetic: ShopCosmetic) {
    const hatGroup = new THREE.Group();

    if (cosmetic.model_type === 'halo' || cosmetic.id.includes('halo')) {
      // Halo Sagrado Flotante
      const torusGeo = new THREE.TorusGeometry(3.5, 0.4, 8, 24);
      const torusMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      const torusMesh = new THREE.Mesh(torusGeo, torusMat);
      torusMesh.rotation.x = Math.PI / 2;
      torusMesh.position.set(0, 8.5, 0);
      hatGroup.add(torusMesh);
      this.haloMesh = torusMesh;
    } else if (cosmetic.model_type === 'catears' || cosmetic.id.includes('cat')) {
      // Orejas de Gato Neko 3D
      const earGeo = new THREE.ConeGeometry(1.4, 2.5, 4);
      const isBlack = cosmetic.id.includes('black');
      const earMat = new THREE.MeshBasicMaterial({ color: isBlack ? 0x111111 : 0xf472b6 });

      const earL = new THREE.Mesh(earGeo, earMat);
      earL.position.set(2.8, 5, 0);
      earL.rotation.z = -0.2;

      const earR = new THREE.Mesh(earGeo, earMat);
      earR.position.set(-2.8, 5, 0);
      earR.rotation.z = 0.2;

      hatGroup.add(earL);
      hatGroup.add(earR);
    } else if (cosmetic.model_type === 'horns' || cosmetic.id.includes('horn')) {
      // Cuernos de Demonio Carmesí 3D
      const hornGeo = new THREE.ConeGeometry(1.2, 3.5, 4);
      const hornMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });

      const hornL = new THREE.Mesh(hornGeo, hornMat);
      hornL.position.set(2.2, 5.2, 2);
      hornL.rotation.x = -0.4;
      hornL.rotation.z = -0.3;

      const hornR = new THREE.Mesh(hornGeo, hornMat);
      hornR.position.set(-2.2, 5.2, 2);
      hornR.rotation.x = -0.4;
      hornR.rotation.z = 0.3;

      hatGroup.add(hornL);
      hatGroup.add(hornR);
    } else {
      // Corona Imperial de Oro / Obsidiana
      const isObsidian = cosmetic.id.includes('rafa') || cosmetic.id.includes('obsidian');
      const crownBaseGeo = new THREE.CylinderGeometry(4.3, 4.3, 1.2, 8, 1, true);
      const crownMat = new THREE.MeshBasicMaterial({
        color: isObsidian ? 0x1e1b4b : 0xf59e0b,
        side: THREE.DoubleSide
      });
      const baseMesh = new THREE.Mesh(crownBaseGeo, crownMat);
      baseMesh.position.set(0, 4.6, 0);
      hatGroup.add(baseMesh);

      // Puntas de la corona
      for (let i = 0; i < 4; i++) {
        const spikeGeo = new THREE.ConeGeometry(0.8, 1.6, 4);
        const gemColor = isObsidian ? 0x10b981 : 0xef4444;
        const spikeMat = new THREE.MeshBasicMaterial({ color: gemColor });
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        const angle = (i * Math.PI) / 2;
        spike.position.set(Math.cos(angle) * 4.2, 5.8, Math.sin(angle) * 4.2);
        hatGroup.add(spike);
      }
    }

    head.add(hatGroup);
    this.attachedObjects.push(hatGroup);
  }

  private attachBandana(head: THREE.Object3D, cosmetic: ShopCosmetic) {
    const bandanaGroup = new THREE.Group();

    if (cosmetic.model_type === 'visor' || cosmetic.id.includes('visor')) {
      // Visor Cyber HUD
      const visorGeo = new THREE.BoxGeometry(7.5, 1.8, 0.4);
      const visorMat = new THREE.MeshBasicMaterial({
        color: 0x06b6d4,
        transparent: true,
        opacity: 0.8
      });
      const visorMesh = new THREE.Mesh(visorGeo, visorMat);
      visorMesh.position.set(0, 0.5, 4.2);
      bandanaGroup.add(visorMesh);
    } else if (cosmetic.model_type === 'glasses' || cosmetic.id.includes('glasses')) {
      // Gafas Thug Life Pixel
      const glassGeo = new THREE.BoxGeometry(7.2, 1.4, 0.3);
      const glassMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
      const glassMesh = new THREE.Mesh(glassGeo, glassMat);
      glassMesh.position.set(0, 0.5, 4.2);
      bandanaGroup.add(glassMesh);
    } else {
      // Bandana Ninja / Máscara Facial
      const isRed = cosmetic.id.includes('oni');
      const maskGeo = new THREE.BoxGeometry(8.3, 3.2, 8.3);
      const maskMat = new THREE.MeshBasicMaterial({
        color: isRed ? 0x991b1b : 0x18181b
      });
      const maskMesh = new THREE.Mesh(maskGeo, maskMat);
      maskMesh.position.set(0, -2.4, 0);
      bandanaGroup.add(maskMesh);
    }

    head.add(bandanaGroup);
    this.attachedObjects.push(bandanaGroup);
  }

  public dispose() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.clearAllCosmetics();
  }
}
