/**
 * ========================================================
 * EDITOR DE GPX PARA REGATAS · MULTI-BARCO (app.js)
 * Con estela (tail) sincronizada al milímetro con cada flecha
 * ========================================================
 */

// --- Base de Datos Local para Memoria (IndexedDB) ---
const DB_NAME = 'RegatasGpxDB';
const DB_VERSION = 1;
const STORE_NAME = 'regatta_session';

// --- Estado Global Multi-Barco ---
let loadedBoats = [];         // Lista de barcos: [ { id, name, fileName, color, points, startTime, endTime, ghostPolyline, trailPolyline, marker, gpxText } ]
let map = null;               // Instancia Leaflet (Fondo plano sin APIs)
let currentMapRotation = 0;   // Ángulo de rotación manual del mapa (0° a 359°)

let globalMinTime = null;     // Hora de inicio más temprana de la flota
let globalMaxTime = null;     // Hora de fin más tardía de la flota
let currentSimTime = null;    // Hora actual en la línea de tiempo

let startCutTime = null;      // Hora de inicio fijada (Date)
let endCutTime = null;        // Hora de final fijada (Date)
let selectionPolylines = [];  // Líneas verdes de previsualización del corte

let isPlaying = false;        // Estado de reproducción
let playInterval = null;      // Temporizador
let speedMultiplier = 15;     // 1x, 5x, 15x, 30x, 60x, 120x
let trailMode = 'all';        // 'all', 60, 300

let mangasSaved = [];         // Pruebas recortadas guardadas

// Colores vivos para distinguir los barcos en el fondo azul marino
const BOAT_COLORS = [
  '#ff6b4a', // Naranja fluorescente
  '#00d2d3', // Cian náutico
  '#10b981', // Verde esmeralda
  '#f59e0b', // Amarillo ámbar
  '#a855f7', // Púrpura brillante
  '#38bdf8', // Azul cielo
  '#ec4899', // Rosa neón
  '#84cc16'  // Lima
];

// ========================================================
// 1. INICIALIZACIÓN
// ========================================================
document.addEventListener('DOMContentLoaded', async () => {
  initFlatNauticalMap();
  setupEventListeners();

  // Restaurar automáticamente la sesión anterior
  await restoreSessionState();
});

function initFlatNauticalMap() {
  map = L.map('map', {
    center: [39.52, 2.60],
    zoom: 12,
    zoomControl: false,
    attributionControl: false
  });

  L.control.zoom({ position: 'topright' }).addTo(map);

  // Compensar el arrastre del ratón cuando el mapa esté rotado
  patchLeafletDragForRotation();
}

// ========================================================
// 2. CONFIGURACIÓN DE EVENTOS DE INTERFAZ
// ========================================================
function setupEventListeners() {
  const fileInput = document.getElementById('file-input');
  const btnDemo = document.getElementById('btn-demo');
  const btnClearAll = document.getElementById('btn-clear-all');
  const dropTarget = document.getElementById('drop-target');

  const btnPlayPause = document.getElementById('btn-play-pause');
  const timeSlider = document.getElementById('time-slider');
  const btnCenterFlota = document.getElementById('btn-center-flota');

  const btnSetStart = document.getElementById('btn-set-start');
  const btnSetEnd = document.getElementById('btn-set-end');
  const btnSaveManga = document.getElementById('btn-save-manga');

  // Selector de velocidad
  const speedPills = document.querySelectorAll('#speed-pill-group .pill-btn');
  speedPills.forEach(pill => {
    pill.addEventListener('click', () => {
      speedPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      speedMultiplier = parseInt(pill.dataset.speed, 10) || 15;
    });
  });

  // Selector de estela
  const trailPills = document.querySelectorAll('#trail-pill-group .pill-btn');
  trailPills.forEach(pill => {
    pill.addEventListener('click', () => {
      trailPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      trailMode = pill.dataset.trail;
      if (currentSimTime) {
        seekToSecondsOffset(parseInt(timeSlider.value, 10));
      }
    });
  });

  // Carga de múltiples archivos por botón
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      loadMultipleFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  });

  // Carga por arrastrar y soltar
  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      loadMultipleFiles(Array.from(e.dataTransfer.files));
    }
  };
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', handleDrop);
  dropTarget.addEventListener('click', () => fileInput.click());

  // Modo Demo: 3 barcos emparejados
  btnDemo.addEventListener('click', () => loadDemoFleet());

  // Empezar nueva sesión (borrar memoria guardada)
  btnClearAll.addEventListener('click', async () => {
    if (confirm("¿Estás seguro de que quieres borrar todos los barcos y mangas guardadas para empezar una nueva jornada de regatas?")) {
      await clearSavedDatabase();
      location.reload();
    }
  });

  // Slider de tiempo
  timeSlider.addEventListener('input', (e) => {
    pausePlayback();
    const secOffset = parseInt(e.target.value, 10);
    seekToSecondsOffset(secOffset);
  });

  // Play / Pausa
  btnPlayPause.addEventListener('click', togglePlayPause);

  // Centrar flota
  btnCenterFlota.addEventListener('click', centerFleetOnMap);

  // Fijar INICIO y FINAL
  btnSetStart.addEventListener('click', () => {
    if (!currentSimTime) return;
    startCutTime = new Date(currentSimTime);
    updateCutUI();
  });

  btnSetEnd.addEventListener('click', () => {
    if (!currentSimTime) return;
    endCutTime = new Date(currentSimTime);
    updateCutUI();
  });

  // Guardar manga para todos los barcos
  btnSaveManga.addEventListener('click', saveMangaForAllBoats);

  // Controles de orientación manual del mapa
  setupOrientationControls();
}

