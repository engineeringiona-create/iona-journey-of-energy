import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Grid, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { reduceMotion } from '../../three/scene-utils.js';
import StaticDotGridBackground from './StaticDotGridBackground.jsx';
import SonarRings from './SonarRings.jsx';

/* Real facility scan, dropped in by the user (biyogaz-tesisi.glb ->
   public/models/iona-tesis-3d.glb), revised 2026-08-09 to a simplified
   single-of-each layout. Root hierarchy is AuxScene > biogas_plant >
   { digester, pump_room, engine_room, scada_room, feed_pool,
   site_piping } — those 6 direct children of "biogas_plant" are the
   "major structures" clicks resolve to (site_piping excluded from
   plantData below, see handleClick), regardless of which of their
   ~350 child meshes was actually hit. */
const MODEL_SRC = '/models/iona-tesis-3d.glb';
useGLTF.preload(MODEL_SRC);

const CAMERA_DURATION = reduceMotion ? 0.01 : 0.8;
const CAMERA_EASE = 'power2.inOut';
/* Narrowed from 48 to 42 for a more "premium product shot" compression
   (less wide-angle bulge/distortion, edges read more parallel/imposing)
   — frameBox always fits the whole box to the frame regardless of FOV,
   so this changes the look/feel, not crop safety. */
const CAMERA_FOV = 42;
/* Fixed isometric "hero" angle — no longer user-adjustable now that
   OrbitControls interaction is off, so this direction alone defines
   what visitors see. (1, 0.8, 1) is a classic elevated 3/4 view
   (shallower/less top-down than a straight bird's-eye look); the
   actual world-space position is still computed from the real
   facility's bounding box (~90x78 units) rather than a hand-picked
   literal vector, since a small literal like [15,12,15] would sit the
   camera well inside the geometry at this model's real scale. */
const OVERVIEW_DIR = new THREE.Vector3(1, 0.8, 1).normalize();
/* frameBox computes the true worst-case-axis fit for this exact viewing
   angle (see its comment) — margin=1.0 is an exact fit with zero slack.
   Pushed to a genuinely generous 1.25 (not a near-exact 1.04 anymore)
   after repeated client feedback that feed_pool kept getting cropped —
   correctness over "looks bigger" this round; trim down later only
   once a real screenshot confirms the bottom edge has room to spare. */
const OVERVIEW_MARGIN = 1.25;
/* Portrait phones fit to height only (verticalOnly, see frameBox's own
   comment) — that alone still left the facility reading as "not quite
   fitting"/too large on an actual narrow phone screen once the mobile
   hero activation shipped, so portrait gets its own, more generous
   margin on top of the shared 1.25 rather than reusing it as-is. */
const OVERVIEW_MARGIN_PORTRAIT = 1.6;
/* Fraction of the box's own height to drop the camera position AND
   target by, together (see the vertical-drop block in Rig's framing
   effect for why position+target move together, not target alone).
   Biases the frame toward showing more of the BOTTOM of the facility
   (where feed_pool sits) at the cost of extra empty space at the top,
   instead of splitting headroom evenly around the raw geometric
   center — which is what kept leaving the lowest structure hugging the
   bottom edge across two earlier attempts. */
const OVERVIEW_VERTICAL_BIAS = 0.35;
/* No horizontal offset on the overview shot anymore — that existed
   across two earlier rounds specifically to dodge the hero-copy text,
   which used to sit vertically centered over the same band as the
   model. Now that the text is pinned near the top (#hero in base.css:
   justify-content flex-start, not centered) instead of competing for
   the same vertical space, the model is just centered, no shift needed.
   applyLateralOffset itself stays — FOCUS_OFFSET_FRACTION below still
   uses it for the per-structure zoom, unrelated to this. */
const FOCUS_DIR = new THREE.Vector3(0.65, 0.42, 0.75).normalize();
const FOCUS_MARGIN = 1.3;
/* "Offset zoom": fraction of the half-frustum-width (at the focused
   object's distance) to push the camera+target sideways so the object
   lands in roughly the screen's left third instead of dead center,
   clearing the right side for the detail panel. Bumped from 0.4 to
   0.46 when the panel grew to a large w-[450px] floating window, so
   the wider card still has clear room and doesn't sit over the model. */
const FOCUS_OFFSET_FRACTION = 0.46;

/* Hover lift + "flowing worm" glow on the 5 clickable major structures.
   The lift is a plain GSAP position tween (unchanged since Phase 5/6).
   The glow used to be a flat GSAP emissiveIntensity tween — replaced
   here with a custom animated shader (see attachHoverShader) so the
   glow itself visibly flows around the structure's surface instead of
   just fading in as one flat color. Colors are the project's own
   documented tokens, not invented hex: green is DESIGN.md's
   primary/glow-green (#78dc77); orange is this site's own
   tailwind-config.js brand-orange (#ff751f). */
const HOVER_LIFT = 0.8;
const HOVER_DURATION = reduceMotion ? 0.01 : 0.35;
const HOVER_EASE = 'power2.out';
const HOVER_WORM_COLOR_A = '#78dc77';
const HOVER_WORM_COLOR_B = '#ff751f';

/* Real plant content (industry-standard biogas equipment, not mock
   telemetry like the old STRUCTURE_INFO this replaces). Keyed by the
   GLB's top-level structure node names — deliberately has no
   site_piping entry, since the pipe network isn't one of the 5 real
   "major structures" (see Model's handleClick, which uses
   hasOwnProperty on this object as the click-selectability check —
   no entry here means a click on it just resets the view). Each
   structure's subComponents array drives Level 2 (clicking one shows
   its spec + description in the same panel). */
/* photo/video paths point at public/images/equipment and public/videos.
   Some are real site photos the client provided (murat tomak iCloud
   export); the rest (scada-room, scada-gas-analyzer, scada-plc-panel,
   digester-sensors, pump-room-macerator) are sourced placeholder photos
   filling sub-components the client set had no genuine match for — swap
   for real site photography when it becomes available. Only one video
   exists in the whole set that's actually a tight, seamless-loopable
   clip of a specific piece of equipment (the submersible mixer used in
   the feed pool) — see feed_pool's subComponents[0].video; every other
   clip in the provided folder is a wide drone/establishing shot, not
   embeddable as a small looping background without looking broken, so
   no other sub-component gets a video. */
const plantData = {
  digester: {
    title: 'Çürütücü',
    description: 'Organik atıkların metan gazına dönüştüğü mezofilik reaktör merkezi.',
    photo: '/images/equipment/digester-exterior.jpg',
    subComponents: [
      {
        name: 'Tabliye ve Perde Karıştırıcıları',
        spec: '15 kW, 320 RPM',
        description: 'Reaktör içindeki biyokütlenin homojen dağılımını sağlayan, kabuk ve sedimentasyon oluşumunu önleyen çift katmanlı karıştırma sistemi.',
        specs: [
          'Tabliye (Deck) Karıştırıcıları: Armatech Twin',
          'Perde (Wall) Karıştırıcıları: Armatech Evoplus'
        ],
        photo: '/images/equipment/digester-mixer.jpg'
      },
      {
        name: 'Isıtma Eşanjörü',
        spec: 'Paslanmaz Çelik Borulu',
        description: 'Reaktör iç sıcaklığını bakteri popülasyonu için gerekli mezofilik aralıkta stabil tutan kapalı devre ısıtma sistemi.',
        specs: [
          'Paslanmaz çelik (AISI 316) borulu eşanjör',
          'Çalışma Sıcaklığı: 38°C – 42°C',
          'Kojenerasyon atık ısısıyla beslenir',
          'Duvar içi gömülü spiral boru yerleşimi'
        ],
        photo: '/images/equipment/digester-heat-exchanger.jpg'
      },
      {
        name: 'Enstrümantasyon ve Sensörler',
        spec: 'Sürekli Proses İzleme',
        description: 'Reaktör içindeki kritik proses parametrelerini kesintisiz ölçerek SCADA sistemine aktaran ölçüm ekipmanları.',
        specs: [
          'Radar Seviye Sensörü (Radar Level Sensor)',
          'PT100 Sıcaklık Sensörleri',
          'Biyogaz Basınç Transmitterleri',
          'pH ve Redoks (ORP) Ölçüm Probları'
        ]
      }
    ]
  },
  engine_room: {
    title: 'Kojenerasyon Odası',
    description: 'Üretilen biyogazın elektrik ve ısı enerjisine dönüştürüldüğü kojenerasyon ünitesi.',
    photo: '/images/equipment/engine-room.jpg',
    subComponents: [
      {
        name: 'Gaz Motoru (V12)',
        spec: '1.2 MW Elektriksel Güç',
        description: 'Üretilen biyogazı yüksek verimle elektrik enerjisine dönüştüren, endüstriyel içten yanmalı kojenerasyon motoru.',
        specs: [
          'Müşteri talebine göre Jenbacher, MWM veya Caterpillar biyogaz motor entegrasyonu',
          'Elektriksel Verim: >%42',
          'Otomatik yük takibi (load-following) kontrolü',
          'Gerçek zamanlı emisyon izleme (NOx / CO)'
        ],
        photo: '/images/equipment/engine-room.jpg'
      },
      {
        name: 'Egzoz Isı Geri Kazanımı',
        spec: '85°C Su Çıkışı',
        description: 'Motordan çıkan yüksek sıcaklıktaki egzoz gazından enerji geri kazanan ısı eşanjör ünitesi.',
        specs: [
          'Egzoz gazı / su plakalı eşanjör',
          'Çıkış Suyu Sıcaklığı: ~85°C',
          'Reaktör ısıtma devresine entegre',
          'Otomatik bypass ve aşırı ısınma koruması'
        ],
        photo: '/images/equipment/engine-room-heat-recovery.jpg'
      }
    ]
  },
  pump_room: {
    title: 'Pompa Odası',
    description: 'Tesis içi substrat ve atık transferinin yönetildiği hidrolik merkez.',
    photo: '/images/equipment/pump-room.jpg',
    subComponents: [
      {
        name: 'Loblu Pompa (Rotary Lobe)',
        spec: 'Yüksek Viskozite Uyumlu, 80 m³/h',
        description: 'Katı madde oranı yüksek çamurun tesis içinde kesintisiz, tıkanmadan transferini sağlayan pozitif deplasmanlı pompa.',
        specs: [
          'Marka Referansı: Vogelsang / Börger tipi loblu pompa',
          'Kapasite: 80 m³/h',
          'Değiştirilebilir aşınma plakaları (wear plate)',
          'Kuru çalışmaya karşı mekanik salmastra koruması'
        ],
        photo: '/images/equipment/pump-room-lobe-pump.jpg'
      },
      {
        name: 'Maseratör (Parçalayıcı)',
        spec: 'Çift Şaftlı Bıçak',
        description: 'Pompa ve boru hattına zarar verebilecek lif, plastik ve sert yabancı maddeleri parçalayan öğütme ünitesi.',
        specs: [
          'Çift şaftlı, karşılıklı dönen kesici bıçak sistemi',
          'Sertleştirilmiş çelik (hardened steel) bıçak malzemesi',
          'Hat üzerine (in-line) flanşlı montaj',
          'Aşırı yük algılama ve otomatik ters yön (reverse) fonksiyonu'
        ],
        photo: '/images/equipment/pump-room-macerator.jpg'
      }
    ]
  },
  scada_room: {
    title: 'SCADA Kontrol Odası',
    description: 'Tesisin tüm otomasyon, ölçüm ve güvenlik verilerinin anlık olarak izlendiği beyin.',
    photo: '/images/equipment/scada-room.jpg',
    subComponents: [
      {
        name: 'Biyogaz Analizörü',
        spec: 'Sürekli CH₄, H₂S, O₂ Ölçümü',
        description: 'Üretilen gazın kalitesini saniye saniye analiz ederek gaz kalitesini SCADA sistemine raporlayan ölçüm cihazı.',
        specs: [
          'Ölçülen Parametreler: CH₄, CO₂, O₂, H₂S',
          'Numune alma hattı (sample line) ile sürekli analiz',
          'Yüksek H₂S alarm eşiği bildirimi',
          '4-20mA / Modbus çıkışlı PLC entegrasyonu'
        ],
        photo: '/images/equipment/scada-gas-analyzer.jpg'
      },
      {
        name: 'Ana PLC Panosu',
        spec: 'Yedekli Sistem Otomasyonu',
        description: 'Tesisteki tüm motor, valf ve sensörlerin algoritmik kontrolünü sağlayan merkezi otomasyon ve kumanda panosu.',
        specs: [
          'Endüstriyel PLC altyapısı (Siemens S7 / Allen-Bradley uyumlu)',
          'Uzaktan izleme ve SCADA arayüzü',
          'Yedekli güç kaynağı (redundant PSU)',
          'Alarm ve olay kayıt (event log) sistemi'
        ],
        photo: '/images/equipment/scada-plc-panel.jpg'
      }
    ]
  },
  feed_pool: {
    title: 'Besleme Havuzu',
    description: 'Tesise gelen günlük taze atıkların homojenize edilip sisteme hazırlandığı ön kabul ünitesi.',
    photo: '/images/equipment/feed-pool.jpg',
    subComponents: [
      {
        name: 'Dalgıç Karıştırıcı',
        spec: '22 kW',
        description: 'Farklı atık türlerini birbirine harmanlayarak çürütücüye standart kalitede besin hazırlayan karıştırma ünitesi.',
        specs: [
          'IONA Marka Dalgıç Karıştırıcılar',
          'Güç: 22 kW',
          'Paslanmaz çelik pervane',
          'Seviye sensörüyle otomatik çalışma senkronizasyonu'
        ],
        photo: '/images/equipment/feed-pool.jpg',
        video: '/videos/digester-mixer.mp4'
      }
    ]
  }
};

