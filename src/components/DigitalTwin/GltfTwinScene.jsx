import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Grid, Html, Line, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { reduceMotion } from '../../three/scene-utils.js';
import { applyStructureOverrides } from './plantStructureOverrides.js';

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
/* ~12Hz shadow-map rebake instead of every frame — see Rig's shadow
   bake effect for why. Soft/low-frequency shadows (slow propeller
   spin, slow beacon pulse) show no visible stepping at this rate. */
const SHADOW_BAKE_INTERVAL = 1 / 12;
/* Narrowed 48 -> 42 -> 35 across phases for progressively more
   "premium product shot" compression (less wide-angle bulge/distortion,
   edges read more parallel/imposing, closer to a telephoto architectural
   photo) — frameBox always fits the whole box to the frame regardless of
   FOV, so this is purely a lens-feel knob, not the size lever (that's
   OVERVIEW_MARGIN below). */
const CAMERA_FOV = 35;
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
/* Phase 104: the hero's own on-screen box got shorter again (100dvh
   minus the fixed nav's reserved 120px minus the metric bar's own
   height, see index.html) — a more letterboxed aspect than 0.9 was
   ever tuned against, so it started cropping BOTH ends of the
   worst-case (vertical) axis at once: the dome at the top and the
   tanks at the bottom, per the client report. NOT fixed with a raw
   camera.position.z/y nudge — applyOverviewFraming below
   unconditionally recomputes and overwrites camera.position on every
   mount/resize/orientationchange (see frameBox + the vertical-drop
   block a few dozen lines down), so any one-off offset set elsewhere
   would just get discarded the moment that runs, same dead-end this
   file's history already ran into. margin=1.0 is frameBox's own
   documented "exact fit, zero crop" value — bumped straight to it
   rather than nudging by tenths again, since this aspect ratio is
   more extreme than anything margin=0.9 was ever confirmed against.
   Was 1.25 (Phase 83) -> 1.1 (P84) -> 0.9 (P85) -> 0.7 (P100, cropped)
   -> 0.9 (P101, restored) -> 1.0 (P104, restored again for the new,
   shorter hero box). */
const OVERVIEW_MARGIN = 1.0;
/* Portrait phones fit to height only (verticalOnly, see frameBox's own
   comment) — kept above 1.0 unlike the desktop margin above: a narrow
   phone screen has much less horizontal room to spare, so cropping here
   loses actual content (structures), not just empty-space margin. */
const OVERVIEW_MARGIN_PORTRAIT = 1.05;
/* Fraction of the box's own height to drop the camera position AND
   target by, together (see the vertical-drop block in Rig's framing
   effect for why position+target move together, not target alone).
   Biases the frame toward showing more of the BOTTOM of the facility
   (where feed_pool sits) at the cost of extra empty space at the top,
   instead of splitting headroom evenly around the raw geometric
   center — which is what kept leaving the lowest structure hugging the
   bottom edge across two earlier attempts. */
const OVERVIEW_VERTICAL_BIAS = 0.35;
/* Phase 102: restored (this comment used to say "no horizontal offset
   needed" from back when hero-copy sat vertically above the model
   instead of beside it — stale since Phase 95, definitely wrong now
   that #iona-digital-twin-root is a full-bleed absolute layer again
   with hero-copy floating over its left ~45%). Negative
   rightFraction shifts the rig LEFT, which per applyLateralOffset's
   own doc comment makes the framed object appear shifted RIGHT — the
   idle-state mirror of FOCUS_OFFSET_FRACTION below, which does the
   opposite (positive, object appears left) to clear the detail panel
   once a structure is selected. Magnitude kept smaller than
   FOCUS_OFFSET_FRACTION: idle only has to clear a ~45%-wide text
   column, not also make room for a floating detail card. */
const OVERVIEW_OFFSET_FRACTION = -0.32;
const FOCUS_DIR = new THREE.Vector3(0.65, 0.42, 0.75).normalize();
const FOCUS_MARGIN = 1.3;
/* Phase 88: max extra Y rotation (radians) applied to the whole plant
   group as a function of page scroll — see the scroll-tilt useFrame in
   Rig. ~14deg total swing, "slightly" per spec: enough to read as a
   living inspection-turntable effect, not enough to fight the fixed
   OVERVIEW_DIR framing or make selected-structure hit-testing feel off. */