// ========================================================
// 2.1 ORIENTACIÓN MANUAL DEL MAPA Y PARCHE DE ARRASTRE
// ========================================================

function setupOrientationControls() {
  const orientSlider = document.getElementById('orient-slider');
  const btnRotLeft = document.getElementById('btn-rot-left');
  const btnRotRight = document.getElementById('btn-rot-right');
  const btnRotReset = document.getElementById('btn-rot-reset');

  if (orientSlider) {
    orientSlider.addEventListener('input', (e) => {
      setMapRotation(parseInt(e.target.value, 10));
    });
  }

  if (btnRotLeft) {
    btnRotLeft.addEventListener('click', () => {
      let next = (currentMapRotation - 15 + 360) % 360;
      setMapRotation(next);
    });
  }

  if (btnRotRight) {
    btnRotRight.addEventListener('click', () => {
      let next = (currentMapRotation + 15) % 360;
      setMapRotation(next);
    });
  }

  if (btnRotReset) {
    btnRotReset.addEventListener('click', () => {
      setMapRotation(0);
    });
  }
}

function setMapRotation(deg, saveToDb = true) {
  currentMapRotation = ((deg % 360) + 360) % 360;
  const rotator = document.getElementById('map-rotator');
  const badge = document.getElementById('orient-degrees');
  const slider = document.getElementById('orient-slider');

  if (rotator) {
    rotator.style.transform = `rotate(${currentMapRotation}deg)`;
  }
  if (badge) {
    badge.textContent = `${String(currentMapRotation).padStart(3, '0')}°`;
  }
  if (slider) {
    slider.value = currentMapRotation;
  }

  if (saveToDb) {
    dbSet('saved_map_rotation', currentMapRotation);
  }
}

/**
 * Ajusta matemáticamente el cálculo de arrastre del ratón para que,
 * cuando el mapa esté girado, el arrastre siga exactamente el movimiento de la mano.
 */
function patchLeafletDragForRotation() {
  if (L.Draggable && L.Draggable.prototype._onMove) {
    const originalOnMove = L.Draggable.prototype._onMove;
    L.Draggable.prototype._onMove = function (e) {
      if (currentMapRotation === 0 || !this._startPoint) {
        return originalOnMove.call(this, e);
      }
      var first = (e.touches && e.touches.length === 1 ? e.touches[0] : e);
      var offset = new L.Point(first.clientX, first.clientY)._subtract(this._startPoint);
      if (!offset.x && !offset.y) return;
      if (Math.abs(offset.x) + Math.abs(offset.y) < this.options.clickTolerance) return;

      if (!this._moved) {
        this.fire('dragstart');
        this._moved = true;
        this._startPos = L.DomUtil.getPosition(this._element);
        L.DomUtil.addClass(document.body, 'leaflet-dragging');
        this._lastTarget = e.target || e.srcElement;
        L.DomUtil.addClass(this._lastTarget, 'leaflet-drag-target');
      }

      var rad = -currentMapRotation * (Math.PI / 180);
      var rotX = offset.x * Math.cos(rad) - offset.y * Math.sin(rad);
      var rotY = offset.x * Math.sin(rad) + offset.y * Math.cos(rad);

      this._newPos = this._startPos.add(new L.Point(rotX, rotY));
      this._moving = true;
      L.Util.cancelAnimFrame(this._animRequest);
      this._lastEvent = e;
      this._animRequest = L.Util.requestAnimFrame(this._updatePosition, this, true);
    };
  }
}

// ========================================================
// 3. PERSISTENCIA EN MEMORIA LOCAL (INDEXEDDB)
// ========================================================

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function dbSet(key, value) {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    return new Promise(resolve => { tx.oncomplete = () => resolve(); });
  } catch (err) {}
}

