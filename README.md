# 🏀 TECNM Basket — Overlay para OBS Studio & Control Panel

Sistema de transmisión y overlay en vivo para básquetbol universitario (1920x1080 con fondo 100% transparente), optimizado para **OBS Studio**, **Elgato Stream Deck** y listo para desplegar en **Vercel** o ejecutar localmente con **Node.js + Express + Socket.io**.

---

## 🚀 Despliegue en Vercel

1. Haz fork o sube este repositorio a tu cuenta de GitHub (`https://github.com/Rero004/Basketball`).
2. Entra en [Vercel](https://vercel.com) e inicia sesión.
3. Haz clic en **"Add New..."** > **"Project"** y selecciona el repositorio **Basketball**.
4. Deja la configuración por defecto (Vercel detectará automáticamente `vercel.json` y la función serverless en `api/index.js`).
5. Haz clic en **Deploy**.

Tu aplicación estará disponible en una URL como `https://tu-proyecto.vercel.app`:
- **Overlay para OBS Studio:** `https://tu-proyecto.vercel.app/overlay`
- **Panel de Control:** `https://tu-proyecto.vercel.app/control`

---

## 💻 Ejecución Local

1. Clona el repositorio e instala las dependencias:
   ```bash
   git clone https://github.com/Rero004/Basketball.git
   cd Basketball
   npm install
   ```
2. Inicia el servidor:
   ```bash
   npm start
   ```
3. Accede a las vistas:
   - **Overlay OBS (1920x1080):** [http://localhost:3000/overlay](http://localhost:3000/overlay)
   - **Panel de Control:** [http://localhost:3000/control](http://localhost:3000/control)

---

## 📺 Configuración en OBS Studio

1. En tu escena de OBS, añade una nueva fuente: **Navegador (Browser Source)**.
2. Configuración:
   - **URL:** `http://localhost:3000/overlay` (o tu URL de Vercel).
   - **Ancho:** `1920`
   - **Alto:** `1080`
   - Marca la casilla **"Apagar fuente cuando no esté visible"** (opcional) y mantén el fondo transparente.

---

## 🎬 5 Estados de Escena Soportados
1. `hidden`: Pantalla limpia (100% transparente).
2. `pause`: Tarjeta central broadcast con fondo glassmorphism oscuro y blur, logos y nombres completos de ambos equipos, periodo y marcador.
3. `lineup_home`: Quinteto titular y banca del equipo local con animación secuencial automática de foco luminoso (1.3 s por jugador).
4. `lineup_away`: Plantilla completa del equipo visitante con animación secuencial automática.
5. `scorebug`: Marcador compacto en la esquina inferior izquierda (margen de 48px) con franjas de color oficial, logos, acrónimos de 3 letras, periodo y micro-animaciones de destello con etiquetas `+1`, `+2` o `+3`.

---

## 🎛️ Endpoints REST (Elgato Stream Deck)

Todos los endpoints admiten peticiones `GET` y `POST`:

- **Cambiar Estado / Escena:**
  ```http
  GET /api/state?mode=hidden|pause|lineup_home|lineup_away|scorebug
  ```
- **Sumar / Restar Puntos:**
  ```http
  GET /api/score?team=home|away&points=1|2|3|-1
  ```
- **Avanzar Periodo:**
  ```http
  GET /api/period/next
  ```
- **Fijar Periodo Directo:**
  ```http
  GET /api/period?period=1Q|2Q|3Q|4Q|OT
  ```
