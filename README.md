# ⛵ Editor de GPX para Regatas (Regatta Track Splitter)

Una herramienta web sencilla y visual diseñada para regatistas, entrenadores y comités de regata. Permite cargar las grabaciones de GPS de toda una jornada náutica, recortar los tiempos muertos (traslados, pausas) y separar cada manga o prueba en un archivo GPX independiente listo para su análisis.

---

## 🎯 ¿Qué problema resuelve este programa?

Cuando sales a navegar o competir, el reloj o dispositivo GPS (Garmin, reloj multideporte, localizador, etc.) suele grabar de forma continua desde que sales del pantalán hasta que regresas a tierra:
- **Salida del puerto y navegación hacia el campo de regatas.**
- **Tiempos de espera y aplazamientos** entre salida y salida.
- **Las pruebas reales de competición** (Manga 1, Manga 2, Manga 3...).
- **Regreso a puerto.**

Al intentar analizar la jornada en programas especializados de regatas, todo ese "ruido" estorba o falsea las estadísticas de velocidad, viradas y táctica. 

**Este programa permite:**
1. Cargar tu archivo GPX completo arrastrándolo a la pantalla.
2. Ver sobre el mapa el recorrido del barco.
3. Desplazarte por una barra de tiempo para encontrar exactamente cuándo empezó y terminó cada prueba.
4. Marcar el punto de inicio y el punto final de cada manga.
5. Descargar cada prueba por separado con su nombre correcto (por ejemplo: `Manga_1.gpx`, `Manga_2.gpx`), limpias de tiempos muertos y listas para estudiar.

---

## 🚀 Características principales (en desarrollo)

- **Sin instalaciones complicadas:** Funciona directamente abriendo una página web en tu navegador favorito (Chrome, Edge, Firefox, Safari).
- **100% privado y seguro:** Tus archivos GPX nunca se suben a internet ni a ningún servidor externo. Todo se procesa directamente en tu ordenador.
- **Mapa interactivo:** Para ver por dónde navegó el barco con vista satélite o náutica.
- **Línea de tiempo intuitiva:** Con controles sencillos de reproducción, pausa y avance para localizar el bocinazo de salida y la entrada en meta.
- **Corte de tramos múltiples:** Puedes definir tantas pruebas como hayas disputado en el día sin tener que volver a cargar el archivo.
- **Exportación limpia:** Mantiene todos los datos GPS intactos (horas exactas, velocidades, coordenadas) para que no pierdas precisión.

---

## 📂 Estructura del proyecto

El proyecto está diseñado para ser ligero, rápido y fácil de usar:

```text
GPX GESTION PROGRAM/
│
├── index.html        # Página principal y visualizador (la abres con dos clics en tu navegador)
├── AGENT.md          # Guía de estilo y comunicación para el asistente inteligente
└── README.md         # Este documento informativo y registro de cambios
```

---

## 📝 Registro de cambios (Changelog)

Todos los avances y mejoras del programa se anotarán en esta sección para llevar un control claro y fácil de entender.

### [Versión 0.9.0] - 26/10/2026
- **Personalización para el RCNGC (Clase Optimist):**
  - Cambio del título superior por: **Equipo de Regatas RCNGC · Clase Optimist**.
  - Eliminado el cuadro flotante de *"Rumbo Flota"* sobre el mapa, dejando la pantalla mucho más despejada y limpia para ver los barcos y sus estelas.

### [Versión 0.8.0] - 26/10/2026
- **Sincronización milimétrica de flechas y estela (Tail):**
  - **Flecha exactamente en la cabeza de la estela:** La flecha de cada barco ahora se ubica en el centro exacto del punto GPS actual y la línea de estela viva termina de forma matemáticamente idéntica en la punta de la flecha, sin adelantarse en el tiempo.
  - **Trazado fantasma:** El recorrido completo previo se muestra en una línea fina y semitransparente, mientras que la estela viva y brillante (1 min, 5 min o recorrido actual) acompaña a cada barco en su avance.
  - **Regata emparejada en el modo Demo:** Los 3 barcos de prueba ahora navegan juntos en ceñida y popa en combate cerrado como en una regata real, con las flechas y estelas perfectamente coordinadas.

### [Versión 0.7.0] - 26/10/2026
- **Memoria persistente automática (a prueba de F5):**
  - El programa ahora guarda automáticamente en la memoria interna de tu navegador tanto los archivos GPX cargados como todas las pruebas y mangas que hayas recortado.
  - Si pulsas `F5`, recargas la página o cierras el navegador por error, al volver a entrar **todo sigue exactamente igual** (los barcos en el mapa y tus mangas listas para descargar).
  - Nuevo botón *"🗑️ Empezar nueva sesión"* en la cabecera superior para limpiar la memoria con un clic cuando comiences un día nuevo de regatas.

### [Versión 0.6.0] - 26/10/2026
- **Descarga en Carpeta ZIP y Corrección de Bloqueos:**
  - **Descarga en Carpeta ZIP:** Al recortar varios barcos, ahora aparece el botón *"📁 Descargar Carpeta ZIP"*, que descarga de un solo golpe un archivo `.zip` con todos los `.gpx` individuales de cada barco en su interior. Al abrirlo en Windows, es una carpeta lista para usar sin bloqueos ni advertencias del navegador.
  - **Descargas individuales continuas:** Corregido el fallo por el cual el navegador bloqueaba las siguientes descargas hasta recargar la página. Ahora se puede descargar cualquier barco individual cuantas veces se desee.
  - **Sincronización horaria inteligente:** Corrección automática de diferencias de zona horaria (UTC vs local) entre distintos dispositivos GPS.
  - **Indicador previo de corte:** Muestra en tiempo real cuántos de los barcos cargados entran dentro del tramo antes de pulsar *"Guardar"*.