async function dbGet(key) {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    return new Promise(resolve => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

async function clearSavedDatabase() {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    return new Promise(resolve => { tx.oncomplete = () => resolve(); });
  } catch (err) {}
}

async function persistCurrentState() {
  const boatsData = loadedBoats.map(b => ({
    name: b.name,
    fileName: b.fileName,
    color: b.color,
    gpxText: b.gpxText
  }));

  const mangasData = mangasSaved.map(m => ({
    id: m.id,
    name: m.name,
    startTimeMs: m.startTime.getTime(),
    endTimeMs: m.endTime.getTime(),
    durationMin: m.durationMin
  }));

  await dbSet('saved_boats', boatsData);
  await dbSet('saved_mangas', mangasData);
}

async function restoreSessionState() {
  const savedBoats = await dbGet('saved_boats');
  const savedMangas = await dbGet('saved_mangas');
  const savedRotation = await dbGet('saved_map_rotation');

  if (savedRotation !== null && savedRotation !== undefined) {
    setMapRotation(savedRotation, false);
  }

  if (savedBoats && savedBoats.length > 0) {
    savedBoats.forEach(b => {
      parseAndAddBoat(b.gpxText, b.fileName, false);
    });

    checkAndNormalizeTimezones();
    recalculateGlobalFleetTimes();
  }

  if (savedMangas && savedMangas.length > 0 && loadedBoats.length > 0) {
    savedMangas.forEach(mMeta => {
      const startMs = mMeta.startTimeMs;
      const endMs = mMeta.endTimeMs;
      const boatsCutData = [];

      loadedBoats.forEach(boat => {
        const cutPoints = boat.points.filter(p => p.time.getTime() >= startMs && p.time.getTime() <= endMs);
        if (cutPoints.length > 0) {
          boatsCutData.push({
            boatName: boat.name,
            fileName: boat.fileName,
            color: boat.color,
            points: cutPoints,
            startDist: cutPoints[0].distNM,
            endDist: cutPoints[cutPoints.length - 1].distNM,
            distNM: cutPoints[cutPoints.length - 1].distNM - cutPoints[0].distNM
          });
        }
      });

      if (boatsCutData.length > 0) {
        mangasSaved.push({
          id: mMeta.id,
          name: mMeta.name,
          startTime: new Date(startMs),
          endTime: new Date(endMs),
          durationMin: mMeta.durationMin,
          boats: boatsCutData
        });
      }
    });

    renderMangasList();
  }
}

// ========================================================
// 4. CARGA Y SINCRONIZACIÓN DE MÚLTIPLES ARCHIVOS GPX
// ========================================================

function loadMultipleFiles(files) {
  const gpxFiles = files.filter(f => f.name.toLowerCase().endsWith('.gpx'));
  if (gpxFiles.length === 0) {
    alert("⚠️ Por favor selecciona archivos con formato .gpx");
    return;
  }

  let loadedCount = 0;
  gpxFiles.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      parseAndAddBoat(e.target.result, file.name, true);
      loadedCount++;
      if (loadedCount === gpxFiles.length) {
        checkAndNormalizeTimezones();
        recalculateGlobalFleetTimes();
        persistCurrentState();
      }
    };
    reader.readAsText(file);
  });
}