/* Fits `camera` to `box` from unit direction `dir`, at `margin` x the
   distance needed for the box to fill the frame from that specific
   angle — shared by both the full-facility overview and the
   per-structure focus so they behave identically, just with a
   different box/dir.

   Replaced the old single-axis `maxDim` heuristic (distance derived
   from whichever raw x/y/z size was largest, fit to the vertical FOV)
   after it kept under-fitting the facility vertically from
   OVERVIEW_DIR's oblique elevated angle: viewed from an angle, the
   box's DEPTH axis also projects onto the screen's vertical axis (you
   see the roof AND the near face at once), so raw axis lengths alone
   don't tell you the true on-screen extent. This version projects all
   8 box corners onto the camera's actual right/up axes for this `dir`
   and solves for the distance that fits the worst-case corner on
   EITHER axis — a guaranteed fit regardless of viewing angle or the
   canvas's aspect ratio, not a per-axis approximation. */
/* `verticalOnly` (mobile portrait only — see its call sites): drops the
   width term entirely instead of taking max(height, width). On a narrow
   portrait screen this wide/shallow facility's width term dominates by a
   huge margin (dividing by a small aspect), pushing the camera far enough
   back that the whole model reads as tiny with mostly-empty space above
   and below it — the fit-both formula is the *correct* zero-crop
   guarantee for desktop's wide viewport (see OVERVIEW_MARGIN's own
   comment on the feed_pool crop fix), but on portrait it trades away
   "model is actually visible" for "model's outer edges never crop",
   which is the wrong side of that trade-off on a phone screen. */
function frameBox(box, camera, dir, margin, verticalOnly = false) {
  const center = box.getCenter(new THREE.Vector3());
  const halfSize = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);

  const forward = dir.clone().negate();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(forward, worldUp).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();

  let maxRight = 0;
  let maxUp = 0;
  for (let sx = -1; sx <= 1; sx += 2) {
    for (let sy = -1; sy <= 1; sy += 2) {
      for (let sz = -1; sz <= 1; sz += 2) {
        const corner = new THREE.Vector3(sx * halfSize.x, sy * halfSize.y, sz * halfSize.z);
        maxRight = Math.max(maxRight, Math.abs(corner.dot(right)));
        maxUp = Math.max(maxUp, Math.abs(corner.dot(up)));
      }
    }
  }

  const fov = camera.fov * (Math.PI / 180);
  const distanceForHeight = maxUp / Math.tan(fov / 2);
  const distanceForWidth = maxRight / (Math.tan(fov / 2) * camera.aspect);
  const distance = (verticalOnly ? distanceForHeight : Math.max(distanceForHeight, distanceForWidth)) * margin;

  const position = center.clone().addScaledVector(dir, Math.max(distance, 0.001));
  return { position, center };
}

/* Shifts `position`+`center` along the camera's own local right/up axes,
   by `rightFraction`/`upFraction` of the half-frustum width/height at
   that distance — a rigid translation (same look direction, so
   orbiting/framing afterward still feels natural, no perspective skew).
   Positive rightFraction moves the rig right, which makes the framed
   object appear shifted toward the frame's LEFT (and the up axis works
   the same way: positive upFraction moves the rig up, object appears
   shifted DOWN); negative does the opposite on either axis. Shared by
   the overview framing (shifts the facility right + up, clearing the
   left-side hero text and the bottom-cropped feed_pool structure) and
   the per-structure focus framing (shifts it left only, clearing the
   right-side detail panel — no vertical need there). */
function applyLateralOffset(position, center, camera, rightFraction, upFraction = 0) {
  const distance = position.distanceTo(center);
  const viewDir = center.clone().sub(position).normalize();
  const right = new THREE.Vector3().crossVectors(viewDir, camera.up).normalize();
  const screenUp = new THREE.Vector3().crossVectors(right, viewDir).normalize();
  const vFov = camera.fov * (Math.PI / 180);
  const halfHeight = distance * Math.tan(vFov / 2);
  const halfWidth = halfHeight * camera.aspect;
  const shift = right.multiplyScalar(halfWidth * rightFraction).add(screenUp.multiplyScalar(halfHeight * upFraction));
  return { position: position.clone().add(shift), center: center.clone().add(shift) };
}

/* Walks up from any mesh to the top-level structure it belongs to
   (the direct child of plantRoot) — shared by the initial per-structure
   material assignment and by click resolution, so "which structure is
   this mesh part of" is answered the same way in both places. */
function findStructureNode(node, plantRoot) {
  while (node && node.parent !== plantRoot) node = node.parent;
  return node;
}

/* The GLB authors dozens of repeated fixtures under one shared name —
   72 wall_rib columns, 62 walkway_post, 16 stair_tread, and so on.
   GLTFLoader keeps object names unique by auto-suffixing every sibling
   past the first with _1, _2, _3, ... (verified against this project's
   installed three@0.185.1 GLTFLoader source, and empirically: loading
   this exact GLB and walking the result shows exactly one bare
   "wall_rib" plus "wall_rib_1".."wall_rib_71"). Every *_MESH_NAMES set
   and every namedMeshMaterials override in this file is keyed by the
   bare fixture name, so matching/looking up child.name directly only
   ever hit instance #0 of any repeated fixture — this strips that
   trailing _<n> back off first so all 72 (or 62, or 16, ...) copies
   resolve the same way their bare name does. */
function meshBaseName(name) {
  return name.replace(/_\d+$/, '');
}

/* Injects the "flowing worm" glow into the structure's own clay
   MeshStandardMaterial via onBeforeCompile, instead of swapping to a
   separate custom ShaderMaterial — that would mean reimplementing PBR
   lighting/shadows from scratch. This way the base clay look, shadows,
   and the X-ray opacity effect (a plain property on the same material)
   are all untouched; the hover glow is purely additive on top via
   totalEmissiveRadiance.

   Verified against this project's installed three@0.185.1 source
   (node_modules/three/src/renderers/shaders/ShaderLib/meshphysical.glsl.js)
   before writing this: `vViewPosition` and `vNormal` are already
   declared/computed varyings in MeshStandardMaterial's own shader (not
   redeclared here — redeclaring a varying is a GLSL compile error), and
   `#include <emissivemap_fragment>` runs before totalEmissiveRadiance is
   folded into the final lit color, so adding to it here reliably shows
   up regardless of the USE_EMISSIVEMAP define (which isn't set, since
   no emissive map texture is used).

   Returns the live uniforms object (uTime/uHoverActive/colors) so the
   caller can animate uHoverActive on hover and tick uTime every frame —
   mutating uniform .value directly is the standard three.js pattern for
   driving an onBeforeCompile shader after the one-time compile. */
