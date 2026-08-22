import * as THREE from 'three';
import { SkinViewer } from 'skinview3d';
import { ShopCosmetic } from '../types';

export class Cosmetics3DRenderer {
  private viewer: SkinViewer;
  private attachedObjects: THREE.Object3D[] = [];
  private animationFrameId: number | null = null;
  private wingLeft: THREE.Object3D | null = null;
  private wingRight: THREE.Object3D | null = null;
  private haloMesh: THREE.Object3D | null = null;

  constructor(viewer: SkinViewer) {
    this.viewer = viewer;
    this.startAnimationLoop();
  }

  private startAnimationLoop() {
    let time = 0;
    const animate = () => {
      time += 0.04;

      // Animar aleteo de alas 3D
      if (this.wingLeft && this.wingRight) {
        const flap = Math.sin(time * 3) * 0.35 + 0.15;
        this.wingLeft.rotation.y = flap;
        this.wingRight.rotation.y = -flap;
      }

      // Animar rotación suave del Halo 3D
      if (this.haloMesh) {
        this.haloMesh.rotation.y += 0.02;
        this.haloMesh.position.y = 8.5 + Math.sin(time * 2) * 0.3;
      }

      this.animationFrameId = requestAnimationFrame(animate);
    };

    animate();
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
    this.haloMesh = null;
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

    // 2. Renderizar Alas 3D
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

  private attachWings(body: THREE.Object3D, cosmetic: ShopCosmetic) {
    const wingsGroup = new THREE.Group();
    wingsGroup.position.set(0, 4, 2.2); // Espalda del torso

    const isAngel = cosmetic.model_type === 'angel';
    const isMecha = cosmetic.model_type === 'mecha';
    const isDragon = cosmetic.model_type === 'dragon' || (!isAngel && !isMecha);

    const wingColor = isAngel ? 0xffffff : isMecha ? 0x00ffff : isDragon ? 0x9333ea : 0xef4444;
    const boneColor = isAngel ? 0xfef08a : isMecha ? 0x334155 : 0x1f1530;

    // Ala Izquierda
    const leftGroup = new THREE.Group();
    leftGroup.position.set(2, 0, 0);

    // Hueso principal
    const boneGeo = new THREE.BoxGeometry(0.8, 10, 0.8);
    const boneMat = new THREE.MeshBasicMaterial({ color: boneColor });
    const boneMesh = new THREE.Mesh(boneGeo, boneMat);
    boneMesh.position.set(3, 3, 0);
    boneMesh.rotation.z = -Math.PI / 4;
    leftGroup.add(boneMesh);

    // Membrana/Plumas
    const wingGeo = new THREE.BoxGeometry(6, 8, 0.2);
    const wingMat = new THREE.MeshBasicMaterial({
      color: wingColor,
      transparent: true,
      opacity: 0.85
    });
    const wingMesh = new THREE.Mesh(wingGeo, wingMat);
    wingMesh.position.set(4, 2, 0);
    wingMesh.rotation.z = -Math.PI / 6;
    leftGroup.add(wingMesh);

    // Ala Derecha
    const rightGroup = new THREE.Group();
    rightGroup.position.set(-2, 0, 0);

    const boneMeshR = boneMesh.clone();
    boneMeshR.position.set(-3, 3, 0);
    boneMeshR.rotation.z = Math.PI / 4;
    rightGroup.add(boneMeshR);

    const wingMeshR = wingMesh.clone();
    wingMeshR.position.set(-4, 2, 0);
    wingMeshR.rotation.z = Math.PI / 6;
    rightGroup.add(wingMeshR);

    wingsGroup.add(leftGroup);
    wingsGroup.add(rightGroup);

    body.add(wingsGroup);
    this.attachedObjects.push(wingsGroup);
    this.wingLeft = leftGroup;
    this.wingRight = rightGroup;
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