const SCROLL_TILT_RANGE = 0.25;
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
  },
  /* Phase 74: not one of the "5 real major structures" the comment above
     this object describes — this is a nested sub-object of 'digester'
     (see DIGESTER_MIXER_MESH_NAMES/plantStructureOverrides.js), made
     independently selectable once the digester itself is already
     selected (see Model's handleClick, which only resolves a raycast
     hit to 'biogas_mixer' while `selected?.name === 'digester'`; outside
     that, a click on it still just re-selects the whole digester like
     any other digester surface). No subComponents (there's nothing to
     drill into further) — `specs` renders as the same bullet list
     DetailPanel's Level 2 already uses for a sub-component, just at
     Level 1 here since there's only one "sub" this structure has.
     `returnTo` drives DetailPanel's back-to-parent button instead of
     the normal drill-down back button, since going "back" from a
     structure with no sub-components means returning to the digester
     that contains it, not to a Level 1 view of itself. */
  biogas_mixer: {
    title: 'Ağır Hizmet Dalgıç Karıştırıcı & Homojenizatör',
    description: 'Yüksek Verimli Hidrodinamik Biyogaz Mikseri',
    photo: '/images/equipment/digester-mixer.jpg',
    specs: [
      '⚙️ Motor Gücü: 15 - 22 kW (IE4 Süper Premium Verim)',
      '🌪️ Pervane Tipi: Özel Açılı Çift/Üç Kanatlı Helisel Bıçak (Kırmızı Koruma Kaplamalı)',
      '🛡️ Malzeme Dayanımı: AISI 304 / 316 Paslanmaz Çelik, Agresif pH ve H2S Koruması',
      '🎯 Fonksiyon: Yüzey kabuklaşmasını önleme, taban çökeltisi giderme ve homojen sıcaklık dağılımı.'
    ],
    subComponents: [],
    returnTo: 'digester'
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

/* Phase 74: same idea as findStructureNode above, but walks up looking
   for a 'biogas_mixer' group specifically, stopping as soon as it
   reaches a direct child of plantRoot (a top-level structure) without
   finding one — a click on, say, engine_room correctly returns null
   here rather than walking past it. Used instead of findStructureNode
   when resolving a click/hover that should be able to hit a mixer
   nested one level inside the digester, not just the digester itself. */
function findMixerNode(node, plantRoot) {
  while (node && node.parent !== plantRoot) {
    if (node.name === 'biogas_mixer') return node;
    node = node.parent;
  }
  return null;
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

/* Phase 54 "Proses Akışı" toggle: a GPU-only dashed/pulsing emissive
   band traveling along a pipe run, independent of hover. Same
   onBeforeCompile mechanism and shader chunks as attachHoverWormShader
   above (kept as a separate function, not merged into it, since flow
   state (uFlowActive) is driven by a page-level toggle while hover
   state is driven by pointer events — two independent triggers on two
   independent uniform sets is simpler than one function juggling both).
   No CPU particles: the entire animation is `fract()`/`smoothstep()` on
   the fragment's own local position plus a single uTime uniform, so the
   per-frame CPU cost is one float write per material regardless of how
   much pipe geometry is on screen. */
function attachFlowPulseShader(material, color) {
  const uniforms = {
    uFlowTime: { value: 0 },
    uFlowActive: { value: 0 },
    uFlowColor: { value: new THREE.Color(color) },
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFlowPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlowPos = transformed;');

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vFlowPos;
        uniform float uFlowTime;
        uniform float uFlowActive;
        uniform vec3 uFlowColor;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if ( uFlowActive > 0.0 ) {
          float flowAxis = ( vFlowPos.x + vFlowPos.y + vFlowPos.z ) * 0.85;
          float flowDash = fract( flowAxis - uFlowTime * 1.6 );
          float flowBand = smoothstep( 0.0, 0.06, flowDash ) * ( 1.0 - smoothstep( 0.3, 0.4, flowDash ) );
          float flowPulse = 0.7 + sin( uFlowTime * 2.4 ) * 0.3;
          totalEmissiveRadiance += uFlowColor * flowBand * flowPulse * uFlowActive * 2.4;
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
/* Phase 109: the bump-map ridge texture (createDigesterWallCorrugationTexture,
   DIGESTER_WALL_BUMP_SCALE) that used to pair with the albedo map below
   is gone — client asked for a perfectly smooth matte clay tank, no
   bump/normal noise, so wallMaterial no longer sets `bumpMap` at all.
   The albedo texture below stays (still gives the wall its painted
   ridge-color pattern, just no longer has raised-looking geometry). */

/* The albedo/color map for the digester wall — kept at the low-contrast
   pair from the last tuning pass (both tones a close light warm-grey)
   rather than the original high-contrast 205/120 version, which read
   as a harsh striped/barcode pattern instead of a real corrugated
   panel once the client's own CAD reference showed uniform, near-flat
   panel color with only soft ridge shading. */
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
/* Phase 105: the perimeter/stair rail kept visible by
   DIGESTER_WALKWAY_FENCE_MESH_NAMES's own 3-pass history above
   (walkway_rail/walkway_midrail/walkway_post, plus stair_handrail_1/2
   which was never part of that hide/show set at all) — real safety
   railing, distinct dark metal now instead of falling through to the
   structure's shared ceramic clay. */
const DIGESTER_RAILING_MESH_NAMES = new Set(['walkway_rail', 'walkway_midrail', 'walkway_post', 'stair_handrail_1', 'stair_handrail_2']);
/* The 4 new side-entry wall mixers (plantStructureOverrides.js) —
   deliberately distinct names from the GLB's own pre-existing
   mixer_shaft/mixer_motor/mixer_hub/mixer_blade (the dome-mounted top
   mixers under the `mixers`/`top_mixers` groups, a separate feature
   this doesn't touch). Routed around the whole per-structure material
   system entirely (see the scene.traverse() skip-check below) so they
   stay 100% opaque with their own fixed materials while the rest of
   the digester X-rays to 0.25 opacity on select. */
const DIGESTER_MIXER_MESH_NAMES = new Set([
  'side_mixer_collar', 'side_mixer_housing', 'side_mixer_shaft',
  'side_mixer_hub', 'side_mixer_blade', 'side_mixer_beacon'
]);
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
   digester has none of these names, so it's untouched by this set. Only
   scada_room still has these 4 real mesh names now — engine_room_shell
   and pump_room_shell were both fully replaced by
   plantStructureOverrides.js (containerized CHP unit / open-air pump
   canopy respectively), neither keeps its original wall_* meshes. */
const BUILDING_WALL_MESH_NAMES = new Set(['wall_front', 'wall_back', 'wall_right', 'wall_left']);

/* Pump station's open-air canopy support posts (plantStructureOverrides.js)
   — bare structural steel, distinct from BUILDING_PIPE_MESH_NAMES'
   fluid-carrying pipework even though the finish is similar. */
const BUILDING_STRUCTURAL_STEEL_MESH_NAMES = new Set(['canopy_post']);

/* Engine room's rebuilt ISO shipping container (plantStructureOverrides.js)
   — dark charcoal/steel, entirely its own material scoped to engine_room
   only (see the dedicated `if (structure.name === 'engine_room')` block
   below) so it never bleeds into scada_room's own prefab-office walls,
   which still use BUILDING_WALL_MESH_NAMES/sandwichPanelMaterial above
   unchanged. One shared name for every wall/rib/corner/roof/fan/stack/
   louver/door part — they're all the same material, no reason to
   register 8 different names for one look. */
/* Phase 53 (plantStructureOverrides.js) split the container's single
   'container_panel' name into 5 named zones so each could carry its
   own lighter/less-metallic material instead of the one dark charcoal
   finish that read as a pitch-black void — see rebuildEngineRoomContainer's
   own comment. Each name below gets its own dedicated material in the
   engine_room block below. */
const ENGINE_ROOM_WALL_MESH_NAMES = new Set(['container_wall']);
const ENGINE_ROOM_FRAME_MESH_NAMES = new Set(['container_frame']);
const ENGINE_ROOM_STACK_MESH_NAMES = new Set(['container_stack']);
const ENGINE_ROOM_FAN_MESH_NAMES = new Set(['container_fan']);
/* Engine room's safety-yellow hazard stripe — the container's one
   non-charcoal part. */
const ENGINE_ROOM_HAZARD_MESH_NAMES = new Set(['container_hazard_stripe']);

/* Phase 54 "Proses Akışı" flow lines — real named segments read directly
   out of the GLB's own site_piping node hierarchy (not guessed), split
   into the 3 process lines the toggle animates. Support brackets
   (gas_pipe_support, heat_pipe_sleeper) and the separate heat loop
   (heat_main/heat_inlet/heat_return/...) are left off the flow effect
   on purpose — the toggle's job is to read as "raw feed -> digester",
   "biogas -> CHP", "power -> grid", not light up every pipe in the
   trench. */
const SITE_PIPING_FEED_MESH_NAMES = new Set([
  'feed_from_pool', 'pool_flange', 'feed_to_digester', 'digester_feed_flange',
]);
const SITE_PIPING_GAS_MESH_NAMES = new Set([
  'gas_main', 'gas_wall_flange', 'gas_elbow', 'gas_header', 'gas_train',
  'gas_into_chp', 'gas_wall_flange_chp',
]);
const SITE_PIPING_POWER_MESH_NAMES = new Set([
  'cable_tray_main', 'cable_tray_post', 'cable_drop_chp', 'cable_to_pumps', 'scada_junction_box',
]);
/* Same green/amber/cyan the spec calls for. Feed reuses this file's own
   documented hover-glow green (HOVER_WORM_COLOR_A) instead of a 4th
   invented hex. */
const FLOW_FEED_COLOR = HOVER_WORM_COLOR_A;
const FLOW_GAS_COLOR = '#ffb020';
const FLOW_POWER_COLOR = '#4dd9e8';

/* Originally one shared texture/repeat across all 3 prefab buildings;
   now only scada_room actually uses BUILDING_WALL_MESH_NAMES/this
   texture at all — engine_room_shell and pump_room_shell were both
   deleted and rebuilt from scratch by plantStructureOverrides.js (see
   ENGINE_ROOM_CONTAINER_MESH_NAMES / BUILDING_STRUCTURAL_STEEL_MESH_NAMES
   above), neither keeps its original wall_* meshes. Left as-is rather
   than re-tuned for scada_room alone, since the module size still
   reads fine at that one building's own real wall height (~3.4m per
   its GLB bounding box). Thick dark seam band (bottom 15% of the tile) against a
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

/* memo'd: every prop the parent passes below (plantRootRef, onReady,
   onSelect, onReset) is a stable ref/useCallback identity except
   `selected`, so without this, Model re-runs its whole ~350-mesh JSX
   reconciliation on every unrelated parent state change too (groundY,
   hasInteracted, selectedSubIndex...) — none of which this component
   even reads. Plain shallow-prop memo, no custom
   comparator needed, since nothing here is passed as a fresh
   object/array literal each render. */
const Model = memo(function Model({ plantRootRef, onReady, onSelect, onReset, selected, flowActive }) {
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
  /* The 4 side-entry digester mixers' propeller hub groups + beacon-ring
     meshes (plantStructureOverrides.js) — ticked every frame below
     (propeller spin, beacon emissive pulse) alongside the hover-worm
     shader's own uTime update, not a separate effect/rAF loop. */
  const digesterMixersRef = useRef({ propellerHubs: [], beacons: [] });
  /* Phase 74: the digester's own tank_wall mesh instance(s) — needed so
     the X-ray effect below can also disable raycasting on them while
     the digester is selected/transparent. Geometrically, tank_wall is a
     closed shell that sits between the camera and the biogas_mixer
     groups mounted through it from every outside angle; three.js
     raycasting only cares about geometry, never material opacity, so
     without this a click meant for the now-visible mixer inside would
     still hit the (visually see-through) wall first and never reach it. */
  const tankWallMeshesRef = useRef([]);
  /* The 3 site_piping flow-pulse uniform sets (feed/gas/power) — ticked
     every frame (uFlowTime) alongside the mixer/hover uTime updates, and
     GSAP-tweened (uFlowActive, 0<->1) by the effect below whenever the
     `flowActive` toggle prop changes. */
  const flowUniformsRef = useRef([]);

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

    /* Motor Odasi -> containerized CHP unit (adds ribs/louvers/hazard
       stripe to engine_room), Pompa Odasi -> open-air covered pump
       station (swaps pump_room's enclosed shell for posts + a tilted
       canopy), digester -> 4 new side-entry mixers — see
       plantStructureOverrides.js's own header comment. Runs before the
       material-building pass and scene.traverse() below so every mesh
       it adds (except the mixers, deliberately — see
       DIGESTER_MIXER_MESH_NAMES) gets picked up by the exact same
       per-structure material/hover/click system as everything the GLB
       shipped with. */
    const { propellerHubs, beacons } = applyStructureOverrides(plantRoot);
    digesterMixersRef.current = { propellerHubs, beacons };

    const materials = new Map();
    const baseYs = new Map();
    const hoverUniforms = new Map();
    const namedMeshMaterials = new Map();
    /* Phase 74 — see tankWallMeshesRef's own comment. Local array +
       one wholesale assignment to the ref once traverse finishes,
       same pattern as materials/baseYs/etc. above (not pushed directly
       into the ref), so a re-run of this effect can't silently
       accumulate duplicate mesh references across runs. */
    const tankWallMeshes = [];
    /* The 3 flow-pulse uniform sets (feed/gas/power), ticked every frame
       and tweened on toggle by the outer component — see flowUniformsRef
       below and its own comment. */
    const flowUniforms = [];
    /* Phase 109: concreteNoiseTexture/createConcreteBaseNoiseTexture are
       gone — client asked for a perfectly smooth matte clay concrete/
       base look, no bump/roughness noise, so nothing below sets a
       bumpMap/roughnessMap anymore. */
    /* Shared the same way a texture would be — one texture, one
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
      /* Phase 105: "premium architectural clay/titanium mockup" palette
         — base material (everything not named-overridden below,
         effectively the concrete/tank/ground bucket) goes matte ceramic
         instead of the glazed-porcelain clearcoat look. Mixers are
         never touched by any of Phase 105's retuning: they route around
         this whole per-structure system entirely (see
         DIGESTER_MIXER_MESH_NAMES's skip-check in the traverse below)
         and keep their own fixed materials from plantStructureOverrides.js. */
      const material = new THREE.MeshPhysicalMaterial({
        color: '#f8fafc',
        roughness: 1.0,
        metalness: 0.0,
        clearcoat: 0,
        clearcoatRoughness: 0,
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
          color: '#f8fafc',
          metalness: 0.0,
          roughness: 1.0,
          map: createDigesterWallAlbedoTexture(),
          /* Explicit, not just relying on THREE's own defaults (which
             already match this at rest) — the X-ray effect below only
             ever toggles .transparent/.opacity on select, never these,
             so depth writing/testing stay correctly "on" the rest of
             the time regardless: solid opaque wall fully occludes the
             mixers inside it from every angle. */
          depthWrite: true,
          depthTest: true,
        });
        wallMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(wallMaterial));
        structureNamedMaterials.set(DIGESTER_WALL_MESH_NAME, wallMaterial);

        /* Phase 81: brushed satin aluminium instead of the earlier
           glossy painted-metal clearcoat look — bare metal with a
           directional (anisotropic) brush pattern rather than a smooth
           painted/coated cap, per the architectural-makeover spec's own
           roughness/metalness numbers. anisotropyRotation runs the
           brush lines circumferentially around the dome (matching a
           real rolled/brushed aluminium cap) rather than radially. No
           clearcoat: satin brushed metal, not a lacquered finish. */
        const domeMaterial = new THREE.MeshPhysicalMaterial({
          color: '#e2e8f0',
          metalness: 0.7,
          roughness: 0.4,
          clearcoat: 0.2,
          clearcoatRoughness: 0.15,
          anisotropy: 0.55,
          anisotropyRotation: Math.PI / 2,
          depthWrite: true,
          depthTest: true,
        });
        domeMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(domeMaterial));
        DIGESTER_DOME_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, domeMaterial));

        /* Bare steel pipework — feed/heating nozzles, flanges, the
           relief valve — distinct dark metal instead of the same
           ceramic as the dome/rails, matching the reference's visibly
           separate grey piping. */
        const pipeMaterial = new THREE.MeshStandardMaterial({
          color: '#64748b',
          metalness: 0.1,
          roughness: 0.8,
        });
        pipeMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(pipeMaterial));
        DIGESTER_PIPE_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, pipeMaterial));

        /* Phase 105: walkway_rail/walkway_midrail/walkway_post/
           stair_handrail_1/2 (DIGESTER_WALKWAY_FENCE_MESH_NAMES's kept
           counterpart — see that set's own 3-pass history comment) had
           no dedicated material before this, so they silently rendered
           as the same ceramic clay as the walkway deck around them. A
           real handrail is always bare/painted metal, visibly distinct
           from the deck it's bolted to — giving it the same dark-metal
           finish as the pipe fittings above is exactly what the
           "Pipes & Railings" bucket calls for. */
        const railingMaterial = new THREE.MeshStandardMaterial({
          color: '#64748b',
          metalness: 0.1,
          roughness: 0.8,
        });
        railingMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(railingMaterial));
        DIGESTER_RAILING_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, railingMaterial));

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
          color: '#f8fafc',
          metalness: 0,
          roughness: 1.0,
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
          color: '#94a3b8',
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
          color: '#64748b',
          metalness: 0.1,
          roughness: 0.8,
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
          color: '#64748b',
          metalness: 0.1,
          roughness: 0.8,
        });
        buildingPipeMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(buildingPipeMaterial));
        BUILDING_PIPE_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, buildingPipeMaterial));

        /* Bare structural steel — the pump station's open-air canopy
           posts (plantStructureOverrides.js). Same finish as
           buildingPipeMaterial above but its own instance/name, since
           these are load-bearing structure, not fluid-carrying pipe. */
        const structuralSteelMaterial = new THREE.MeshStandardMaterial({
          color: '#64748b',
          metalness: 0.1,
          roughness: 0.8,
        });
        structuralSteelMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(structuralSteelMaterial));
        BUILDING_STRUCTURAL_STEEL_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, structuralSteelMaterial));
      }

      if (structure.name === 'engine_room') {
        /* engine_room's rebuilt ISO container (plantStructureOverrides.js)
           — a dedicated block, not folded into the shared
           building-materials section above, specifically so these
           finishes never bleed into scada_room's own lighter prefab-office
           walls (both used to share BUILDING_WALL_MESH_NAMES/
           sandwichPanelMaterial before engine_room_shell was deleted and
           rebuilt from scratch). 4 distinct zones now (was a single dark
           charcoal 'container_panel' at metalness 0.45, which read as a
           near-featureless black block under this scene's lighting —
           lighter base colors / lower metalness throughout fixes that). */
        const wallMaterial = new THREE.MeshStandardMaterial({
          color: '#94a3b8',
          metalness: 0.2,
          roughness: 0.6,
        });
        wallMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(wallMaterial));
        ENGINE_ROOM_WALL_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, wallMaterial));

        /* Corner castings — medium/dark slate, deliberately a step
           darker than the wall so they read as distinct geometric
           definition instead of blending into the panels. */
        const frameMaterial = new THREE.MeshStandardMaterial({
          color: '#54585c',
          metalness: 0.35,
          roughness: 0.45,
        });
        frameMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(frameMaterial));
        ENGINE_ROOM_FRAME_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, frameMaterial));

        /* Exhaust stack — clean galvanized/stainless steel, brighter and
           more reflective than the wall panels. */
        const stackMaterial = new THREE.MeshStandardMaterial({
          color: '#c7cbce',
          metalness: 0.6,
          roughness: 0.3,
        });
        stackMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(stackMaterial));
        ENGINE_ROOM_STACK_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, stackMaterial));

        /* Roof fans + intake louvers — dark metallic mesh-grille look,
           the one zone that keeps a darker/more metallic finish since
           grilles read as recessed/shadowed on a real container. */
        const fanMaterial = new THREE.MeshStandardMaterial({
          color: '#3a3d40',
          metalness: 0.5,
          roughness: 0.4,
        });
        fanMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(fanMaterial));
        ENGINE_ROOM_FAN_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, fanMaterial));

        /* Safety-yellow hazard stripe — the container's one accent-color
           part. */
        const hazardMaterial = new THREE.MeshStandardMaterial({
          color: '#f4c430',
          metalness: 0.1,
          roughness: 0.6,
        });
        hazardMaterial.needsUpdate = true;
        uniformsList.push(attachHoverWormShader(hazardMaterial));
        ENGINE_ROOM_HAZARD_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, hazardMaterial));
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
          color: '#f8fafc',
          metalness: 0.0,
          roughness: 1.0,
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

      if (structure.name === 'site_piping') {
        /* Phase 54: each of the 3 flow-pulse materials still needs a
           normal bare-steel/cable-tray look at rest (uFlowActive starts
           at 0) — the flow shader only adds emissive on top, so getting
           the base PBR look right here matters independent of the
           toggle. No hover-worm shader on these (attachHoverWormShader):
           site_piping has no plantData entry, so it never receives
           pointer-over events in the first place — see handlePointerOver's
           own guard — attaching that shader here would be dead code. */
        const feedMaterial = new THREE.MeshStandardMaterial({
          color: '#64748b', metalness: 0.1, roughness: 0.8,
        });
        feedMaterial.needsUpdate = true;
        flowUniforms.push(attachFlowPulseShader(feedMaterial, FLOW_FEED_COLOR));
        SITE_PIPING_FEED_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, feedMaterial));

        const gasMaterial = new THREE.MeshStandardMaterial({
          color: '#64748b', metalness: 0.1, roughness: 0.8,
        });
        gasMaterial.needsUpdate = true;
        flowUniforms.push(attachFlowPulseShader(gasMaterial, FLOW_GAS_COLOR));
        SITE_PIPING_GAS_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, gasMaterial));

        const powerMaterial = new THREE.MeshStandardMaterial({
          color: '#64748b', metalness: 0.1, roughness: 0.8,
        });
        powerMaterial.needsUpdate = true;
        flowUniforms.push(attachFlowPulseShader(powerMaterial, FLOW_POWER_COLOR));
        SITE_PIPING_POWER_MESH_NAMES.forEach((name) => structureNamedMaterials.set(name, powerMaterial));
      }

      /* Every structure gets its own concrete-base material instance
         (texture shared, material not — see concreteNoiseTexture's own
         comment) registered under every real foundation mesh name; the
         traverse below only actually assigns it where that name exists
         as a descendant, so harmlessly registering all of
         FOUNDATION_MESH_NAMES here even though e.g. digester has no
         "slab" and pump_room has no "pool_pad" costs nothing. */
      const concreteMaterial = new THREE.MeshStandardMaterial({
        color: '#f8fafc',
        metalness: 0.0,
        roughness: 1.0,
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
    flowUniformsRef.current = flowUniforms;

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
      /* The 4 side-entry mixers (plantStructureOverrides.js) skip this
         whole per-structure material system on purpose: they already
         got their own fixed material set directly at creation time, and
         the X-ray effect below (materialsRef/namedMeshMaterialsRef) only
         ever dims materials it finds in those two maps — since these
         mixer meshes were never registered into either one, they simply
         never get touched by that dimming pass, which is exactly what
         "mixers stay 100% opaque while the tank goes see-through" needs.
         Skipped here too so this generic pass doesn't stomp their
         materials back to the digester's shared clay/tank_wall look. */
      if (structure.name === 'digester' && DIGESTER_MIXER_MESH_NAMES.has(baseName)) {
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
      /* Phase 74: see tankWallMeshesRef's own comment. */
      if (structure.name === 'digester' && baseName === DIGESTER_WALL_MESH_NAME) {
        tankWallMeshes.push(child);
      }
    });
    tankWallMeshesRef.current = tankWallMeshes;

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
  /* Phase 74: biogas_mixer is a NESTED selection one level inside
     digester (see findMixerNode), not a sibling structure of it — while
     a mixer is the active `selected`, the digester's own shell must
     stay X-rayed too, or tank_wall would snap back solid the instant a
     visitor clicks the mixer, right as the camera zooms in close on it
     (the view would then be looking out from inside now-opaque
     geometry). Every isActive comparison below runs against this
     effective name instead of selected.name directly for exactly that
     reason — everywhere else (any of the other 4 structures) it's a
     no-op, unchanged from before. */
  const effectiveSelectedName = selected?.name === 'biogas_mixer' ? 'digester' : selected?.name;

  useEffect(() => {
    materialsRef.current.forEach((material, name) => {
      const isActive = Boolean(selected) && name === effectiveSelectedName;
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
      const isActive = Boolean(selected) && structureName === effectiveSelectedName;
      structureNamedMaterials.forEach((material) => {
        material.transparent = isActive;
        material.opacity = isActive ? 0.25 : 1;
        material.needsUpdate = true;
      });
    });
    /* Phase 74: tank_wall stops absorbing raycasts while the digester is
       X-rayed, so a click meant for the now-visible biogas_mixer
       (mounted through the wall) actually reaches it instead of hitting
       the wall's own geometry first — see tankWallMeshesRef's comment.
       Restoring THREE.Mesh.prototype.raycast (not just deleting the
       override) is what makes the wall clickable/selectable again the
       instant the digester is deselected. */
    const digesterActive = effectiveSelectedName === 'digester';
    tankWallMeshesRef.current.forEach((mesh) => {
      mesh.raycast = digesterActive ? () => {} : THREE.Mesh.prototype.raycast;
    });
  }, [selected]);

  /* Only the 5 named structures in plantData (digester, engine room,
     pump room, SCADA room, feed pool) are real "major structures" —
     site_piping (the pipe network connecting them) has no plantData
     entry on purpose, so clicking a pipe resets the view instead of
     zooming into it, same as clicking empty background. */
  /* Phase 74: on top of the shared blade-glow boost (animateMixerHover),
     "slight glow" is what's actually feasible without a post-processing
     outline pass (a real silhouette/rim-light outline needs its own
     render pass this scene doesn't have and adding one is a much bigger
     change than this feature warrants) — the emissive boost alone reads
     as a clear hover cue on an already-glowing red part. */
  const animateMixerHover = useCallback((isHovering) => {
    const hub = digesterMixersRef.current.propellerHubs[0];
    const blade = hub?.children.find((c) => c.name === 'side_mixer_blade');
    const material = blade?.material;
    if (!material) return;
    /* 0.5 is the material's own resting emissiveIntensity (baked in at
       creation, see plantStructureOverrides.js) — reverting to 0 here
       instead would dim the blades below their normal at-rest glow. */
    gsap.to(material, {
      emissiveIntensity: isHovering ? 0.95 : 0.5,
      duration: HOVER_DURATION,
      ease: HOVER_EASE,
    });
  }, []);

  const handleClick = useCallback(
    (event) => {
      event.stopPropagation();
      const plantRoot = plantRootRef.current;
      if (!plantRoot) return;
      /* Mixers are only independently clickable once the digester
         they're mounted through is already selected/transparent —
         findMixerNode walks up from the raycast hit looking for a
         'biogas_mixer' ancestor, stopping before it ever reaches a
         top-level structure (see the function's own comment). */
      if (selected?.name === 'digester') {
        const mixer = findMixerNode(event.object, plantRoot);
        if (mixer) {
          onSelect(mixer);
          return;
        }
      }
      const node = findStructureNode(event.object, plantRoot);
      if (node && Object.prototype.hasOwnProperty.call(plantData, node.name)) {
        onSelect(node);
      } else {
        onReset();
      }
    },
    [plantRootRef, onSelect, onReset, selected]
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
      if (selected?.name === 'digester') {
        const mixer = findMixerNode(event.object, plantRoot);
        if (mixer) {
          if (hoveredNameRef.current !== 'biogas_mixer') {
            hoveredNameRef.current = 'biogas_mixer';
            document.body.style.cursor = 'pointer';
            animateMixerHover(true);
          }
          return;
        }
      }
      const node = findStructureNode(event.object, plantRoot);
      if (!node || !Object.prototype.hasOwnProperty.call(plantData, node.name)) return;
      if (hoveredNameRef.current === node.name) return;
      hoveredNameRef.current = node.name;
      document.body.style.cursor = 'pointer';
      animateHover(node, true);
    },
    [plantRootRef, animateHover, animateMixerHover, selected]
  );

  const handlePointerOut = useCallback(
    (event) => {
      event.stopPropagation();
      const plantRoot = plantRootRef.current;
      if (!plantRoot) return;
      if (hoveredNameRef.current === 'biogas_mixer') {
        const stillOnMixer = selected?.name === 'digester' && findMixerNode(event.object, plantRoot);
        if (stillOnMixer) return;
        hoveredNameRef.current = null;
        document.body.style.cursor = 'auto';
        animateMixerHover(false);
        return;
      }
      const node = findStructureNode(event.object, plantRoot);
      if (!node || !Object.prototype.hasOwnProperty.call(plantData, node.name)) return;
      hoveredNameRef.current = null;
      document.body.style.cursor = 'auto';
      animateHover(node, false);
    },
    [plantRootRef, animateHover, animateMixerHover, selected]
  );

  /* Drives the flowing-worm shader's motion — cheap (5 float writes/
     frame) even though it runs regardless of hover state, since the
     shader itself gates all visible cost behind `uHoverActive > 0.0`.
     Also spins the 4 side-entry mixer propellers and pulses their
     beacon rings — reduceMotion (imported at module scope, see
     scene-utils.js's own export) skips both: a still propeller instead
     of a slowly rotating one for a "prefers-reduced-motion" visitor,
     same rule the digester's rotSpeed/rotSpeed-style flags follow
     elsewhere on the site. */
  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;
    hoverUniformsRef.current.forEach((uniformsList) => {
      uniformsList.forEach((uniforms) => {
        uniforms.uTime.value = elapsed;
      });
    });
    if (!reduceMotion) {
      digesterMixersRef.current.propellerHubs.forEach((hub) => {
        hub.rotation.z += delta * 1.4;
      });
    }
    digesterMixersRef.current.beacons.forEach((beacon, i) => {
      beacon.material.emissiveIntensity = 0.6 + Math.sin(elapsed * 1.8 + i * 0.7) * 0.35;
    });
    if (!reduceMotion) {
      flowUniformsRef.current.forEach((uniforms) => {
        uniforms.uFlowTime.value = elapsed;
      });
    }
  });

  /* Toggle-driven, not tied to `selected` — the flow effect and the
     structure X-ray/focus system are two independent things a visitor
     can combine (e.g. focus the digester while flow is running). Snaps
     instantly under reduceMotion instead of tweening, same rule
     CAMERA_DURATION/HOVER_DURATION already follow. */
  useEffect(() => {
    flowUniformsRef.current.forEach((uniforms) => {
      gsap.to(uniforms.uFlowActive, {
        value: flowActive ? 1 : 0,
        duration: reduceMotion ? 0.01 : 0.6,
        ease: 'power2.out',
      });
    });
  }, [flowActive]);

  /* Phase 74: floating "⚡ Dalgıç Karıştırıcı" hint, world-anchored to
     the first mixer's beacon — only while the digester is selected and
     nothing more specific is (i.e. before the visitor has actually
     clicked a mixer; once they do, `selected` becomes the mixer itself,
     this condition goes false, and the hint disappears on its own,
     which is exactly the "you found it" signal it's for). Position is
     computed once per selection change, not every frame — the mixers
     don't translate, only their propellers spin in place. */
  const [mixerHintPos, setMixerHintPos] = useState(null);
  useEffect(() => {
    if (selected?.name !== 'digester') {
      setMixerHintPos(null);
      return;
    }
    const beacon = digesterMixersRef.current.beacons[0];
    if (!beacon) {
      setMixerHintPos(null);
      return;
    }
    setMixerHintPos(beacon.getWorldPosition(new THREE.Vector3()));
  }, [selected]);

  return (
    <>
      <primitive
        object={scene}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      />
      {mixerHintPos && (
        <Html position={mixerHintPos} center distanceFactor={8}>
          <div className="pointer-events-none select-none whitespace-nowrap rounded-full border border-[#78dc77]/50 bg-black/70 backdrop-blur-md px-3 py-1.5 text-[11px] font-bold text-white shadow-[0_0_16px_rgba(120,220,119,0.5)] animate-pulse">
            ⚡ Dalgıç Karıştırıcı
          </div>
        </Html>
      )}
    </>
  );
});