function attachHoverWormShader(material) {
  const uniforms = {
    uTime: { value: 0 },
    uHoverActive: { value: 0 },
    uHoverColorA: { value: new THREE.Color(HOVER_WORM_COLOR_A) },
    uHoverColorB: { value: new THREE.Color(HOVER_WORM_COLOR_B) },
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHoverPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHoverPos = transformed;');

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vHoverPos;
        uniform float uTime;
        uniform float uHoverActive;
        uniform vec3 uHoverColorA;
        uniform vec3 uHoverColorB;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if ( uHoverActive > 0.0 ) {
          vec3 hoverViewDir = normalize( vViewPosition );
          float hoverRim = pow( 1.0 - clamp( dot( normalize( vNormal ), hoverViewDir ), 0.0, 1.0 ), 2.0 );
          float hoverFlow = sin( vHoverPos.x * 0.35 + vHoverPos.y * 0.55 + vHoverPos.z * 0.35 - uTime * 2.2 );
          float hoverBand = smoothstep( 0.2, 1.0, hoverFlow );
          float hoverMix = sin( uTime * 1.1 + vHoverPos.y * 0.4 ) * 0.5 + 0.5;
          vec3 hoverWormColor = mix( uHoverColorA, uHoverColorB, hoverMix );
          totalEmissiveRadiance += hoverWormColor * hoverRim * hoverBand * uHoverActive * 1.6;
        }`
      );
  };

  return uniforms;
}

/* The digester's own cylindrical shell — the mesh itself is real and
   verified out of the GLB (not guessed, and NOT named "Digester_Shell"
   — that name doesn't exist anywhere in this model; the other room
   structures each have an "_shell" mesh — engine_room_shell,
   pump_room_shell, scada_room_shell — but the digester's is named
   "tank_wall", radius 12 units i.e. ⌀24m, a real large-digester size).
   Went through several material passes (corrugated trapez-sac cladding,
   toned down, then dropped entirely for plain white — see wallMaterial
   below); DIGESTER_WALL_MESH_NAME is the one source of truth for the
   mesh name itself so the traverse below and this comment can't drift
   apart, independent of whatever the material of the day is. */
const DIGESTER_WALL_MESH_NAME = 'tank_wall';
const DIGESTER_WALL_STRIPE_REPEAT_X = 200;
/* Ridge depth in world units (meters), dialed back from earlier passes
   (0.035 → 0.6 → 0.8 → 0.35) once the albedo below carried most of the
   ridge read-out — kept at that same 0.35 now that the corrugation is
   back after a brief "plain white" detour. */
const DIGESTER_WALL_BUMP_SCALE = 0.35;

/* Corrugation as an actual <canvas>, not a DataTexture or external
   image file. One crisp light/dark half-and-half tile — not a gradient
   — so `repeat.set(200, 1)` alone controls ridge density exactly (200
   ridge pairs around the tank). Grays are 235/40, not pure 255/0: pure
   black crushes to nothing under the plant's ambient lighting, so a
   hair off pure keeps both the lit crest and shadowed valley legible.
   generateMipmaps off + NearestFilter on both filters avoids the
   mipmap trap this exact texture hit in earlier passes (both canvas and
   DataTexture went invisible at this high a `repeat` value without it). */
function createDigesterWallCorrugationTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgb(235, 235, 235)';
  ctx.fillRect(0, 0, size / 2, size);
  ctx.fillStyle = 'rgb(40, 40, 40)';
  ctx.fillRect(size / 2, 0, size / 2, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(DIGESTER_WALL_STRIPE_REPEAT_X, 1);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

/* Same ridge pattern as the bump texture above, but as an actual
   albedo/color map — kept at the low-contrast pair from the last
   tuning pass (both tones a close light warm-grey) rather than the
   original high-contrast 205/120 version, which read as a harsh
   striped/barcode pattern instead of a real corrugated panel once the
   client's own CAD reference showed uniform, near-flat panel color
   with only soft ridge shading. Separate texture (not the bump one
   reused) so the bump texture's own contrast, tuned for shading rather
   than color, stays untouched; same size/repeat so the bands still
   line up with the bump ridges. */
function createDigesterWallAlbedoTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgb(214, 214, 210)';
  ctx.fillRect(0, 0, size / 2, size);
  ctx.fillStyle = 'rgb(196, 196, 192)';
  ctx.fillRect(size / 2, 0, size / 2, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(DIGESTER_WALL_STRIPE_REPEAT_X, 1);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

/* "Global Concrete Bases" — every structure's own foundation/plinth
   mesh, verified per-structure in the GLB rather than matched by a
   loose name.includes('base') (which would also grab scada_room's
   chair_base — an office chair leg, not concrete — and pump_room's
   pump_baseplate meshes, which are small steel equipment mounting
   plates bolted to the real slab, not the slab itself). The real
   foundation node per structure: digester → foundation_pad +
   wall_plinth, pump_room/engine_room/scada_room → slab (same name
   reused in each), feed_pool → pool_pad. */
const FOUNDATION_MESH_NAMES = new Set(['foundation_pad', 'wall_plinth', 'slab', 'pool_pad']);

/* Digester "lattice" cleanup — the client reported a white grid/cage
   look sitting over the tank wall after the corrugation pass above.
   No wireframe/skeleton/placeholder helper exists anywhere in this file
   (checked; there never was one to begin with), so that's not it —
   what's actually on the tank at those coordinates, per the same GLB
   walk that found tank_wall itself: 72 separate "wall_rib" meshes
   (vertical) plus 3 "wall_band" meshes (horizontal), all still on the
   structure's shared bright ceramic material (#eaeaea) since they're
   not tank_wall and never got the dark corrugated one. Vertical ribs +
   horizontal bands, both still bright white, sitting directly on top of
   a tank_wall that's now dark gray metal (#b0b0b0) instead of matching
   ceramic — that combination reads exactly as a white lattice/cage
   against a dark background. Hidden via `visible = false` rather than
   removed from the scene graph: non-destructive, no risk to the
   structure's bounding-box math elsewhere (frameBox etc.), reversible
   in one line if this diagnosis is wrong. Doesn't include top_ring —
   that's hidden too now, but via DIGESTER_WALKWAY_FENCE_MESH_NAMES
   below (it was kept as "a real architectural edge" originally, then
   dropped once the client saw it read as one of the "3 horizontal
   lines" alongside the rail bars) — or wall_plinth (the base trim,
   already reassigned to the concrete material by FOUNDATION_MESH_NAMES
   above, so it's already not part of the "white cage" anymore either). */
/* 'wall_band' not 'wall_band_1'/'_2'/'_3' — these are three distinct,
   permanently-numbered fixtures (not GLTFLoader dedupe copies of one
   fixture), so meshBaseName (see its own comment) strips their number
   suffix down to the shared 'wall_band' root same as it would for a
   dedupe copy. Matching against the un-stripped 'wall_band_1' etc.
   here was a real bug for one round: it silently stopped matching
   anything (client saw it as "3 horizontal lines" reappearing on the
   wall) the moment baseName lookups replaced raw child.name lookups
   everywhere else in this file. */
const DIGESTER_LATTICE_MESH_NAMES = new Set(['wall_rib', 'wall_band']);

/* Digester guard-rail — three passes now. Pass 1 kept the
   walkway_rail_group_1/2 perimeter rail (client's own CAD reference
   showed one clean rail) and only hid the smaller, redundant
   rail_post/platform_rail_1/2/platform_post landing-rail set. Pass 2:
   client saw that perimeter rail as "3 horizontal lines" once the wall
   went plain white (walkway_rail, walkway_midrail, and top_ring — the
   trim ring at the wall/dome seam, previously "a real architectural
   edge" — each reading as their own circling line) and asked for all
   of it gone, so this set briefly hid the perimeter rail + top_ring +
   walkway_post too. Pass 3 (here): with the wall back to corrugated
   trapez-sac, client said the railing itself was missing — so the
   perimeter rail (walkway_rail/walkway_midrail/walkway_post) is back
   OFF this hide-set below. What stays hidden is only the genuinely
   redundant second rail system (rail_post/platform_rail/platform_post,
   the small top-of-stairs landing guard) and top_ring, which was never
   a rail — a decorative trim band, not a safety feature, so it wasn't
   what "korkuluk" (railing) meant. stair_handrail_1/2 (the sloped rail
   that follows the stairs) and top_platform/dome_walkway (the
   landing/walkway decks) are untouched either way. */
const DIGESTER_WALKWAY_FENCE_MESH_NAMES = new Set(['rail_post', 'platform_rail', 'platform_post', 'top_ring']);

/* Realism pass — client sent a detailed reference render and asked for
   the plant to read closer to it. The GLB already models every part
   the reference shows (dome seams, pipe flanges, roof HVAC/vents,
   antenna, exhaust stack, mixer rake hardware — all verified real node
   names below, same GLB walk as every other *_MESH_NAMES set in this
   file); none of it was missing geometry, it was just all still on
   each structure's one shared flat-ceramic clay material, so it read
   as a uniform blob instead of distinct dome/pipe/equipment finishes
   the way the reference shows. These five sets each get their own
   dedicated material below instead of the structure's shared one. */
const DIGESTER_DOME_MESH_NAMES = new Set(['gas_dome', 'dome_seam']);
/* Every real pipe/flange/valve fitting on the digester itself — feed
   line, heating loop in/out, and the pressure relief valve/cap. */
const DIGESTER_PIPE_MESH_NAMES = new Set([
  'feed_nozzle',
  'feed_nozzle_flange',
  'heat_inlet_nozzle',
  'heat_inlet_nozzle_flange',
  'heat_return_nozzle',
  'heat_return_nozzle_flange',
  'pressure_relief_valve',
  'relief_cap',
]);
/* The walkway/landing decking — light-grey poured concrete (client's
   final call, after trying an expanded-metal grating look first — see
   gratingMaterial's own comment), not a solid ceramic slab. stair_tread
   included (the individual stair steps are the same deck material on
   a real plant). Named *_GRATING_* still for the material's own
   history, even though the material itself is concrete now. */
const DIGESTER_GRATING_MESH_NAMES = new Set(['dome_walkway', 'walkway_inner_kerb', 'top_platform', 'stair_tread']);
/* Roof-mounted mechanical/electrical equipment + exposed exterior
   piping across the three prefab buildings — client asked for these to
   read as genuinely different things instead of one flat dark blob,
   which is what a real plant actually looks like: an antenna mast, an
   AC condenser, a chimney stack and a pump discharge header are all
   different materials/finishes in real life. Split into four groups
   below (mast/stack/mechanical-casing/pipe) instead of one shared
   "equipment" material. Registering every name on all three buildings
   is harmless (same reasoning as FOUNDATION_MESH_NAMES below):
   pump_room has no roof_ac_unit, scada_room has no exhaust_stack, etc.,
   the traverse only assigns what a given structure actually has. */
const BUILDING_MAST_MESH_NAMES = new Set(['radio_mast']);
const BUILDING_STACK_MESH_NAMES = new Set(['exhaust_stack', 'exhaust_cap']);
const BUILDING_MECH_CASING_MESH_NAMES = new Set(['roof_ac_unit', 'roof_radiator', 'radiator_fan', 'roof_vent']);
const BUILDING_PIPE_MESH_NAMES = new Set(['pump_suction', 'pump_discharge', 'discharge_header', 'header_riser']);
/* The building shell's own roof deck + fascia trim — was left on the
   structure's shared ceramic (same as windows/doors), which is part of
   why the buildings read as one flat blob. Real prefab roofs are a
   visibly different, less glossy material from the wall panels. */
const BUILDING_ROOF_MESH_NAMES = new Set(['roof', 'roof_fascia']);
const BUILDING_WINDOW_MESH_NAMES = new Set(['window']);
const BUILDING_DOOR_MESH_NAMES = new Set(['door']);
const BUILDING_DOOR_HANDLE_MESH_NAMES = new Set(['door_handle']);
/* feed_pool's rake/mixer hardware — shaft, drive housing, bridge and
   blades, plus the pool's rim collar — reference shows these as bare
   metal against the pool's raw concrete, not the structure's ceramic. */
const FEED_POOL_HARDWARE_MESH_NAMES = new Set([
  'pool_mixer_shaft',
  'pool_bridge',
  'pool_mixer_drive',
  'pool_mixer_blade',
  'pool_rim',
]);

/* Plain per-pixel random grayscale — concrete's actual grain has no
   directionality or repeating structure the way corrugated metal does,
   so unlike the wall texture this has no pattern logic at all, just
   noise. Band clamped to roughly 90-209 rather than the full 0-255 range so no
   pixel bottoms out pure black or tops out pure white — real aggregate/
   pore variation reads as this mid-range speckle, not pure white
   flecks in soot, which would look like sensor noise rather than
   material grain. Same mipmap trap as the wall texture applies here
   too — arguably worse, since pure noise is the single worst case for
   mip-averaging (it flattens to a dead uniform gray fastest of any
   pattern) — so the same generateMipmaps/NearestFilter fix is
   non-negotiable here as well. */
function createConcreteBaseNoiseTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(size, size);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const gray = 90 + Math.floor(Math.random() * 120);
    imageData.data[i] = gray;
    imageData.data[i + 1] = gray;
    imageData.data[i + 2] = gray;
    imageData.data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(15, 15);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

/* Expanded-metal walkway grating — a diagonal criss-cross of dark lines
   over a light metal base, the same visual shorthand real plant CAD
   renders use for perforated decking (an actual cut-mesh material
   would need real alpha-tested holes, a geometry-level change this
   file can't make without new UVs baked into the GLB itself; the
   diagonal hatch is the closest a bump/color texture can get). Two
   passes of parallel diagonal lines at opposing angles, not a grid —
   grating is diamond-pattern, not square. */
function createGratingTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  /* First pass came out reading as flat concrete: at repeat(24,24) the
     diamond cells were only a couple pixels across on screen, and the
     line/fill contrast was too close (205 vs 90 on a mid-grey base) to
     survive that shrink. Bigger cells (repeat 8, half the old step so
     each diamond is wider) and much darker, thicker lines against a
     near-white base fix both problems — the pattern actually resolves
     at normal camera distance instead of averaging out to grey. */
  ctx.fillStyle = 'rgb(224, 224, 221)';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgb(55, 56, 58)';
  ctx.lineWidth = 7;
  const step = 32;
  for (let offset = -size; offset < size * 2; offset += step) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + size, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(offset, size);
    ctx.lineTo(offset + size, 0);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.generateMipmaps = false;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

/* "Sandwich panel" prefab container cladding for the three rectangular
   buildings — verified in the GLB, not guessed: pump_room, engine_room
   and scada_room each have their own "_shell" node (pump_room_shell /
   engine_room_shell / scada_room_shell) containing exactly 4 real wall
   meshes named wall_front/wall_back/wall_right/wall_left, distinct from
   that shell's roof/roof_fascia/door/door_handle/window/vents — those
   stay on the structure's normal ceramic material, only the 4 wall
   names get this treatment. feed_pool is a separate case (below); the
   digester has none of these names, so it's untouched by this set. */
const BUILDING_WALL_MESH_NAMES = new Set(['wall_front', 'wall_back', 'wall_right', 'wall_left']);

/* One shared texture/repeat across all 3 buildings rather than tuning
   per-building height (their real wall heights actually differ —
   engine_room 4.6m, pump_room 3.8m, scada_room 3.4m, per their GLB
   bounding boxes) — a real industrial site commonly standardizes on one
   panel module across every building for cost/procurement reasons, so
   one shared spacing is a legitimate simplification here, not just a
   shortcut. Thick dark seam band (bottom 15% of the tile) against a
   light panel face, repeated 4x up the wall (repeat.y=4) — "thick,
   spaced-out" per spec, not the dense corrugation pattern used on the
   digester. repeat.x stays 1: the seam line already runs the tile's
   full width in one continuous band, so tiling horizontally is a
   no-op, same reasoning as the digester texture's repeat.y=1. */
function createSandwichPanelBumpTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const seamFraction = 0.15;
  const seamStart = size * (1 - seamFraction);
  ctx.fillStyle = 'rgb(220, 220, 220)';
  ctx.fillRect(0, 0, size, seamStart);
  ctx.fillStyle = 'rgb(40, 40, 40)';
  ctx.fillRect(0, seamStart, size, size - seamStart);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 4);
  /* Same mipmap trap as every other procedural texture in this file —
     a sharp, high-contrast band still needs this or it can wash out at
     typical viewing distance. */
  texture.generateMipmaps = false;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

/* feed_pool's own real wall mesh — verified in the GLB: feed_pool's
   children are pool_pad (foundation, already handled by
   FOUNDATION_MESH_NAMES), pool_wall (the actual open-tank wall this
   targets), pool_liner (the interior waterproof membrane — a distinct
   surface, intentionally left alone), pool_rim (top edge trim,
   likewise left alone), plus the mixer/bridge/chute internals which
   stay on the structure's normal ceramic material. */
const POOL_WALL_MESH_NAME = 'pool_wall';

/* Patches a real, measurable gap in the source GLB's own site_piping —
   not a guess. Read the GLB's raw vertex buffer directly (not just
   node names) to confirm: the feed line out of the pool
   ("feed_from_pool", a flat-capped pipe stub ending at x≈18.0, y≈2.82,
   z=5.2) and the feed line into the digester ("feed_to_digester",
   opening at x≈18.10, y≈2.82, z≈-1.54) never actually meet — there's a
   ~6.7 unit break between them. That gap's x/z range sits entirely
   inside pump_room's own footprint (x 16.2–23.8, z -4.3–6.3), which is
   why it reads as "the pipe into the pump room doesn't sit right"
   rather than an obviously separate digester-feed problem. Both ends
   share the same x/y closely enough (within the pipe's own ~0.3 radius)
   that a single straight cylinder bridges them cleanly — no bend
   needed. Same clay treatment as the rest of site_piping (plain
   #c0c0c0, no shared material instance, no interactivity) since this
   is a cosmetic continuation of existing pipe, not a clickable
   structure. */
const FEED_PIPE_GAP_RADIUS = 0.3;
const FEED_PIPE_GAP_START_Z = -1.8; // slight overlap past feed_to_digester's measured ≈-1.54 end
const FEED_PIPE_GAP_END_Z = 5.5; // slight overlap past feed_from_pool's measured 5.2 end
const FEED_PIPE_GAP_X = 18.05; // midpoint of the two measured stub centers (18.0 / 18.10)
const FEED_PIPE_GAP_Y = 2.82;

function FeedPipeGapFill() {
  const length = FEED_PIPE_GAP_END_Z - FEED_PIPE_GAP_START_Z;
  const centerZ = (FEED_PIPE_GAP_START_Z + FEED_PIPE_GAP_END_Z) / 2;
  return (
    <mesh
      position={[FEED_PIPE_GAP_X, FEED_PIPE_GAP_Y, centerZ]}
      rotation={[Math.PI / 2, 0, 0]}
      castShadow
      receiveShadow
      raycast={() => null}
    >
      <cylinderGeometry args={[FEED_PIPE_GAP_RADIUS, FEED_PIPE_GAP_RADIUS, length, 20]} />
      <meshStandardMaterial color="#c0c0c0" roughness={1} metalness={0.1} />
    </mesh>
  );
}

function Model({ plantRootRef, onReady, onSelect, onReset, selected }) {
  const { scene } = useGLTF(MODEL_SRC);
  /* One clay material PER top-level structure (not one shared for the
     whole plant) — that's what makes the X-ray effect possible below:
     toggling opacity on one structure's material can't leak onto the
     rest of the plant if each structure never shared a material to
     begin with. */
  const materialsRef = useRef(new Map());
  /* Each structure's original resting Y position, captured once before
     any hover lift runs, so the "lift up" / "settle back down" tween
     always has a stable ground-truth target instead of drifting from
     repeated relative moves. */
  const baseYRef = useRef(new Map());
  const hoveredNameRef = useRef(null);
  /* Per-structure live uniforms for the flowing-worm hover shader (see
     attachHoverWormShader) — mutated every frame (uTime) and tweened by
     GSAP on hover in/out (uHoverActive), not recreated. Each entry is an
     array (usually length 1) rather than a single uniforms object,
     because some structures also carry named-mesh overrides (below) —
     e.g. the digester's tank_wall/corrugated material and every
     structure's own concrete-base material — that all need to glow
     together with the structure's shared clay material on hover, so
     every material belonging to one structure lives under that
     structure's single key here. */
  const hoverUniformsRef = useRef(new Map());
  /* Named-mesh material overrides: Map<structureName, Map<meshName,
     material>>. Most meshes in a structure use that structure's one
     shared clay material (materialsRef), but a few specific, real mesh
     names get a distinct material instead — the digester's tank_wall,
     dome, pipe fittings and grating, each building's roof/window/door/
     equipment, and every structure's own foundation mesh (concrete
     base; see FOUNDATION_MESH_NAMES). Kept out of
     materialsRef's Map on purpose: that Map is one-material-per-
     structure-key by design (see its own comment), and these are a
     *second* (or third) material *for* a structure's key, not a
     replacement of it. The X-ray opacity effect below walks this Map
     too, so every override still goes transparent in step with the
     rest of its structure when selected. */
  const namedMeshMaterialsRef = useRef(new Map());

  useEffect(() => {
    return () => {
      if (hoveredNameRef.current) document.body.style.cursor = 'auto';
    };
  }, []);

  /* useLayoutEffect (not useEffect): forces the clay swap to happen
     synchronously before the browser paints the first frame of this
     scene, so there's no possible flash of the GLB's original PBR
     materials while a passive effect is still pending. */
  useLayoutEffect(() => {
    const plantRoot = scene.getObjectByName('biogas_plant') ?? scene;
    plantRootRef.current = plantRoot;

    const materials = new Map();
    const baseYs = new Map();
    const hoverUniforms = new Map();
    const namedMeshMaterials = new Map();
    /* One concrete-noise texture, shared by every structure's own
       concrete material instance below — sharing a *texture* across
       materials is fine (it's a stateless GPU resource); it's sharing a
       *material* across structures that would break the per-structure
       opacity/hover isolation this file depends on (see materialsRef's
       own comment), which is exactly why each structure still gets its
       own `new THREE.MeshStandardMaterial(...)` for its foundation. */
    const concreteNoiseTexture = createConcreteBaseNoiseTexture();
    /* Shared the same way concreteNoiseTexture is — one texture, one
       instance each of the material that uses it, per building (see
       BUILDING_WALL_MESH_NAMES's own comment on why one shared
       repeat/spacing across differing real wall heights is acceptable
       here). */
    const sandwichPanelTexture = createSandwichPanelBumpTexture();
    plantRoot.children.forEach((structure) => {
      /* MeshPhysicalMaterial — "architectural ceramic / porcelain" look
         per client spec: clearcoat (1.0) + clearcoatRoughness (0.2) is
         what makes it read as a fired, glazed ceramic surface instead of
         plain matte plastic — a distinct top specular layer over the
         base roughness/metalness, which plain MeshStandardMaterial can't
         express (no clearcoat support), hence still using
         MeshPhysicalMaterial even though this phase dropped the glass
         (transmission/ior/thickness) properties from the previous phase.
         No transmission this time — ceramic is opaque, not see-through
         — so unlike the glass phase, `transparent` is NOT set true here;
         it's toggled per-structure below (isActive) exactly like the
         original pre-glass clay material did, since an always-on
         transparent flag only makes sense for a material that's
         genuinely translucent at rest.
         attachHoverWormShader's onBeforeCompile injection still applies
         unchanged — MeshPhysicalMaterial compiles from the exact same
         meshphysical.glsl.js shader template as MeshStandardMaterial
         (verified against this project's three.js source when the
         shader was first written, see that function's own comment), so
         every chunk name/varying it depends on (#include
         <emissivemap_fragment>, vViewPosition, vNormal) is still there
         regardless of which of these two material classes is used. */
      const material = new THREE.MeshPhysicalMaterial({
        color: '#eaeaea',
        roughness: 0.5,
        metalness: 0.05,
        clearcoat: 1.0,
        clearcoatRoughness: 0.2,
      });
      const uniformsList = [attachHoverWormShader(material)];
      const structureNamedMaterials = new Map();

      if (structure.name === 'digester') {
        /* Corrugated trapez-sac cladding again — client asked for
           plain white for one round, then asked for the corrugation
           back once the wall_rib/rail lines were actually gone (those,
           not the corrugation, were the real complaint all along — see
           meshBaseName's own comment). No clearcoat: trapez sac is
           bare/painted metal cladding, not glazed ceramic — applied
           only to tank_wall below, so the dome/stairs/platform/mixers
           etc. stay the structure's normal ceramic like every other
           structure's non-foundation meshes. */
        const wallMaterial = new THREE.MeshStandardMaterial({
          color: '#d6d6d3',
          metalness: 0.15,
          roughness: 0.55,
          map: createDigesterWallAlbedoTexture(),
          bumpMap: createDigesterWallCorrugationTexture(),
          bumpScale: DIGESTER_WALL_BUMP_SCALE,
        });
        wallMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(wallMaterial));
        structureNamedMaterials.set(DIGESTER_WALL_MESH_NAME, wallMaterial);

        /* Glossy painted-metal dome — reference render shows a strong
           specular highlight and visible panel-seam shading, quite
           different from the matte clay used everywhere else. Keeps
           clearcoat (unlike the wall) since the dome reads as a smooth
           painted/coated cap, not bare trapez sac. */
        const domeMaterial = new THREE.MeshPhysicalMaterial({
          color: '#e4e4e2',
          metalness: 0.3,
          roughness: 0.22,
          clearcoat: 1.0,
          clearcoatRoughness: 0.08,
        });
        domeMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(domeMaterial));
        DIGESTER_DOME_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, domeMaterial));

        /* Bare steel pipework — feed/heating nozzles, flanges, the
           relief valve — distinct dark metal instead of the same
           ceramic as the dome/rails, matching the reference's visibly
           separate grey piping. */
        const pipeMaterial = new THREE.MeshStandardMaterial({
          color: '#8a8d90',
          metalness: 0.75,
          roughness: 0.35,
        });
        pipeMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(pipeMaterial));
        DIGESTER_PIPE_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, pipeMaterial));

        /* Walkway/landing/stair-tread decking — client tried the
           expanded-metal grating look (createGratingTexture, diagonal
           diamond hatch) for a couple of passes, then asked for plain
           light-grey poured concrete instead. Reuses the same
           concreteNoiseTexture as every foundation/plinth (texture
           shared, material instance not — see concreteNoiseTexture's
           own comment) but noticeably lighter than the foundation's
           #8c8c8c and less rough, so it still reads as its own poured
           deck rather than literally the same surface as the ground-
           level foundation ring. */
        const gratingMaterial = new THREE.MeshStandardMaterial({
          color: '#c9c9c5',
          metalness: 0,
          roughness: 0.85,
          bumpMap: concreteNoiseTexture,
          roughnessMap: concreteNoiseTexture,
          bumpScale: 0.35,
        });
        gratingMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(gratingMaterial));
        DIGESTER_GRATING_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, gratingMaterial));
      }

      if (['pump_room', 'engine_room', 'scada_room'].includes(structure.name)) {
        /* Painted prefab container metal, per client spec — applied
           only to the 4 real wall_* meshes below. roof/door/window/
           vents each get their own dedicated material further down
           instead of staying on the structure's shared ceramic. */
        const sandwichPanelMaterial = new THREE.MeshStandardMaterial({
          color: '#f5f5f5',
          metalness: 0.2,
          roughness: 0.6,
          bumpMap: sandwichPanelTexture,
          bumpScale: 0.5,
        });
        sandwichPanelMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(sandwichPanelMaterial));
        BUILDING_WALL_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, sandwichPanelMaterial));

        /* Standing-seam metal roof deck + fascia — darker and less
           glossy than the wall panels, the way a real prefab roof
           reads against its own walls instead of blending into them. */
        const roofMaterial = new THREE.MeshStandardMaterial({
          color: '#9a9d9f',
          metalness: 0.35,
          roughness: 0.5,
        });
        roofMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(roofMaterial));
        BUILDING_ROOF_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, roofMaterial));

        /* Dark tinted "mirror glass" look — opaque rather than true
           transmission (avoids the render-order/backface issues real
           glass transparency brings on a shared scene like this one)
           but still reflective and clearly not the same material as
           the wall or door beside it. */
        const windowMaterial = new THREE.MeshPhysicalMaterial({
          color: '#1e2b33',
          metalness: 0.2,
          roughness: 0.08,
          clearcoat: 1.0,
          clearcoatRoughness: 0.05,
        });
        windowMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(windowMaterial));
        BUILDING_WINDOW_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, windowMaterial));

        /* Painted steel door — a different shade from the wall panel
           it sits in, matte rather than the wall's slight sheen. */
        const doorMaterial = new THREE.MeshStandardMaterial({
          color: '#8b8f93',
          metalness: 0.25,
          roughness: 0.55,
        });
        doorMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(doorMaterial));
        BUILDING_DOOR_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, doorMaterial));

        /* Small bright metal accent — a real door handle/lever is
           polished hardware, not the same matte paint as the door
           slab it's mounted on. */
        const doorHandleMaterial = new THREE.MeshStandardMaterial({
          color: '#c7c9cc',
          metalness: 0.85,
          roughness: 0.25,
        });
        doorHandleMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(doorHandleMaterial));
        BUILDING_DOOR_HANDLE_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, doorHandleMaterial));

        /* Antenna mast — client flagged this + the stack/casing below
           as reading "black" instead of metal: near-black color (#2b2c2e)
           combined with only moderate metalness/roughness doesn't catch
           enough specular highlight to read as metal, it just reads as
           matte black paint (same lesson as the walkway deck material
           going through a "looks like concrete" round earlier — a dark
           flat color needs a strong specular response to say "metal"
           regardless of light angle, color alone won't do it). Lightened
           to an actual mid-grey steel tone and pushed metalness/lowered
           roughness for a sharper highlight. */
        const mastMaterial = new THREE.MeshStandardMaterial({
          color: '#9a9d9f',
          metalness: 0.75,
          roughness: 0.3,
        });
        mastMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(mastMaterial));
        BUILDING_MAST_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, mastMaterial));

        /* Exhaust stack + cap — same "reads as black paint, not metal"
           fix as mastMaterial above: lighter steel grey, higher
           metalness, lower roughness, still a shade darker than the
           mechanical casing below so it stays a visually distinct pipe
           rather than another equipment box. */
        const stackMaterial = new THREE.MeshStandardMaterial({
          color: '#7e8184',
          metalness: 0.75,
          roughness: 0.3,
        });
        stackMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(stackMaterial));
        BUILDING_STACK_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, stackMaterial));

        /* Mechanical equipment casing (AC condenser, radiator, vent
           hood) — reuses the grating texture at a much tighter repeat
           as a stand-in for a fan grille/louvre, instead of one flat
           color; a real condenser unit reads mostly as its own grille
           face, not a smooth box. */
        const grilleTexture = createGratingTexture();
        grilleTexture.repeat.set(3, 3);
        grilleTexture.needsUpdate = true;
        const mechCasingMaterial = new THREE.MeshStandardMaterial({
          /* Same lighten-and-push-metalness fix as mastMaterial/
             stackMaterial above. */
          color: '#a0a3a5',
          metalness: 0.7,
          roughness: 0.3,
          map: grilleTexture,
          bumpMap: grilleTexture,
          bumpScale: 0.2,
        });
        mechCasingMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(mechCasingMaterial));
        BUILDING_MECH_CASING_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, mechCasingMaterial));

        /* Exposed exterior piping (pump discharge header etc.) — same
           bare-steel finish as the digester's own pipe fittings, so
           piping reads consistently across the whole plant. */
        const buildingPipeMaterial = new THREE.MeshStandardMaterial({
          color: '#8a8d90',
          metalness: 0.75,
          roughness: 0.35,
        });
        buildingPipeMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(buildingPipeMaterial));
        BUILDING_PIPE_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, buildingPipeMaterial));
      }

      if (structure.name === 'feed_pool') {
        /* Raw poured concrete, per client spec — same noise texture as
           every foundation (concreteNoiseTexture, unmodified: same
           repeat/filtering), applied only to pool_wall so pool_liner/
           pool_rim/the mixer internals stay the structure's normal
           ceramic. Its own material instance (not concreteMaterial from
           the foundation block below) since the spec calls for
           roughness 1.0 / bumpScale 0.6 here vs. 0.9 / 0.4 for
           foundations — same grain, different finish. */
        const poolWallMaterial = new THREE.MeshStandardMaterial({
          color: '#8c8c8c',
          roughness: 1.0,
          bumpMap: concreteNoiseTexture,
          bumpScale: 0.6,
        });
        poolWallMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(poolWallMaterial));
        structureNamedMaterials.set(POOL_WALL_MESH_NAME, poolWallMaterial);

        /* Rake/mixer hardware + rim collar — bare metal against the
           pool's raw concrete, matching the reference instead of the
           structure's flat ceramic. */
        const poolHardwareMaterial = new THREE.MeshStandardMaterial({
          color: '#9a9c9e',
          metalness: 0.7,
          roughness: 0.4,
        });
        poolHardwareMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(poolHardwareMaterial));
        FEED_POOL_HARDWARE_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, poolHardwareMaterial));
      }

      /* Every structure gets its own concrete-base material instance
         (texture shared, material not — see concreteNoiseTexture's own
         comment) registered under every real foundation mesh name; the
         traverse below only actually assigns it where that name exists
         as a descendant, so harmlessly registering all of
         FOUNDATION_MESH_NAMES here even though e.g. digester has no
         "slab" and pump_room has no "pool_pad" costs nothing. */
      const concreteMaterial = new THREE.MeshStandardMaterial({
        color: '#8c8c8c',
        roughness: 0.9,
        bumpMap: concreteNoiseTexture,
        roughnessMap: concreteNoiseTexture,
        bumpScale: 0.4,
      });
      concreteMaterial.needsUpdate = true;
      uniformsList.push(attachHoverWormShader(concreteMaterial));
      FOUNDATION_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, concreteMaterial));

      hoverUniforms.set(structure.name, uniformsList);
      namedMeshMaterials.set(structure.name, structureNamedMaterials);
      materials.set(structure.name, material);
      baseYs.set(structure.name, structure.position.y);
    });
    materialsRef.current = materials;
    baseYRef.current = baseYs;
    hoverUniformsRef.current = hoverUniforms;
    namedMeshMaterialsRef.current = namedMeshMaterials;

    scene.traverse((child) => {
      if (!child.isMesh) return;
      const structure = findStructureNode(child, plantRoot);
      const material = structure && materials.get(structure.name);
      if (!material) return;
      /* meshBaseName strips GLTFLoader's auto _<n> de-dupe suffix — see
         its own comment. Every hide-check and override lookup below
         goes through it, not raw child.name, or only the first of any
         repeated fixture (wall_rib, walkway_post, stair_tread, ...)
         would ever match. */
      const baseName = meshBaseName(child.name);
      /* See DIGESTER_LATTICE_MESH_NAMES's own comment — hides the
         wall_rib/wall_band meshes so the tank_wall corrugation reads
         clean underneath instead of caged behind them. visible=false,
         not removed from the graph: everything else (dome, copper
         highlights, concrete base, pipes, valve, stairs, top_platform
         deck) is untouched, same materials/uniforms/hover-glow as
         before. Same treatment for DIGESTER_WALKWAY_FENCE_MESH_NAMES —
         see its own comment — for the redundant landing guard-rail and
         the top_ring trim band, both near the wall/dome seam. */
      if (
        structure.name === 'digester' &&
        (DIGESTER_LATTICE_MESH_NAMES.has(baseName) || DIGESTER_WALKWAY_FENCE_MESH_NAMES.has(baseName))
      ) {
        child.visible = false;
        return;
      }
      /* A handful of specific, real mesh names (tank_wall, and each
         structure's own foundation/plinth) get a dedicated material
         instead of the structure's shared flat-ceramic one — see
         namedMeshMaterialsRef's own comment for why these can't just
         live in `materials`. */
      const override = namedMeshMaterials.get(structure.name)?.get(baseName);
      child.material = override ?? material;
      child.material.needsUpdate = true;
      child.castShadow = true;
      child.receiveShadow = true;
    });

    onReady(plantRoot);
  }, [scene, plantRootRef, onReady]);

  /* X-ray / glass effect: the selected structure's own material goes
     transparent so its internals (mixers, coils, pipework) read through
     the shell; every other structure — including "nothing selected" —
     stays fully solid ceramic. `transparent` IS toggled here again
     (isActive) — restored from the previous "frosted glass" phase, where
     it had to be removed because that base material was permanently
     transparent:true. This ceramic base has no transmission and is
     opaque at rest, so transparent must stay off except while a
     structure is actively selected, or opacity:0.25 wouldn't render as
     see-through at all (three.js ignores opacity < 1 on a material with
     transparent:false). Runs off the same `selected` object the
     camera's offset-zoom effect (in Rig) already reacts to, so the two
     are two independent effects on one shared piece of state, not
     coupled to each other. */
  useEffect(() => {
    materialsRef.current.forEach((material, name) => {
      const isActive = Boolean(selected) && name === selected.name;
      material.transparent = isActive;
      material.opacity = isActive ? 0.25 : 1;
      material.needsUpdate = true;
    });
    /* Named-mesh overrides (tank_wall, every structure's concrete base)
       aren't in materialsRef's Map — see namedMeshMaterialsRef's own
       comment — so they need the same isActive toggle applied by hand,
       or e.g. a structure's foundation would stay solid while the rest
       of it goes see-through on select. */
    namedMeshMaterialsRef.current.forEach((structureNamedMaterials, structureName) => {
      const isActive = Boolean(selected) && structureName === selected.name;
      structureNamedMaterials.forEach((material) => {
        material.transparent = isActive;
        material.opacity = isActive ? 0.25 : 1;
        material.needsUpdate = true;
      });
    });
  }, [selected]);

  /* Only the 5 named structures in plantData (digester, engine room,
     pump room, SCADA room, feed pool) are real "major structures" —
     site_piping (the pipe network connecting them) has no plantData
     entry on purpose, so clicking a pipe resets the view instead of
     zooming into it, same as clicking empty background. */
  const handleClick = useCallback(
    (event) => {
      event.stopPropagation();
      const plantRoot = plantRootRef.current;
      if (!plantRoot) return;
      const node = findStructureNode(event.object, plantRoot);
      if (node && Object.prototype.hasOwnProperty.call(plantData, node.name)) {
        onSelect(node);
      } else {
        onReset();
      }
    },
    [plantRootRef, onSelect, onReset]
  );

  /* Shared by pointer-over and pointer-out: tweens the structure's own
     Y position (lift) and fades the flowing-worm shader's uHoverActive
     uniform in/out (independent of the X-ray opacity effect above,
     which is a plain material property, not a shader uniform). Tweening
     a live three.js uniform's .value via GSAP — rather than snapping it
     — is what makes the glow fade in/out smoothly instead of popping. */
  const animateHover = useCallback((node, isHovering) => {
    const uniformsList = hoverUniformsRef.current.get(node.name);
    if (uniformsList) {
      uniformsList.forEach((uniforms) => {
        gsap.to(uniforms.uHoverActive, {
          value: isHovering ? 1 : 0,
          duration: HOVER_DURATION,
          ease: HOVER_EASE,
        });
      });
    }
    const baseY = baseYRef.current.get(node.name) ?? 0;
    gsap.to(node.position, {
      y: isHovering ? baseY + HOVER_LIFT : baseY,
      duration: HOVER_DURATION,
      ease: HOVER_EASE,
    });
  }, []);

  /* hoveredNameRef dedupes repeated pointer-over events fired as the
     cursor crosses between the ~350 individual meshes that make up a
     single structure — without it, every mesh boundary would restart
     the lift tween from scratch. */
  const handlePointerOver = useCallback(
    (event) => {
      event.stopPropagation();
      const plantRoot = plantRootRef.current;
      if (!plantRoot) return;
      const node = findStructureNode(event.object, plantRoot);
      if (!node || !Object.prototype.hasOwnProperty.call(plantData, node.name)) return;
      if (hoveredNameRef.current === node.name) return;
      hoveredNameRef.current = node.name;
      document.body.style.cursor = 'pointer';
      animateHover(node, true);
    },
    [plantRootRef, animateHover]
  );

  const handlePointerOut = useCallback(
    (event) => {
      event.stopPropagation();
      const plantRoot = plantRootRef.current;
      if (!plantRoot) return;
      const node = findStructureNode(event.object, plantRoot);
      if (!node || !Object.prototype.hasOwnProperty.call(plantData, node.name)) return;
      hoveredNameRef.current = null;
      document.body.style.cursor = 'auto';
      animateHover(node, false);
    },
    [plantRootRef, animateHover]
  );

  /* Drives the flowing-worm shader's motion — cheap (5 float writes/
     frame) even though it runs regardless of hover state, since the
     shader itself gates all visible cost behind `uHoverActive > 0.0`. */
  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    hoverUniformsRef.current.forEach((uniformsList) => {
      uniformsList.forEach((uniforms) => {
        uniforms.uTime.value = elapsed;
      });
    });
  });

  return (
    <primitive
      object={scene}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    />
  );
}

/* Owns the camera/controls tweening + shadow-frustum fitting once the
   model's real bounding box is known, and the click -> focus / miss ->
   reset transitions. Kept inside <Canvas> since it needs useThree/
   useFrame. */
function Rig({ plantRootRef, selected, groundY, groundScale, shadowFar, keyLightRef }) {
  const { camera, gl } = useThree();
  const controlsRef = useRef(null);
  const overviewRef = useRef(null);
  const timelineRef = useRef(null);

  /* selectedRef mirrors the `selected` prop into a ref purely so
     handleResize below (registered once, in the effect whose own
     dependency is plantRootRef.current, not selected) can read the
     *current* selection without going stale — re-running that whole
     effect (and re-attaching window listeners) every time selection
     changes would be wasteful, and selected itself already has its own
     separate effect for the focus-zoom tween below. */
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    if (!plantRootRef.current) return;

    /* Pulled out of the one-shot mount effect it used to live in —
       client asked for the model to actually re-scale between portrait
       and landscape instead of staying framed for whichever orientation
       was active on load, so this now also runs on resize/
       orientationchange (guarded to skip while a structure is focused,
       so rotating the phone mid-focus doesn't yank the camera back to
       the overview). */
    function applyOverviewFraming() {
      const box = new THREE.Box3().setFromObject(plantRootRef.current);
      const size = box.getSize(new THREE.Vector3());
      /* Portrait phones (camera.aspect < 1): see frameBox's own comment —
         fitting this wide facility to width as well leaves it tiny with
         empty space above/below, so portrait fits to height only — and
         with its own larger margin (OVERVIEW_MARGIN_PORTRAIT), since
         fitting tightly to height alone still read as too large/barely
         fitting on an actual phone screen. */
      const isPortrait = camera.aspect < 1;
      const framed = frameBox(
        box,
        camera,
        OVERVIEW_DIR,
        isPortrait ? OVERVIEW_MARGIN_PORTRAIT : OVERVIEW_MARGIN,
        isPortrait
      );

      /* Direct, hard vertical bias — camera position AND target dropped by
         the same world-space Y amount (not just target alone, which would
         silently steepen OVERVIEW_DIR's chosen elevation angle instead of
         just relocating the framed content). This spends the frame's
         headroom at the TOP (which was empty) instead of the bottom
         (where feed_pool was hugging/crossing the edge), independent of
         any FOV/aspect/angle math — a blunt, easy-to-verify fix per
         explicit client direction after two rounds of formula tuning
         still weren't visibly enough. Combined with OVERVIEW_MARGIN's
         generous 1.25 (real headroom, not a near-exact fit), this
         prioritizes "definitely not cropped" over "as tight as possible". */
      const verticalDrop = size.y * OVERVIEW_VERTICAL_BIAS;
      const position = framed.position.clone();
      position.y -= verticalDrop;
      const center = framed.center.clone();
      center.y -= verticalDrop;

      overviewRef.current = { position, center };

      camera.position.copy(position);
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    }

    applyOverviewFraming();

    if (keyLightRef.current) {
      const light = keyLightRef.current;
      const box = new THREE.Box3().setFromObject(plantRootRef.current);
      const size = box.getSize(new THREE.Vector3());
      const radius = Math.max(size.x, size.y, size.z) * 0.75;
      light.shadow.camera.left = -radius;
      light.shadow.camera.right = radius;
      light.shadow.camera.top = radius;
      light.shadow.camera.bottom = -radius;
      light.shadow.camera.near = 0.5;
      light.shadow.camera.far = radius * 4;
      light.shadow.camera.updateProjectionMatrix();
    }

    /* Debounced: a live window drag on desktop fires `resize` dozens of
       times a second, and re-walking the full ~350-mesh bounding box on
       every one of those would be wasted work for a value that only
       needs to settle once the resize/rotation is actually done. */
    let resizeTimeout;
    function handleResize() {
      if (selectedRef.current) return;
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(applyOverviewFraming, 150);
    }
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantRootRef.current]);

  /* Mobile "3D Modeli Görüntüle" activation cue (see #mobile-3d-cta /
     initHeroTwin in main-anasayfa.js) — a small, one-shot dolly toward
     whatever the camera's currently looking at, just enough to read as
     "this just came alive/became interactive" without re-framing or
     fighting the overview/focus positions those own effects already
     own. Purely cosmetic: doesn't touch controls.target, so it doesn't
     interfere with frameBox's own math either. */
  useEffect(() => {
    function handleMobileActivate() {
      if (!controlsRef.current || reduceMotion) return;
      const target = controlsRef.current.target;
      const offset = camera.position.clone().sub(target);
      const closer = target.clone().add(offset.multiplyScalar(0.82));
      gsap.to(camera.position, {
        x: closer.x,
        y: closer.y,
        z: closer.z,
        duration: CAMERA_DURATION,
        ease: CAMERA_EASE,
      });
    }
    document.addEventListener('mobiletwinactivate', handleMobileActivate);
    return () => document.removeEventListener('mobiletwinactivate', handleMobileActivate);
  }, [camera]);

  useEffect(() => {
    if (!controlsRef.current) return;
    timelineRef.current?.kill();

    let position;
    let center;
    if (selected) {
      const box = new THREE.Box3().setFromObject(selected);
      /* Same tiny-model risk frameBox's own comment describes, so any
         portrait viewport (independent of exact width) fits to height
         only here too. */
      const framed = frameBox(box, camera, FOCUS_DIR, FOCUS_MARGIN, camera.aspect < 1);
      /* FOCUS_OFFSET_FRACTION's sideways push exists only to clear the
         detail panel's desktop position (sm:right-10, a column beside
         the model — see DetailPanel's own comment). DetailPanel drops
         that side column below Tailwind's `sm` breakpoint (640px) and
         becomes a full-width top banner instead, so below that exact
         width there's no side panel left to dodge — shifting the camera
         there would just push the model off-center for nothing. Keyed
         on width (matching DetailPanel's own breakpoint) rather than
         aspect, since a tablet in portrait can still be >=640px wide
         and get the real side panel. */
      ({ position, center } = window.innerWidth >= 640
        ? applyLateralOffset(framed.position, framed.center, camera, FOCUS_OFFSET_FRACTION)
        : framed);
    } else if (overviewRef.current) {
      ({ position, center } = overviewRef.current);
    } else {
      return;
    }

    const target = controlsRef.current.target;
    /* The ~350-mesh shadow map is the single most expensive pass in this
       scene, and it depends only on light/geometry, never on the camera
       — so it's dead work to keep re-baking it every one of these frames
       while only the camera is moving. Freezing autoUpdate for the tween's
       duration (and forcing one last bake on arrival, in case anything
       else queued a shadow-affecting change mid-flight) is a free ~1s
       window of guaranteed 60fps for exactly the moment a stutter would
       be most visible. */
    gl.shadowMap.autoUpdate = false;
    const tl = gsap.timeline({
      onComplete: () => {
        gl.shadowMap.autoUpdate = true;
        gl.shadowMap.needsUpdate = true;
      }
    });
    tl.to(camera.position, { x: position.x, y: position.y, z: position.z, duration: CAMERA_DURATION, ease: CAMERA_EASE }, 0);
    tl.to(target, { x: center.x, y: center.y, z: center.z, duration: CAMERA_DURATION, ease: CAMERA_EASE }, 0);
    timelineRef.current = tl;

    return () => {
      tl.kill();
      gl.shadowMap.autoUpdate = true;
    };
  }, [selected, camera, gl]);

  useFrame(() => controlsRef.current?.update());

  return (
    <>
      {/* Camera is fully scripted (GSAP-driven) now, not user-steered —
          all interaction is off. `controls.target` stays the thing GSAP
          tweens and update() keeps camera.position in sync with it
          every frame, same mechanism as before, just with no pointer
          handlers left to disable that. */}
      <OrbitControls ref={controlsRef} enableRotate={false} enableZoom={false} enablePan={false} />
      {/* Replaces the old flat grey circle mesh that used to sit under the
         plant as an artificial "base" — a soft baked contact shadow reads
         as real grounding without boxing the facility into a disc.
         scale/far are computed from the real facility's bounding box
         (~90x78 units) rather than a small literal like scale={20},
         which would leave most of the plant outside the shadow catcher.
         frames={1}: the plant geometry never animates (only the camera
         does, via GSAP), so baking once avoids re-rendering the whole
         ~350-mesh scene into the shadow render target every frame. */}
      <ContactShadows
        position={[0, groundY, 0]}
        scale={groundScale}
        far={shadowFar}
        resolution={1024}
        frames={1}
        opacity={0.6}
        blur={2}
        color="#2e2e2e"
      />
      {/* Faint architectural/engineering floor grid so the facility reads
         as grounded on a surface instead of floating in a white void,
         now that the solid grey base disc is gone. Sits a hair below the
         contact-shadow plane (same groundY) to avoid z-fighting between
         the two coplanar meshes. Rotated flat the same way the old
         circular base mesh was (-90° on X — PlaneGeometry is vertical,
         XY-facing, by default). cellSize/sectionSize scaled up from
         drei's defaults (0.5/1) to suit this facility's real ~90x78
         unit footprint — the defaults would read as visual noise at
         this scale. */}
      <Grid
        position={[0, groundY - 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        args={[groundScale, groundScale]}
        infiniteGrid
        fadeDistance={30}
        fadeStrength={1}
        cellSize={2}
        cellThickness={0.6}
        cellColor="#d4d4d4"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#b5b5b5"
      />
    </>
  );
}

/* Placeholder for the real equipment photography the client wants to
   drop in per sub-component (e.g. the actual Mixer) — no photo assets
   exist yet, so this renders a clearly-labeled empty slot rather than
   a broken <img>, and can be swapped for a real <img>/<Image> once the
   client supplies photos, without touching the panel layout. */
function EquipmentImagePlaceholder() {
  return (
    <div className="h-64 w-full shrink-0 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-100 flex flex-col items-center justify-center gap-3 text-gray-400">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="w-10 h-10"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-label-caps text-label-caps text-gray-400 text-center px-6">
        Gerçek Ekipman Fotoğrafı
      </span>
    </div>
  );
}

/* Renders real client-provided media when a structure/sub-component has
   it, falling back to EquipmentImagePlaceholder when it doesn't — never
   a broken <img>. `video` takes priority over `photo` when both exist
   (only true for the digester's mixer, the one clip in the client's
   folder that's actually a tight, loopable shot of a single piece of
   equipment rather than a wide drone establishing shot). Video is
   strictly a seamless embedded loop, never a standard player: no
   controls, autoPlay+loop+muted+playsInline (muted is what makes
   autoplay reliable across browsers), pointer-events-none so it can
   never be clicked into a native fullscreen/controls state. */
function EquipmentMedia({ photo, video }) {
  if (video) {
    return (
      <video
        className="h-64 w-full shrink-0 rounded-2xl object-cover pointer-events-none"
        src={video}
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
      />
    );
  }
  if (photo) {
    return (
      <img
        className="h-64 w-full shrink-0 rounded-2xl object-cover"
        src={photo}
        alt=""
      />
    );
  }
  return <EquipmentImagePlaceholder />;
}

/* Level 1 (subIndex null): structure title + description + a button
   per sub-component. Level 2 (subIndex set): same panel, header swaps
   to a "‹ back to structure" button and the body shows that
   sub-component's photo + spec + description instead. One panel, two
   states, rather than two separate components, since it's the same
   physical card just changing content.

   Redesigned as a large "floating app window" (w-[450px], min-h-[75vh],
   vertically centered on the right) rather than the old compact w-80
   card, to make real use of the empty space beside the offset-zoomed
   model — see FOCUS_OFFSET_FRACTION above, bumped to keep the model
   clear of this wider card. On mobile it falls back to a compact
   top banner (same as before) since there's no spare side space there. */
function DetailPanel({ structureKey, subIndex, onSelectSub, onBack, onClose }) {
  const structure = plantData[structureKey];
  if (!structure) return null;
  const sub = subIndex != null ? structure.subComponents[subIndex] : null;

  return (
    <div className="absolute z-20 top-24 left-4 right-4 max-h-[70vh] sm:max-h-[85vh] sm:top-1/2 sm:left-auto sm:right-10 sm:-translate-y-1/2 sm:w-[450px] sm:min-h-[75vh] overflow-y-auto rounded-3xl border border-white/40 bg-white/75 backdrop-blur-2xl shadow-2xl p-8 text-gray-900 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        {sub ? (
          <button
            type="button"
            onClick={onBack}
            className="font-label-caps text-label-caps text-gray-500 hover:text-gray-800 transition-colors duration-200 inline-flex items-center gap-1.5"
          >
            <span aria-hidden="true" className="text-lg leading-none">&lsaquo;</span> {structure.title}
          </button>
        ) : (
          <span className="font-label-caps text-label-caps text-gray-500">Tesis Bileşeni</span>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="shrink-0 -mt-1 -mr-1 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-800 hover:bg-black/5 transition-colors duration-200 leading-none text-2xl"
        >
          &times;
        </button>
      </div>

      {sub ? (
        <div className="flex flex-col gap-6">
          <EquipmentMedia photo={sub.photo} video={sub.video} />
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">{sub.name}</h2>
            <p className="text-sm font-bold tracking-wide text-emerald-600">{sub.spec}</p>
          </div>
          <p className="text-base leading-relaxed text-gray-600">{sub.description}</p>
          {sub.specs && sub.specs.length > 0 && (
            <ul className="flex flex-col gap-2.5 rounded-2xl border border-black/10 bg-black/[0.02] p-5">
              {sub.specs.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm leading-snug text-gray-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {structure.photo && (
            <img
              className="h-48 w-full shrink-0 rounded-2xl object-cover"
              src={structure.photo}
              alt=""
            />
          )}
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">{structure.title}</h2>
          <p className="text-base leading-relaxed text-gray-600">{structure.description}</p>
          <div className="flex flex-col gap-3">
            {structure.subComponents.map((component, index) => (
              <button
                key={component.name}
                type="button"
                onClick={() => onSelectSub(index)}
                className="w-full text-left rounded-2xl border border-black/10 bg-black/[0.03] hover:bg-black/[0.06] transition-colors duration-200 px-5 py-4"
              >
                <span className="block text-base font-bold text-gray-900">{component.name}</span>
                <span className="block text-sm text-gray-500 mt-0.5">{component.spec}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GltfTwinScene() {
  const [selected, setSelected] = useState(null);
  /* 0 = Overview, 1 = Main Component (focused/offset-zoomed, panel
     shows description + sub-component buttons), 2 = Sub-Component
     (panel swaps to that sub-component's spec + description; camera
     doesn't move any further for this level, it's a UI-only change). */
  const [currentLevel, setCurrentLevel] = useState(0);
  const [selectedSubIndex, setSelectedSubIndex] = useState(null);
  const plantRootRef = useRef(null);
  const keyLightRef = useRef(null);
  const [groundY, setGroundY] = useState(0);
  const [groundScale, setGroundScale] = useState(120);
  const [shadowFar, setShadowFar] = useState(40);
  const [ringPositions, setRingPositions] = useState([]);
  /* First-click discoverability affordances (floating pill + sonar
     rings) live until the visitor proves they've found the interaction
     — then gone for the rest of the session. Deliberately not persisted
     (no localStorage) since a full reload is a fresh visit. */
  const [hasInteracted, setHasInteracted] = useState(false);

  const handleReady = useCallback((plantRoot) => {
    const box = new THREE.Box3().setFromObject(plantRoot);
    const size = box.getSize(new THREE.Vector3());
    setGroundY(box.min.y - 0.02);
    /* Contact-shadow catcher plane must comfortably outsize the real
       facility footprint (max horizontal dimension) and its shadow
       camera's far plane must clear the tallest structure, or parts of
       the plant fall outside the baked shadow render entirely. */
    setGroundScale(Math.max(size.x, size.z) * 1.3);
    setShadowFar(Math.max(size.y * 4, 20));

    /* One sonar-ring anchor per real clickable structure (site_piping
       excluded, same rule Model's handleClick uses), positioned at each
       structure's own roof center rather than a single shared height —
       the 5 structures are very different sizes (digester vs. a small
       pump room), so one global "top" would float above the shorter
       ones instead of sitting on them. */
    const rings = [];
    plantRoot.children.forEach((structure) => {
      if (!Object.prototype.hasOwnProperty.call(plantData, structure.name)) return;
      const structureBox = new THREE.Box3().setFromObject(structure);
      const center = structureBox.getCenter(new THREE.Vector3());
      rings.push({ name: structure.name, position: [center.x, structureBox.max.y + 1.2, center.z] });
    });
    setRingPositions(rings);
  }, []);

  const handleSelect = useCallback((node) => {
    setSelected(node);
    setSelectedSubIndex(null);
    setCurrentLevel(1);
    setHasInteracted(true);
  }, []);
  const handleReset = useCallback(() => {
    setSelected(null);
    setSelectedSubIndex(null);
    setCurrentLevel(0);
  }, []);
  const handleSelectSub = useCallback((index) => {
    setSelectedSubIndex(index);
    setCurrentLevel(2);
  }, []);
  const handleBackToStructure = useCallback(() => {
    setSelectedSubIndex(null);
    setCurrentLevel(1);
  }, []);

  /* Bridges into the plain-JS side of the page (hero title/badge live
     in index.html, driven by main-anasayfa.js, not React) so the hero
     copy can fade out of the way once the visitor drills into a
     structure, instead of overlapping the offset-zoomed object. */
  useEffect(() => {
    document.dispatchEvent(new CustomEvent('twinlevelchange', { detail: { level: currentLevel } }));
  }, [currentLevel]);

  return (
    <div className="relative w-full h-full">
      <StaticDotGridBackground />
      <Canvas
        className="relative z-10"
        shadows
        camera={{ fov: CAMERA_FOV, near: 0.1, far: 500 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: true }}
        onPointerMissed={handleReset}
      >
        {/* No flat <color background> anymore — canvas stays transparent
           so the radial-gradient CSS on #iona-digital-twin-root (base.css)
           shows through instead, for perceived depth vs. a flat fill. */}
        <ambientLight intensity={0.55} />
        <directionalLight
          ref={keyLightRef}
          position={[30, 45, 20]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0005}
        />
        <directionalLight position={[-25, 15, -20]} intensity={0.4} />

        <Model
          plantRootRef={plantRootRef}
          onReady={handleReady}
          onSelect={handleSelect}
          onReset={handleReset}
          selected={selected}
        />
        <FeedPipeGapFill />
        <Rig
          plantRootRef={plantRootRef}
          selected={selected}
          groundY={groundY}
          groundScale={groundScale}
          shadowFar={shadowFar}
          keyLightRef={keyLightRef}
        />
        <SonarRings rings={ringPositions} active={!hasInteracted} />
      </Canvas>

      {selected && (
        <DetailPanel
          structureKey={selected.name}
          subIndex={selectedSubIndex}
          onSelectSub={handleSelectSub}
          onBack={handleBackToStructure}
          onClose={handleReset}
        />
      )}

      {/* First-click discoverability hint — bottom-center so it never
         competes with the hero title (now pinned near the top, see
         #hero in base.css) or the offset-zoomed model. Gone the instant
         hasInteracted flips true, same trigger as SonarRings above. */}
      {!hasInteracted && (
        <div className="pointer-events-none absolute inset-x-0 bottom-10 z-20 flex justify-center">
          <div className="animate-pulse rounded-full border border-[var(--border-strong)] bg-[var(--surface)]/70 px-6 py-3 shadow-lg backdrop-blur-md">
            <span className="font-label-caps text-label-caps text-[var(--text)]">
              Tesisi Keşfetmek İçin Yapıları Seçin
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