### [Versión 0.5.0] - 26/10/2026
- **Fondo Náutico Plano (Cero APIs y Cero Dependencias Externas):**
  - Se eliminó cualquier llamada a servidores de mapas por internet (adiós a cualquier mensaje o marca de agua de *"API KEY REQUIRED"* o bloqueos 403).
  - Fondo plano en tono azul marino náutico (`#0b1a26`) con una cuadrícula táctica sutil que replica con exactitud el software náutico de telemetría de referencia.
  - El programa ahora funciona al 100% de forma local, rápida y sin depender de internet.

### [Versión 0.4.0] - 26/10/2026
- **Soporte Multi-Barco y Recorte Simultáneo:**
  - Capacidad para cargar múltiples archivos `.gpx` a la vez (toda la flota o varios tripulantes).
  - Sincronización automática de todos los barcos en una misma línea temporal común.
  - Al marcar la salida (🟢) y la meta (🔴), el programa recorta **todos los barcos al mismo segundo exacto**.
  - Botón para **descargar todos los archivos GPX recortados de golpe** (o cada barco por separado con su nombre).
- **Fondo oscuro táctico limpio:**
  - Eliminación completa de las capas de satélite y callejero; ahora queda exclusivamente el fondo marino oscuro sin botones sobrantes.
- **Máxima precisión del track en el mapa:**
  - Eliminado el redondeo y suavizado de curvas para mostrar cada virada, bordada y paso de boya con fidelidad GPS real punto por punto.
- **Simplificación de la interfaz:**
  - Eliminada la pestaña de rendimiento para centrar toda la pantalla en la gestión de barcos y el recorte rápido de mangas.

### [Versión 0.3.0] - 26/10/2026
- **Solución al error del mapa (Bloqueo 403 de OpenStreetMap):**
  - Se sustituyó el proveedor anterior por **CartoDB Dark Matter**, un mapa náutico oscuro de alta resolución que no bloquea conexiones locales y carga al instante sin fallos.
  - Se añadió la opción de cambiar con un clic a **vista satélite** de alta definición (ESRI).
- **Nuevo diseño visual estilo Telemetría de Regatas (Dark Dashboard):**
  - Interfaz oscura en gris pizarra y azul marino con acentos en naranja fluorescente y cian náutico (idéntica al estándar de software táctico de competición).
  - **Brújula y rumbo digital en tiempo real:** Muestra los grados exactos y gira la aguja según el avance del barco.
  - **Línea de tiempo avanzada:** Botón circular naranja de reproducción, selector de velocidad múltiple (1x, 5x, 15x, 30x, 60x, 120x) y selector de longitud de estela (1 min, 5 min o Toda la jornada).
  - **Telemetría y gráfica:** Velocidad en nudos, rumbo, distancia navegada en millas náuticas, conteo estimado de viradas y gráfica de evolución de velocidad.
  - **Zona de arrastre inferior:** Área dedicada para soltar los archivos GPX directamente.
- **Herramienta de recorte de mangas:**
  - Sistema de fijación rápida de Salida (🟢) y Llegada (🔴) con vista previa iluminada en verde neón sobre el mapa y descarga de cada prueba en un archivo `.gpx` limpio.

### [Versión 0.2.0] - 26/10/2026
- **Primera versión interactiva del programa (`index.html`, `style.css`, `app.js`):**
  - **Visualizador cartográfico:** Integración de mapa interactivo con vista estándar callejera/marina, vista satélite de alta resolución y balizas náuticas de OpenSeaMap.
  - **Línea de tiempo interactiva:** Barra inferior para avanzar segundo a segundo por la jornada, con botón de reproducción animada (1x, 5x, 15x, 60x), retroceso y avance rápido.
  - **Cuadro de datos en vivo (HUD):** Muestra la hora exacta, velocidad del barco calculada en Nudos (`kn`) y distancia acumulada en Millas Náuticas (`NM`).
  - **Recortador de mangas:** Marcadores visuales de salida (verde 🟢) y llegada (roja 🔴) sobre el mapa y en la barra de tiempo.
  - **Gestor de pruebas:** Posibilidad de guardar múltiples pruebas con nombres personalizados (ej. Manga 1, Manga 2), calculando su duración y distancia.
  - **Exportación GPX limpia:** Descarga directa de cada manga en un archivo `.gpx` independiente conservando coordenadas y marcas de tiempo originales.
  - **Modo Demostración:** Botón para cargar una regata simulada en Palma de Mallorca para probar el funcionamiento sin necesidad de tener un archivo propio a mano.

### [Versión 0.1.0] - 26/10/2026
- **Creación inicial del proyecto:**
  - Definición del alcance y necesidades del programa para regatas.
  - Creación de la documentación base (`README.md`).
  - Creación de las normas de trabajo y comunicación sencilla (`AGENT.md`).
  - Preparación de la arquitectura para el visor web HTML/JS.