/* Owns the camera/controls tweening + shadow-frustum fitting once the
   model's real bounding box is known, and the click -> focus / miss ->
   reset transitions. Kept inside <Canvas> since it needs useThree/
   useFrame. memo'd for the same reason as Model above — every prop
   here is a ref/state value it genuinely reacts to, but the parent
   also re-renders for state this component doesn't touch at all
   (hasInteracted, selectedSubIndex). */
const Rig = memo(function Rig({ plantRootRef, selected, groundY, groundScale, shadowFar, keyLightRef }) {
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

      /* Phase 102: shift the idle framing right (same gate as FOCUS_OFFSET_
         FRACTION's own sm-breakpoint check below — hero-copy drops to a
         full-width overlay under lg, so there's no side column left to
         dodge there). */
      const lateral = isPortrait
        ? framed
        : applyLateralOffset(framed.position, framed.center, camera, OVERVIEW_OFFSET_FRACTION);

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
      const position = lateral.position.clone();
      position.y -= verticalDrop;
      const center = lateral.center.clone();
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
    /* shadowMap.autoUpdate is permanently off (see the mount effect
       below) and rebaked on our own throttle instead, so there's
       nothing left to freeze/restore around this tween — just force
       one fresh bake on arrival in case anything shadow-affecting
       queued up mid-flight. */
    const tl = gsap.timeline({
      onComplete: () => {
        gl.shadowMap.needsUpdate = true;
      }
    });
    tl.to(camera.position, { x: position.x, y: position.y, z: position.z, duration: CAMERA_DURATION, ease: CAMERA_EASE }, 0);
    tl.to(target, { x: center.x, y: center.y, z: center.z, duration: CAMERA_DURATION, ease: CAMERA_EASE }, 0);
    timelineRef.current = tl;

    return () => {
      tl.kill();
    };
  }, [selected, camera, gl]);

  useFrame(() => controlsRef.current?.update());

  /* Phase 88: "fluid inspection" scroll-tilt — reads window.scrollY
     directly each frame rather than plumbing scroll state down through
     props/context, since this is the only consumer. Purely additive to
     plantRootRef's own rotation (nothing else in this file ever touches
     it, confirmed — the camera is what's GSAP-scripted, the plant group
     itself has always just sat at its default rotation), and it's a
     read of native scroll position, never preventDefault/wheel-hijacked,
     so this can't turn into scroll-jacking. Lerped (not set directly) so
     fast scroll deltas don't pop the model instantly from one tilt to
     another. */
  const scrollTiltRef = useRef(0);
  useFrame(() => {
    const root = plantRootRef.current;
    if (!root || reduceMotion) return;
    const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
    const targetTilt = (progress - 0.5) * SCROLL_TILT_RANGE;
    scrollTiltRef.current += (targetTilt - scrollTiltRef.current) * 0.06;
    root.rotation.y = scrollTiltRef.current;
  });

  /* The ~350-mesh shadow map is the single most expensive pass in this
     scene. Phases 48-51 added continuously-spinning mixer propellers
     and pulsing beacons, so with three.js's default autoUpdate=true
     that full-scene depth pass was silently re-running every single
     frame, all the time — not just during the camera tween this file
     already special-cased. Baking it on its own ~12Hz clock instead of
     60Hz is imperceptible for shadows this soft/low-frequency but cuts
     the dominant per-frame cost by ~5x. */
  const shadowBakeAccumRef = useRef(0);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
  }, [gl]);
  useFrame((state, delta) => {
    shadowBakeAccumRef.current += delta;
    if (shadowBakeAccumRef.current >= SHADOW_BAKE_INTERVAL) {
      shadowBakeAccumRef.current = 0;
      gl.shadowMap.needsUpdate = true;
    }
  });

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
      {/* Phase 81 architectural floor: razor-thin, low-opacity CAD axis
         lines on the porcelain backdrop (#iona-digital-twin-root's own
         background, see base.css — the R3F canvas itself stays
         transparent) instead of the previous mid-grey engineering grid.
         Colors match the site's own slate-200/300 hairline family
         (Phase 80/83) rather than drei's defaults, so the floor reads as
         part of the same architectural-print system as the hero copy
         around it. Sits a hair below the contact-shadow plane (same
         groundY) to avoid z-fighting between the two coplanar meshes.
         Rotated flat the same way the old circular base mesh was (-90°
         on X — PlaneGeometry is vertical, XY-facing, by default).
         cellSize/sectionSize scaled up from drei's defaults (0.5/1) to
         suit this facility's real ~90x78 unit footprint — the defaults
         would read as visual noise at this scale. */}
      <Grid
        position={[0, groundY - 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        args={[groundScale, groundScale]}
        infiniteGrid
        fadeDistance={30}
        fadeStrength={1}
        cellSize={2}
        cellThickness={0.5}
        cellColor="#e2e8f0"
        sectionSize={10}
        sectionThickness={0.8}
        sectionColor="#cbd5e1"
      />
      {/* CAD crosshair coordinate mark at the plant origin — the same
         "pafta stamp" motif as the hero's corner coordinate/REF labels
         (index.html), just placed in-scene instead of as a DOM overlay. */}
      <group position={[0, groundY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <Line points={[[-3.2, 0, 0], [3.2, 0, 0]]} color="#cbd5e1" lineWidth={1} transparent opacity={0.7} />
        <Line points={[[0, -3.2, 0], [0, 3.2, 0]]} color="#cbd5e1" lineWidth={1} transparent opacity={0.7} />
        <Line
          points={Array.from({ length: 33 }, (_, i) => {
            const a = (i / 32) * Math.PI * 2;
            return [Math.cos(a) * 1.4, Math.sin(a) * 1.4, 0];
          })}
          color="#cbd5e1"
          lineWidth={1}
          transparent
          opacity={0.7}
        />
      </group>
    </>
  );
});

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
function DetailPanel({ structureKey, subIndex, onSelectSub, onBack, onClose, onReturnToParent }) {
  const structure = plantData[structureKey];
  if (!structure) return null;
  const sub = subIndex != null ? structure.subComponents[subIndex] : null;

  /* Phase 99: `fixed` (viewport-relative) was following the page down as
     the visitor scrolled past the hero — wrong once the hero has its own
     confined 3D column again (Phase 98 reverted the full-bleed layer).
     `absolute` instead, anchored to #iona-digital-twin-root itself (this
     component's mount target and nearest `position: relative` ancestor,
     see index.html's Phase 98 comment) — the panel now scrolls away with
     the hero section like any other in-flow content, instead of
     trailing the viewport. No overflow-hidden on that ancestor (see the
     same index.html comment), so this isn't at risk of the clipping an
     earlier `absolute` attempt hit before `fixed` was introduced. */
  return (
    <div className="absolute z-50 top-1/4 right-8 left-4 lg:left-auto lg:w-[400px] max-h-[70vh] overflow-y-auto rounded-3xl border border-white/40 bg-white/75 backdrop-blur-2xl shadow-2xl p-8 text-gray-900 flex flex-col gap-6 cursor-auto pointer-events-auto">
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
          {/* Phase 74: structures with no drill-down (currently just
             biogas_mixer — see plantData's own comment) show their specs
             directly at this level instead of via a sub-component button,
             reusing the exact same bullet-list treatment Level 2 already
             renders for sub.specs. */}
          {structure.specs && structure.specs.length > 0 && (
            <ul className="flex flex-col gap-2.5 rounded-2xl border border-black/10 bg-black/[0.02] p-5">
              {structure.specs.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm leading-snug text-gray-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
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
          {structure.returnTo && onReturnToParent && (
            <button
              type="button"
              onClick={() => onReturnToParent(structure.returnTo)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-emerald-600/30 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 font-label-caps text-label-caps py-3 transition-colors duration-200"
            >
              <span aria-hidden="true">↩️</span> Reaktör Görünümüne Dön
            </button>
          )}
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
  /* First-click discoverability pill (bottom-center hint) lives until the
     visitor proves they've found the interaction — then gone for the
     rest of the session. Deliberately not persisted (no localStorage)
     since a full reload is a fresh visit. Phase 83 removed the sonar
     rings this used to also gate (see SonarRings.jsx, now unused — the
     "floating circular halo/neon rings" flagged for removal). */
  const [hasInteracted, setHasInteracted] = useState(false);
  /* "Proses Akışı (Canlı)" toggle — off by default (spec), and forced
     off + hidden below the 768px breakpoint (mobile GPUs/thermal budget
     don't need a second always-on shader effect layered on top of the
     ~350-mesh scene). Tracks viewport width live, not just at mount, so
     rotating a tablet or resizing a window mid-session can't leave the
     toggle active on a now-narrow viewport with no way to see/reach it. */
  const [flowActive, setFlowActive] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768
  );
  useEffect(() => {
    function handleResize() {
      setIsMobileViewport(window.innerWidth < 768);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  useEffect(() => {
    if (isMobileViewport) setFlowActive(false);
  }, [isMobileViewport]);

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
  /* Phase 74: DetailPanel's "↩️ Reaktör Görünümüne Dön" button (only
     rendered for structures with a `returnTo`, currently just
     biogas_mixer) — looks the parent structure back up by name and
     re-selects it exactly like clicking it in the scene would, rather
     than a bespoke "go back to digester" path. */
  const handleReturnToParent = useCallback(
    (parentName) => {
      const parent = plantRootRef.current?.getObjectByName(parentName);
      if (parent) handleSelect(parent);
    },
    [handleSelect]
  );
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
      <Canvas
        className="relative z-10"
        shadows
        camera={{ fov: CAMERA_FOV, near: 0.1, far: 500 }}
        /* Hard-locked to 1, not a [min,max] range (was [1, 1.75]) — no
           variable pixel ratio on this canvas at all now, retina/high-DPI
           screens render at native CSS resolution instead of scaling up
           for sharpness. This scene already carries real-time shadow
           mapping (see keyLightRef's shadow-mapSize) on top of the
           ~350-mesh facility, the single heaviest per-fragment cost on
           the site — dropping this is worth more than the 1.75 clamp
           bought. */
        dpr={1}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: true }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        onPointerMissed={handleReset}
      >
        {/* Phase 84: no flat <color background> and an explicit zero-alpha
           clear color — #iona-digital-twin-root (base.css) is transparent
           too now, so the facility floats straight on the page's own
           background with no boxed-in seam. */}
        {/* Phase 105: "studio softbox" pass. The key light's shadow-camera
           frustum is dynamically fit to the model's real bounding box
           every frame (see keyLightRef + Rig's own shadow-frustum
           effect a few hundred lines down) — that's an orthographic
           directional-light feature with no SpotLight equivalent, so
           the key light stays a directionalLight rather than becoming
           one of the "multiple spotlights" the brief describes; turning
           it into a SpotLight would silently break that fit-to-box
           system instead of softening anything. shadow-radius softens
           the shadow's own edge (works on any shadow-casting light
           type, not spotlight-exclusive) and the two new soft
           spotlights below add the wraparound studio-fill look without
           touching the one light actually doing the real shadow pass. */}
        <ambientLight intensity={0.6} />
        {/* Phase 109/110: fills the buildings/roofs with soft, direction-
           independent sky/ground bounce so their edges still catch
           light instead of reading as flat silhouettes — the plain
           ambientLight above is uniform in every direction, this adds
           a top-vs-bottom gradient (sky tint from above, ground-bounce
           tint from below) the way real diffuse outdoor light actually
           falls on a surface. Bumped 1.0 -> 1.2 (Phase 110) alongside
           the lighter Space Grey palette (was too dark even at
           anthracite) so nothing reads as a flat black silhouette. */}
        <hemisphereLight args={[0xffffff, 0x444444, 1.2]} />
        {/* Phase 110: Environment adds real image-based reflections/soft
           global illumination on top of the explicit light rig above —
           the metallic/grey surfaces (dome, pipes, now-lighter walls)
           had nothing to reflect before this, which read as flat no
           matter how the direct lights were angled. environmentIntensity
           keeps it as a supplementary fill (0.8), not a replacement for
           the tuned key/fill/rim + hemisphere setup already here. */}
        <Environment preset="studio" environmentIntensity={0.8} />
        <directionalLight
          ref={keyLightRef}
          position={[30, 45, 20]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0005}
          shadow-radius={4}
        />
        <directionalLight position={[-25, 15, -20]} intensity={0.4} />
        {/* Phase 81: third light in the studio setup — a low, cool rim/
           back light tinted the same brand emerald as the hover-rim
           shader (HOVER_WORM_COLOR_A) for a subtle edge-bounce along
           structure silhouettes, instead of a flat key+fill render. No
           shadow casting: rim lights are about edge highlight, not
           occlusion, in a real studio setup either. */}
        <directionalLight position={[-10, 12, -35]} intensity={0.35} color="#3fae66" />
        {/* Phase 105: two soft fill spotlights, wide penumbra/low
           intensity so they read as ambient wraparound fill rather than
           a second set of hard shadows — no castShadow here on purpose,
           a real studio softbox's fill lights aren't what's casting the
           model's main shadow either. */}
        <spotLight position={[20, 30, -25]} angle={0.7} penumbra={1} intensity={0.5} distance={140} decay={1.5} />
        <spotLight position={[-30, 25, 25]} angle={0.7} penumbra={1} intensity={0.4} distance={140} decay={1.5} />

        <Model
          plantRootRef={plantRootRef}
          onReady={handleReady}
          onSelect={handleSelect}
          onReset={handleReset}
          selected={selected}
          flowActive={flowActive && !isMobileViewport}
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
      </Canvas>

      {selected && (
        <DetailPanel
          structureKey={selected.name}
          subIndex={selectedSubIndex}
          onSelectSub={handleSelectSub}
          onBack={handleBackToStructure}
          onClose={handleReset}
          onReturnToParent={handleReturnToParent}
        />
      )}

      {/* Phase 84: killed the floating "Proses Akışı (Canlı)" toggle pill —
         flagged as clutter on the hero. flowActive stays wired up (default
         false, forced off on mobile) so Model's flow-line shader prop is
         still valid, it's just no longer user-toggleable from here. */}

      {/* First-click discoverability hint — bottom-center so it never
         competes with the hero title (now pinned near the top, see
         #hero in base.css) or the offset-zoomed model. Gone the instant
         hasInteracted flips true. */}
      {/* Phase 85: was a solid pill (border/bg/shadow/backdrop-blur) —
         swapped for a bare floating label + pulsing dot so it reads as
         an architectural cue, not a UI chrome element sitting on the
         model. */}
      {!hasInteracted && (
        <div className="pointer-events-none absolute inset-x-0 bottom-10 z-20 flex justify-center">
          <span className="text-[10px] tracking-[0.2em] text-slate-400 font-mono uppercase flex items-center justify-center gap-2 mt-4">
            <span className="w-1.5 h-1.5 bg-[#2D9937] rounded-full animate-pulse" aria-hidden="true" />
            Tesisi Keşfetmek İçin Yapıları Seçin
          </span>
        </div>
      )}
    </div>
  );
}
