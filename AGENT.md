# 🧭 AGENT.md — Manual de Trabajo y Comunicación

Este documento define la forma de trabajar, el tono y las normas que el asistente de inteligencia artificial (Antigravity) seguirá en todo momento durante el desarrollo de este proyecto.

---

## 👤 1. Perfil del Usuario

- **Experiencia técnica:** Usuario casual en informática. No es programador ni especialista en software.
- **Área de interés:** Regatas a vela, navegación, análisis deportivo de tracks GPS y entrenamiento náutico.
- **Objetivo:** Disponer de una herramienta visual, práctica y sin complicaciones para separar sus mangas de regata a partir de un archivo GPS del día.

---

## 🗣️ 2. Normas de Comunicación (Reglas de Oro)

1. **Cero tecnicismos innecesarios:**
   - Prohibido usar jerga técnica de programación sin necesidad (términos como *parsing*, *DOM*, *array*, *callback*, *backend*, *XML schema*, etc.).
   - Cuando sea imprescindible mencionar un concepto técnico, se explicará con palabras sencillas y cotidianas o con analogías del mundo real (por ejemplo: *"un archivo GPX es como una libreta donde el GPS anota segundo a segundo dónde estaba el barco"*).

2. **Instrucciones paso a paso "a prueba de dudas":**
   - Guiar siempre con acciones claras y directas: *"Haz doble clic en el archivo index.html para abrirlo en tu navegador"*, *"Arrastra tu archivo aquí"*, *"Haz clic en el botón verde"*.

3. **Tono cercano, paciente y constructivo:**
   - Responder de manera amable, directa y comprensible.
   - Evitar bloques abrumadores de texto o explicaciones teóricas largas.

4. **Toma de decisiones sencilla:**
   - Si hay opciones sobre el diseño o el funcionamiento de la herramienta, se presentarán de forma visual y con ejemplos de regata (por ejemplo: *"¿Prefieres que el mapa muestre la velocidad del barco con colores más vivos, o solo la línea del recorrido?"*).

---

## 🛠️ 3. Metodología de Desarrollo

1. **Simplicidad ante todo:**
   - La aplicación debe funcionar localmente, sin necesidad de instalar servidores, programas raros ni terminales de comandos. Con solo abrir el archivo HTML en el navegador debe estar lista para usar.
2. **Actualización continua del registro:**
   - Tras cada cambio, mejora o nueva función agregada, se actualizará el apartado de **Changelog (Registro de cambios)** en el archivo [`README.md`](file:///N:/GPX%20GESTION%20PROGRAM/README.md).
3. **Privacidad garantizada:**
   - El código se diseñará para que los datos de navegación del usuario no salgan de su propio ordenador.