function parseAndAddBoat(gpxText, fileName, shouldPersist = true) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(gpxText, "application/xml");
  const trkpts = xml.querySelectorAll('trkpt');

  if (!trkpts || trkpts.length === 0) return;

  const points = [];
  let cumDistanceNM = 0;

  for (let i = 0; i < trkpts.length; i++) {
    const pt = trkpts[i];
    const lat = parseFloat(pt.getAttribute('lat'));
    const lon = parseFloat(pt.getAttribute('lon'));

    const timeElem = pt.querySelector('time');
    let timeObj = null;
    if (timeElem && timeElem.textContent) {
      timeObj = new Date(timeElem.textContent.trim());
    } else {
      timeObj = new Date(Date.now() + i * 1000);
    }

    const eleElem = pt.querySelector('ele');
    const ele = eleElem ? parseFloat(eleElem.textContent) : 0;

    let speedKnots = 0;
    let heading = 0;

    if (i > 0) {
      const prev = points[i - 1];
      const distNM = calculateDistanceNM(prev.lat, prev.lon, lat, lon);
      cumDistanceNM += distNM;

      const secDiff = (timeObj.getTime() - prev.time.getTime()) / 1000;
      if (secDiff > 0) {
        speedKnots = distNM / (secDiff / 3600);
        if (speedKnots > 45) speedKnots = prev.speedKnots;
      }
      heading = calculateBearing(prev.lat, prev.lon, lat, lon);
    }

    points.push({
      lat,
      lon,
      ele,
      time: timeObj,
      distNM: cumDistanceNM,
      speedKnots,
      heading: Math.round(heading)
    });
  }

  const color = BOAT_COLORS[loadedBoats.length % BOAT_COLORS.length];
  const boatIndex = loadedBoats.length + 1;
  const boatName = `Barco ${boatIndex} (${fileName.replace(/\.gpx$/i, '')})`;

  const latLngs = points.map(p => [p.lat, p.lon]);

  // 1. Línea "Fantasma" sutil que muestra todo el recorrido previo del día
  const ghostPolyline = L.polyline(latLngs, {
    color: color,
    weight: 1.5,
    opacity: 0.18,
    smoothFactor: 0
  }).addTo(map);

  // 2. Línea viva "Estela / Tail" que termina EXACTAMENTE en la flecha del barco
  const trailPolyline = L.polyline([], {
    color: color,
    weight: 3.5,
    opacity: 0.95,
    smoothFactor: 0,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(map);

  // 3. Marcador del barco centrado al milímetro con iconAnchor: [12, 12]
  const boatIcon = L.divIcon({
    className: 'boat-marker-div',
    html: `
      <div id="boat-icon-${boatIndex}" style="
        width: 24px; 
        height: 24px; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        transform-origin: center center;
        filter: drop-shadow(0 0 6px ${color});
      ">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="${color}">
          <polygon points="12,2 22,21 12,17 2,21" />
        </svg>
      </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12] // Centro matemático exacto
  });

  const marker = L.marker([points[0].lat, points[0].lon], { icon: boatIcon }).addTo(map);

  const boatObj = {
    id: Date.now() + Math.random(),
    index: boatIndex,
    name: boatName,
    fileName: fileName,
    color: color,
    points: points,
    startTime: points[0].time,
    endTime: points[points.length - 1].time,
    ghostPolyline: ghostPolyline,
    trailPolyline: trailPolyline,
    marker: marker,
    currentSpeed: 0,
    gpxText: gpxText
  };

  loadedBoats.push(boatObj);
  renderBoatsList();

  if (shouldPersist) {
    persistCurrentState();
  }
}

function checkAndNormalizeTimezones() {
  if (loadedBoats.length < 2) return;

  const baseStart = loadedBoats[0].startTime.getTime();

  for (let i = 1; i < loadedBoats.length; i++) {
    const boat = loadedBoats[i];
    const diffHours = (boat.startTime.getTime() - baseStart) / 3600000;
    const roundedHours = Math.round(diffHours);

    if (Math.abs(diffHours - roundedHours) < 0.15 && Math.abs(roundedHours) >= 1 && Math.abs(roundedHours) <= 3) {
      const shiftMs = -roundedHours * 3600000;
      boat.points.forEach(p => {
        p.time = new Date(p.time.getTime() + shiftMs);
      });
      boat.startTime = boat.points[0].time;
      boat.endTime = boat.points[boat.points.length - 1].time;
    }
  }
}

function recalculateGlobalFleetTimes() {
  if (loadedBoats.length === 0) return;

  let minMs = Infinity;
  let maxMs = -Infinity;

  loadedBoats.forEach(b => {
    if (b.startTime.getTime() < minMs) minMs = b.startTime.getTime();
    if (b.endTime.getTime() > maxMs) maxMs = b.endTime.getTime();
  });

  globalMinTime = new Date(minMs);
  globalMaxTime = new Date(maxMs);

  const totalSec = Math.max(1, Math.round((maxMs - minMs) / 1000));

  document.getElementById('session-title').textContent = loadedBoats.length > 1 
    ? `Entrenamiento Flota (${loadedBoats.length} barcos)` 
    : loadedBoats[0].name;

  document.getElementById('session-info').textContent = 
    `${loadedBoats.length} barco(s) sincronizado(s) · ${formatDuration(totalSec)} de jornada · ${formatDateOnly(globalMinTime)}`;
  
  document.getElementById('badge-real-data').textContent = "SINCRONIZADO";

  const slider = document.getElementById('time-slider');
  slider.min = 0;
  slider.max = totalSec;
  slider.value = 0;

  document.getElementById('time-mark-start').textContent = formatTimeOnly(globalMinTime);
  document.getElementById('time-mark-end').textContent = formatTimeOnly(globalMaxTime);

  const mid1 = new Date(minMs + (totalSec * 0.25 * 1000));
  const mid2 = new Date(minMs + (totalSec * 0.75 * 1000));
  document.getElementById('time-mark-mid1').textContent = formatTimeShort(mid1);
  document.getElementById('time-mark-mid2').textContent = formatTimeShort(mid2);

  renderBoatsList();
  centerFleetOnMap();
  seekToSecondsOffset(0);
}

function centerFleetOnMap() {
  if (loadedBoats.length === 0) return;
  const group = L.featureGroup(loadedBoats.map(b => b.ghostPolyline));
  map.fitBounds(group.getBounds(), { padding: [40, 40] });
}

// ========================================================
// 5. LÍNEA DE TIEMPO · ESTELA Y FLECHAS SINCRONIZADAS AL MILÍMETRO
// ========================================================

function seekToSecondsOffset(secOffset) {
  if (!globalMinTime) return;

  const simMs = globalMinTime.getTime() + (secOffset * 1000);
  currentSimTime = new Date(simMs);

  const timeStr = formatTimeOnly(currentSimTime);
  document.getElementById('digital-clock').textContent = timeStr;
  document.getElementById('time-mark-current').textContent = timeStr;
  document.getElementById('time-slider').value = secOffset;

  let firstActiveHeading = null;

  loadedBoats.forEach((boat, idx) => {
    const res = findBoatPointAtExactTime(boat, simMs);
    const boatCardSpeed = document.getElementById(`boat-speed-${idx}`);

    if (res) {
      const pt = res.point;
      const ptIndex = res.index;

      // 1. Posicionar la flecha del barco
      boat.marker.setOpacity(1);
      boat.marker.setLatLng([pt.lat, pt.lon]);

      // 2. Rotar la flecha según el rumbo
      const iconInner = document.getElementById(`boat-icon-${boat.index}`);
      if (iconInner) {
        iconInner.style.transform = `rotate(${pt.heading}deg)`;
      }

      boat.currentSpeed = pt.speedKnots;
      if (boatCardSpeed) boatCardSpeed.textContent = `${pt.speedKnots.toFixed(1)} kn`;

      if (firstActiveHeading === null) firstActiveHeading = pt.heading;

      // 3. ACTUALIZAR ESTELA (TAIL): Termina EXACTAMENTE en la posición de la flecha
      updateBoatTailExact(boat, ptIndex, simMs);

    } else {
      boat.marker.setOpacity(0.2);
      if (boatCardSpeed) boatCardSpeed.textContent = `-- kn`;
      boat.trailPolyline.setLatLngs([]);
    }
  });

  // Fin de actualización de barcos
}

/**
 * Búsqueda binaria exacta: encuentra el punto temporal real más cercano sin saltos
 */
function findBoatPointAtExactTime(boat, targetMs) {
  const pts = boat.points;
  if (!pts || pts.length === 0) return null;

  const startMs = boat.startTime.getTime();
  const endMs = boat.endTime.getTime();

  if (targetMs < startMs || targetMs > endMs) return null;

  let low = 0;
  let high = pts.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midMs = pts[mid].time.getTime();

    if (midMs === targetMs) {
      return { point: pts[mid], index: mid };
    } else if (midMs < targetMs) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  let bestIdx = low;
  if (low >= pts.length) bestIdx = high;
  else if (high >= 0) {
    const diffLow = Math.abs(pts[low].time.getTime() - targetMs);
    const diffHigh = Math.abs(pts[high].time.getTime() - targetMs);
    bestIdx = diffLow < diffHigh ? low : high;
  }

  return { point: pts[bestIdx], index: bestIdx };
}

/**
 * Dibuja la estela viva del barco terminando EXACTAMENTE en la punta de la flecha
 */
function updateBoatTailExact(boat, currentIdx, currentMs) {
  if (!boat.trailPolyline) return;

  let startIdx = 0;

  if (trailMode === 'all') {
    // Toda la estela desde el inicio hasta el segundo actual
    startIdx = 0;
  } else {
    // Estela de los últimos X segundos (1 min o 5 min)
    const trailSec = parseInt(trailMode, 10);
    const startMs = currentMs - (trailSec * 1000);

    startIdx = currentIdx;
    while (startIdx > 0 && boat.points[startIdx].time.getTime() >= startMs) {
      startIdx--;
    }
  }

  // Extraer el tramo de coordenadas: el último punto coincide 100% con la flecha
  const trailCoords = boat.points.slice(startIdx, currentIdx + 1).map(p => [p.lat, p.lon]);
  boat.trailPolyline.setLatLngs(trailCoords);
}

function togglePlayPause() {
  if (isPlaying) {
    pausePlayback();
  } else {
    startPlayback();
  }
}

function startPlayback() {
  if (isPlaying || !globalMinTime) return;
  isPlaying = true;
  document.getElementById('play-icon').textContent = '⏸';

  const slider = document.getElementById('time-slider');

  playInterval = setInterval(() => {
    const currentVal = parseInt(slider.value, 10);
    const maxVal = parseInt(slider.max, 10);

    if (currentVal >= maxVal) {
      pausePlayback();
      return;
    }

    const advanceSec = Math.max(1, Math.round(speedMultiplier / 3));
    seekToSecondsOffset(currentVal + advanceSec);
  }, 50);
}

function pausePlayback() {
  isPlaying = false;
  document.getElementById('play-icon').textContent = '▶';
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
}

// ========================================================
// 6. RECORTE SIMULTÁNEO MULTI-BARCO
// ========================================================

function updateCutUI() {
  const startLabel = document.getElementById('label-start-time');
  const endLabel = document.getElementById('label-end-time');
  const btnSave = document.getElementById('btn-save-manga');
  const clockStatusDesc = document.getElementById('clock-status-desc');
  const cutSummaryBox = document.getElementById('cut-summary-box');
  const cutSummaryText = document.getElementById('cut-summary-text');

  selectionPolylines.forEach(pl => map.removeLayer(pl));
  selectionPolylines = [];

  if (startCutTime) {
    startLabel.textContent = formatTimeOnly(startCutTime);
    clockStatusDesc.textContent = `Inicio fijado: ${formatTimeOnly(startCutTime)}`;
  } else {
    startLabel.textContent = "--:--:--";
    clockStatusDesc.textContent = "Sin inicio marcado";
  }

  if (endCutTime) {
    endLabel.textContent = formatTimeOnly(endCutTime);
  } else {
    endLabel.textContent = "--:--:--";
  }

  if (startCutTime && endCutTime && startCutTime.getTime() < endCutTime.getTime()) {
    const startMs = startCutTime.getTime();
    const endMs = endCutTime.getTime();

    let matchingBoats = [];

    loadedBoats.forEach(boat => {
      const cutCoords = boat.points
        .filter(p => p.time.getTime() >= startMs && p.time.getTime() <= endMs)
        .map(p => [p.lat, p.lon]);

      if (cutCoords.length > 1) {
        matchingBoats.push(boat);
        const poly = L.polyline(cutCoords, {
          color: '#10b981', // Verde neón para el tramo marcado
          weight: 5.5,
          opacity: 0.95,
          smoothFactor: 0
        }).addTo(map);
        selectionPolylines.push(poly);
      }
    });

    if (matchingBoats.length > 0) {
      btnSave.disabled = false;
      cutSummaryBox.classList.add('ready');
      cutSummaryText.innerHTML = `🟢 <strong>${matchingBoats.length} de ${loadedBoats.length} barcos</strong> se recortarán a la vez en este tramo.`;
    } else {
      btnSave.disabled = true;
      cutSummaryBox.classList.remove('ready');
      cutSummaryText.innerHTML = `⚠️ Ningún barco coincide en este horario. Revisa los puntos de corte.`;
    }

  } else {
    btnSave.disabled = true;
    cutSummaryBox.classList.remove('ready');
    cutSummaryText.textContent = "Fija el inicio y final para ver los barcos incluidos";
  }
}

async function saveMangaForAllBoats() {
  if (!startCutTime || !endCutTime || startCutTime.getTime() >= endCutTime.getTime()) {
    alert("⚠️ Debes fijar un INICIO y un FINAL válidos.");
    return;
  }

  const startMs = startCutTime.getTime();
  const endMs = endCutTime.getTime();

  const nameInput = document.getElementById('manga-name');
  const mangaName = nameInput.value.trim() || `Manga ${mangasSaved.length + 1}`;

  const boatsCutData = [];

  loadedBoats.forEach(boat => {
    const cutPoints = boat.points.filter(p => p.time.getTime() >= startMs && p.time.getTime() <= endMs);
    if (cutPoints.length > 0) {
      boatsCutData.push({
        boatName: boat.name,
        fileName: boat.fileName,
        color: boat.color,
        points: cutPoints,
        startDist: cutPoints[0].distNM,
        endDist: cutPoints[cutPoints.length - 1].distNM,
        distNM: cutPoints[cutPoints.length - 1].distNM - cutPoints[0].distNM
      });
    }
  });

  if (boatsCutData.length === 0) {
    alert("⚠️ Ningún barco tiene datos registrados en el intervalo horario seleccionado.");
    return;
  }

  const durationMin = Math.round((endMs - startMs) / 60000);

  const mangaObj = {
    id: Date.now(),
    name: mangaName,
    startTime: new Date(startMs),
    endTime: new Date(endMs),
    durationMin: durationMin,
    boats: boatsCutData
  };

  mangasSaved.push(mangaObj);
  renderMangasList();

  await persistCurrentState();

  nameInput.value = `Manga ${mangasSaved.length + 1}`;
  startCutTime = null;
  endCutTime = null;
  updateCutUI();
}

// ========================================================
// 7. RENDERIZADO DE PANELES (BARCOS Y MANGAS)
// ========================================================

function renderBoatsList() {
  const container = document.getElementById('boats-list');
  const countBadge = document.getElementById('boats-count-badge');
  const noBoatsMsg = document.getElementById('no-boats-msg');

  countBadge.textContent = loadedBoats.length;

  if (loadedBoats.length === 0) {
    noBoatsMsg.style.display = 'block';
    container.innerHTML = '';
    return;
  }

  noBoatsMsg.style.display = 'none';
  container.innerHTML = '';

  loadedBoats.forEach((boat, index) => {
    const item = document.createElement('div');
    item.className = 'boat-card-item';
    item.style.borderLeftColor = boat.color;

    const totalDist = boat.points[boat.points.length - 1].distNM;

    item.innerHTML = `
      <div class="boat-info-left">
        <span class="boat-color-badge" style="background-color: ${boat.color}"></span>
        <div>
          <span class="boat-name-txt">${boat.name}</span>
          <span class="boat-sub-txt">⏱️ ${formatTimeOnly(boat.startTime)} - ${formatTimeOnly(boat.endTime)} · ${totalDist.toFixed(2)} NM</span>
        </div>
      </div>
      <div class="boat-stats-right">
        <span class="boat-speed-live" id="boat-speed-${index}">0.0 kn</span>
        <button class="btn-remove-boat" title="Quitar este barco" onclick="removeBoat(${boat.id})">✖</button>
      </div>
    `;

    container.appendChild(item);
  });
}

window.removeBoat = async function(boatId) {
  const idx = loadedBoats.findIndex(b => b.id === boatId);
  if (idx !== -1) {
    map.removeLayer(loadedBoats[idx].ghostPolyline);
    map.removeLayer(loadedBoats[idx].trailPolyline);
    map.removeLayer(loadedBoats[idx].marker);
    loadedBoats.splice(idx, 1);
    renderBoatsList();
    recalculateGlobalFleetTimes();
    await persistCurrentState();
  }
};

function renderMangasList() {
  const container = document.getElementById('mangas-list');
  const badge = document.getElementById('mangas-badge');
  const placeholder = document.getElementById('no-mangas-placeholder');

  badge.textContent = mangasSaved.length;

  if (mangasSaved.length === 0) {
    placeholder.style.display = 'block';
    container.innerHTML = '';
    return;
  }

  placeholder.style.display = 'none';
  container.innerHTML = '';

  mangasSaved.forEach(manga => {
    const card = document.createElement('div');
    card.className = 'manga-card-item';

    let boatButtonsHtml = '';
    manga.boats.forEach((b, bIdx) => {
      const cleanName = b.boatName.replace(/\.gpx$/i, '');
      boatButtonsHtml += `
        <button class="btn-boat-gpx" title="Descargar solo este archivo GPX" onclick="downloadSingleBoatManga(${manga.id}, ${bIdx})">
          <span style="color:${b.color}">●</span> 📥 ${cleanName}.gpx
        </button>
      `;
    });

    card.innerHTML = `
      <div class="manga-card-top">
        <span class="manga-card-title">🏆 ${manga.name}</span>
        <button class="btn-delete-manga" title="Eliminar prueba" onclick="deleteManga(${manga.id})">🗑️</button>
      </div>
      <div class="manga-card-stats">
        <span>⏱️ <strong>${formatTimeOnly(manga.startTime)}</strong> a <strong>${formatTimeOnly(manga.endTime)}</strong></span>
        <span>⌛ Duración: <strong>${manga.durationMin} min</strong></span>
      </div>
      <span class="manga-boats-badge">⛵ ${manga.boats.length} barcos recortados al mismo segundo</span>
      
      <div class="manga-actions-box">
        <button class="btn-download-all-manga" onclick="downloadMangaAsZip(${manga.id})">
          📁 Descargar Carpeta ZIP (${manga.boats.length} archivos GPX)
        </button>
        
        <div class="individual-downloads">
          <span style="font-size:0.7rem; color:#94a3b8; display:block; width:100%; margin-top:4px;">O descarga cada barco por separado:</span>
          ${boatButtonsHtml}
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

window.deleteManga = async function(id) {
  const idx = mangasSaved.findIndex(m => m.id === id);
  if (idx !== -1) {
    mangasSaved.splice(idx, 1);
    renderMangasList();
    await persistCurrentState();
  }
};

// ========================================================
// 8. DESCARGA EN CARPETA ZIP Y DESCARGAS INDIVIDUALES
// ========================================================

function buildGpxString(mangaName, boatData) {
  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Regatas GPX Splitter" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(mangaName)} - ${escapeXml(boatData.boatName)}</name>
    <time>${boatData.points[0].time.toISOString()}</time>
  </metadata>
  <trk>
    <name>${escapeXml(mangaName)} - ${escapeXml(boatData.boatName)}</name>
    <trkseg>
`;

  boatData.points.forEach(pt => {
    gpx += `      <trkpt lat="${pt.lat.toFixed(7)}" lon="${pt.lon.toFixed(7)}">
        <ele>${pt.ele.toFixed(1)}</ele>
        <time>${pt.time.toISOString()}</time>
      </trkpt>\n`;
  });

  gpx += `    </trkseg>
  </trk>
</gpx>`;

  return gpx;
}

window.downloadSingleBoatManga = function(mangaId, boatIndex) {
  const manga = mangasSaved.find(m => m.id === mangaId);
  if (!manga || !manga.boats[boatIndex]) return;

  const boatData = manga.boats[boatIndex];
  const gpxContent = buildGpxString(manga.name, boatData);

  const safeManga = manga.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const safeBoat = boatData.fileName.replace(/\.gpx$/i, '').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const filename = `${safeManga}_${safeBoat}.gpx`;

  saveBlobToDisk(new Blob([gpxContent], { type: 'application/gpx+xml;charset=utf-8' }), filename);
};

window.downloadMangaAsZip = function(mangaId) {
  const manga = mangasSaved.find(m => m.id === mangaId);
  if (!manga || manga.boats.length === 0) return;

  const safeManga = manga.name.replace(/[^a-zA-Z0-9_\-]/g, '_');

  const filesInZip = manga.boats.map(boatData => {
    const safeBoat = boatData.fileName.replace(/\.gpx$/i, '').replace(/[^a-zA-Z0-9_\-]/g, '_');
    return {
      name: `${safeManga}_${safeBoat}.gpx`,
      content: buildGpxString(manga.name, boatData)
    };
  });

  const zipBlob = createNativeZipBlob(filesInZip);
  saveBlobToDisk(zipBlob, `${safeManga}_Todos_los_Barcos.zip`);
};

function saveBlobToDisk(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    if (a.parentNode) a.parentNode.removeChild(a);
    URL.revokeObjectURL(url);
  }, 120000);
}

// ========================================================
// 9. GENERADOR DE ARCHIVOS ZIP NATIVO (100% Offline)
// ========================================================

function createNativeZipBlob(files) {
  const utf8Encoder = new TextEncoder();
  const fileRecords = [];
  let centralDirSize = 0;
  let offset = 0;

  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
  }

  function getCrc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  const parts = [];

  files.forEach(f => {
    const nameBytes = utf8Encoder.encode(f.name);
    const dataBytes = utf8Encoder.encode(f.content);
    const crc = getCrc32(dataBytes);
    const size = dataBytes.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(localHeader.buffer);

    view.setUint32(0, 0x04034B50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    parts.push(localHeader);
    parts.push(dataBytes);

    fileRecords.push({
      nameBytes,
      crc,
      size,
      offset
    });

    offset += localHeader.length + size;
  });

  const centralDirStartOffset = offset;

  fileRecords.forEach(rec => {
    const headerLen = 46 + rec.nameBytes.length;
    const centralHeader = new Uint8Array(headerLen);
    const view = new DataView(centralHeader.buffer);

    view.setUint32(0, 0x02014B50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint16(14, 0, true);
    view.setUint32(16, rec.crc, true);
    view.setUint32(20, rec.size, true);
    view.setUint32(24, rec.size, true);
    view.setUint16(28, rec.nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, rec.offset, true);
    centralHeader.set(rec.nameBytes, 46);

    parts.push(centralHeader);
    centralDirSize += headerLen;
  });

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054B50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, files.length, true);
  eocdView.setUint16(10, files.length, true);
  eocdView.setUint32(12, centralDirSize, true);
  eocdView.setUint32(16, centralDirStartOffset, true);
  eocdView.setUint16(20, 0, true);
  parts.push(eocd);

  return new Blob(parts, { type: 'application/zip' });
}

// ========================================================
// 10. MODO DEMO: 3 BARCOS EN REGATA EMPAREJADA (COMBATE REAL)
// ========================================================

async function loadDemoFleet() {
  loadedBoats.forEach(b => {
    map.removeLayer(b.ghostPolyline);
    map.removeLayer(b.trailPolyline);
    map.removeLayer(b.marker);
  });
  loadedBoats = [];

  const baseTime = new Date();
  baseTime.setHours(10, 30, 0, 0);

  // BARCO 1: ESP 2318 (Naranja)
  const pts1 = [];
  let lat1 = 39.530, lon1 = 2.620, t1 = new Date(baseTime);
  // Ceñida en bordos sincronizados
  for (let b = 0; b < 6; b++) {
    const sign = (b % 2 === 0) ? 1 : -1;
    for (let s = 0; s < 30; s++) {
      lat1 += 0.00018; lon1 += sign * 0.00018;
      t1 = new Date(t1.getTime() + 5000);
      pts1.push(createXmlTrkpt(lat1, lon1, t1));
    }
  }
  // Popa rápida
  for (let p = 0; p < 70; p++) {
    lat1 -= 0.00030; lon1 += (p % 10 < 5 ? 0.00005 : -0.00005);
    t1 = new Date(t1.getTime() + 4500);
    pts1.push(createXmlTrkpt(lat1, lon1, t1));
  }
  parseAndAddBoat(wrapInGpxXml("ESP_2318.gpx", pts1), "ESP_2318.gpx", false);

  // BARCO 2: ESP 1984 (Cian) - Navega muy cerca de Barco 1 (combate cerrado)
  const pts2 = [];
  let lat2 = 39.5301, lon2 = 2.6206, t2 = new Date(baseTime);
  for (let b = 0; b < 6; b++) {
    const sign = (b % 2 === 0) ? 1 : -1;
    for (let s = 0; s < 30; s++) {
      lat2 += 0.000178; lon2 += sign * 0.000175;
      t2 = new Date(t2.getTime() + 5000);
      pts2.push(createXmlTrkpt(lat2, lon2, t2));
    }
  }
  for (let p = 0; p < 70; p++) {
    lat2 -= 0.000295; lon2 += (p % 10 < 5 ? -0.00005 : 0.00005);
    t2 = new Date(t2.getTime() + 4500);
    pts2.push(createXmlTrkpt(lat2, lon2, t2));
  }
  parseAndAddBoat(wrapInGpxXml("ESP_1984.gpx", pts2), "ESP_1984.gpx", false);

  // BARCO 3: ESP 3102 (Verde) - A pocos metros por el otro bordo
  const pts3 = [];
  let lat3 = 39.5299, lon3 = 2.6194, t3 = new Date(baseTime);
  for (let b = 0; b < 6; b++) {
    const sign = (b % 2 === 0) ? 1 : -1;
    for (let s = 0; s < 30; s++) {
      lat3 += 0.000182; lon3 += sign * 0.000185;
      t3 = new Date(t3.getTime() + 5000);
      pts3.push(createXmlTrkpt(lat3, lon3, t3));
    }
  }
  for (let p = 0; p < 70; p++) {
    lat3 -= 0.000305; lon3 += (p % 10 < 5 ? 0.00004 : -0.00004);
    t3 = new Date(t3.getTime() + 4500);
    pts3.push(createXmlTrkpt(lat3, lon3, t3));
  }
  parseAndAddBoat(wrapInGpxXml("ESP_3102.gpx", pts3), "ESP_3102.gpx", false);

  recalculateGlobalFleetTimes();
  await persistCurrentState();
}

function wrapInGpxXml(name, points) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Regatas Simulator">
  <trk>
    <name>${name}</name>
    <trkseg>
      ${points.join('\n')}
    </trkseg>
  </trk>
</gpx>`;
}

function createXmlTrkpt(lat, lon, time) {
  return `<trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}"><ele>0.0</ele><time>${time.toISOString()}</time></trkpt>`;
}

// ========================================================
// 11. CÁLCULOS NÁUTICOS Y FORMATO
// ========================================================

function calculateDistanceNM(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c) / 1.852;
}

function calculateBearing(lat1, lon1, lat2, lon2) {
  const phi1 = lat1 * (Math.PI / 180);
  const phi2 = lat2 * (Math.PI / 180);
  const dLam = (lon2 - lon1) * (Math.PI / 180);
  const y = Math.sin(dLam) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLam);
  const theta = Math.atan2(y, x);
  return (theta * (180 / Math.PI) + 360) % 360;
}

function formatTimeOnly(d) {
  if (!d) return "--:--:--";
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function formatTimeShort(d) {
  if (!d) return "--:--";
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDateOnly(d) {
  if (!d) return "";
  const days = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}
