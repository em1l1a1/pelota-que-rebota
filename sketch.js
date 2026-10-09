// =====================================================================
// PELOTITA LOCA
// Una pelota con gravedad que va pintando su camino con colores pastel.
// Estructura: constantes, estado, setup/draw, fisica, dibujo,
// manchas (pintura) y sonido.
// =====================================================================

// ---------------------------------------------------------------------
// CONSTANTES (ajusta aqui los colores, tamanos y la fisica)
// ---------------------------------------------------------------------

// Paleta: una sola cromatica pastel.
const COL_FONDO   = '#FFE4EC';  // fondo rosa pastel muy suave
const COL_DETALLE = '#5B4B7A';  // morado para texto y sombra
const COL_REFLEJO = '#FFFFFF';  // brillo blanco de la pelota
const PINTURAS = ['#FFB5D0', '#D5B8FF', '#B8E4FF', '#BFF0D8', '#FFD6B0'];

// Pelota y fisica.
const RADIO         = 26;    // radio de la pelota
const GRAVEDAD      = 0.55;  // aceleracion hacia abajo
const REBOTE_MIN    = 0.55;  // energia que conserva al rebotar (minimo)
const REBOTE_MAX    = 0.85;  // energia que conserva al rebotar (maximo)
const ROZAMIENTO    = 0.99;  // frenado horizontal al tocar el piso
const VEL_MAX_X     = 16;    // velocidad horizontal maxima
const VEL_MAX_Y     = 22;    // velocidad vertical maxima
const UMBRAL_REBOTE = 1.6;   // debajo de esto la pelota se apoya y no salpica
const IMPULSO_CLIC  = 9;     // fuerza del impulso al hacer clic

// Deformacion (squash & stretch).
const APLASTADO_MIN    = 0.6;   // cuanto se aplasta al tocar el piso
const RECUPERACION     = 0.18;  // rapidez con que recupera la forma redonda
const ESTIRAMIENTO     = 0.02;  // estiramiento por velocidad al subir
const ESTIRAMIENTO_MAX = 0.3;   // estiramiento maximo

// Sombra del piso.
const SOMBRA_ANCHO = 1.5;   // ancho de la sombra (x radio)
const SOMBRA_ALTO  = 0.45;  // alto de la sombra (x radio)
const SOMBRA_ALFA  = 55;    // opacidad maxima de la sombra

// Manchas de pintura.
const MAX_MANCHAS      = 500;          // tope para no perder rendimiento
const VIDA_MANCHA_MIN  = 300;          // 5 s a 60 fps
const VIDA_MANCHA_MAX  = 480;          // 8 s a 60 fps
const TRAZO_DISTANCIA  = RADIO * 0.5;  // cada cuanto deja rastro la pelota
const RADIO_TRAZO      = RADIO * 0.65; // tamano de cada mancha del rastro
const GOTAS_PISO       = 7;            // gotas al rebotar en el piso
const GOTAS_MOUSE      = 2;            // gotas al mover el mouse
const RADIO_SALPICADOR = 40;           // mancha grande al hacer clic
const SALTO_MOUSE      = 12;           // distancia minima para salpicar con el mouse

// Sonido.
const VOLUMEN_REBOTE = 0.3;  // 0..1 (mas bajo = mas suave)
const FREC_MIN = 160;        // tono en rebotes suaves
const FREC_MAX = 620;        // tono en rebotes fuertes

// ---------------------------------------------------------------------
// POLYFILL: Firefox no implementa AudioParam.cancelAndHoldAtTime, que
// Tone.js (dentro de p5.sound) usa al cambiar la frecuencia. Sin esto,
// osc.freq() lanza un error y rompe el draw().
// ---------------------------------------------------------------------
if (typeof AudioParam !== 'undefined' && !AudioParam.prototype.cancelAndHoldAtTime) {
  AudioParam.prototype.cancelAndHoldAtTime = function (tiempo) {
    const valor = this.value;
    this.cancelScheduledValues(tiempo);
    this.setValueAtTime(valor, tiempo);
    return this;
  };
}

// ---------------------------------------------------------------------
// ESTADO
// ---------------------------------------------------------------------
let posX, posY, velX, velY;    // posicion y velocidad de la pelota
let colorPelota;               // hex del color actual de la pelota
let indicePintura = 0;         // posicion en la paleta
let aplastado = 1;             // 1 = redonda, <1 = aplastada
let escalaX = 1, escalaY = 1;  // deformacion calculada por frame

const manchas = [];            // todas las manchas de pintura vivas
let ultimoTrazoX = -999, ultimoTrazoY = -999;  // ultimo punto pintado por la pelota
let ultimoMouseX = -999, ultimoMouseY = -999;  // ultimo punto pintado por el mouse

let osc, env;                  // cadena de audio: oscilador -> envolvente
let audioListo = false;        // el audio solo arranca tras un gesto del usuario

// ---------------------------------------------------------------------
// SETUP
// ---------------------------------------------------------------------
function setup() {
  createCanvas(windowWidth, windowHeight);
  posX = width / 2;
  posY = 150;
  velX = random(-4, 4);
  velY = 0;
  colorPelota = PINTURAS[indicePintura];

  // Sonido suave: oscilador -> envolvente -> salida.
  env = new p5.Envelope(0.004, 0.1, 0.08, 0.18);
  osc = new p5.Oscillator('sine');
  osc.amp(VOLUMEN_REBOTE);
  osc.disconnect();   // lo sacamos de la salida directa...
  osc.connect(env);   // ...y lo hacemos pasar por la envolvente.
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ---------------------------------------------------------------------
// BUCLE PRINCIPAL
// ---------------------------------------------------------------------
function draw() {
  background(COL_FONDO);

  actualizarFisica();       // mueve la pelota y resuelve los rebotes
  actualizarDeformacion();  // calcula el squash & stretch
  pintarRastro();           // la pelota deja pintura a su paso
  salpicarMouse();          // el mouse tambien salpica pintura

  dibujarManchas();         // pintura (detras de la pelota)
  dibujarSombra();
  dibujarPelota();
}

// ---------------------------------------------------------------------
// FISICA
// ---------------------------------------------------------------------
function actualizarFisica() {
  velY += GRAVEDAD;
  posX += velX;
  posY += velY;

  rebotarEnParedes();
  rebotarEnTecho();
  rebotarEnPiso();

  velX = constrain(velX, -VEL_MAX_X, VEL_MAX_X);
  velY = constrain(velY, -VEL_MAX_Y, VEL_MAX_Y);
}

// Factor de rebote: siempre menor que 1 (la pelota va perdiendo energia).
function rebote() {
  return random(REBOTE_MIN, REBOTE_MAX);
}

function rebotarEnParedes() {
  if (posX > width - RADIO) {
    posX = width - RADIO;
    velX = -abs(velX) * rebote();
    alRebotar(abs(velX));
  } else if (posX < RADIO) {
    posX = RADIO;
    velX = abs(velX) * rebote();
    alRebotar(abs(velX));
  }
}

function rebotarEnTecho() {
  if (posY < RADIO) {
    posY = RADIO;
    velY = abs(velY) * rebote();
    alRebotar(abs(velY));
  }
}

function rebotarEnPiso() {
  if (posY < height - RADIO) return;

  posY = height - RADIO;
  const impacto = abs(velY);

  if (impacto > UMBRAL_REBOTE) {
    velY = -impacto * rebote();
    velX *= ROZAMIENTO;
    aplastado = APLASTADO_MIN;   // se aplasta al tocar el piso
    salpicarPiso();
    alRebotar(impacto);
  } else {
    velY = 0;                    // poca energia: se apoya y deja de rebotar
    velX *= ROZAMIENTO;
  }
}

// Efecto comun a todo rebote: cambia de color y suena.
function alRebotar(impacto) {
  cambiarColorPelota();
  sonar(impacto);
}

// Elige otro color de la paleta, distinto al actual.
function cambiarColorPelota() {
  indicePintura = (indicePintura + 1 + int(random(PINTURAS.length - 1))) % PINTURAS.length;
  colorPelota = PINTURAS[indicePintura];
}

// ---------------------------------------------------------------------
// DIBUJO DE LA PELOTA
// ---------------------------------------------------------------------

// Calcula el estiramiento y el aplastado de este frame.
function actualizarDeformacion() {
  aplastado += (1 - aplastado) * RECUPERACION;   // vuelve poco a poco a la forma redonda
  const subida = max(0, -velY);                  // solo se estira al subir
  const estirado = constrain(subida * ESTIRAMIENTO, 0, ESTIRAMIENTO_MAX);
  escalaY = (1 + estirado) * aplastado;
  escalaX = 1 / escalaY;                         // conserva el volumen
}

function dibujarPelota() {
  noStroke();
  push();
  // El desplazamiento mantiene el contacto con el piso al deformarse.
  translate(posX, posY + RADIO * (1 - escalaY));
  scale(escalaX, escalaY);
  rellenar(colorPelota);          // cuerpo
  circle(0, 0, RADIO * 2);
  rellenar(COL_REFLEJO, 200);     // brillo
  circle(-RADIO * 0.33, -RADIO * 0.35, RADIO * 0.55);
  pop();
}

// Sombra eliptica en el piso: se achica cuando la pelota sube.
function dibujarSombra() {
  const altura = constrain((height - RADIO - posY) / (height - 2 * RADIO), 0, 1);
  const factor = lerp(0.4, 1, altura);
  noStroke();
  rellenar(COL_DETALLE, SOMBRA_ALFA * altura);
  ellipse(posX, height - RADIO * 0.15,
          RADIO * 2 * SOMBRA_ANCHO * factor,
          RADIO * 2 * SOMBRA_ALTO * factor);
}

// ---------------------------------------------------------------------
// MANCHAS DE PINTURA
// ---------------------------------------------------------------------

// Agrega una mancha respetando el tope maximo.
function agregarMancha(mancha) {
  manchas.push(mancha);
  if (manchas.length > MAX_MANCHAS) manchas.shift();
}

// Mancha grande y varias gotas pequeñas al rebotar en el piso.
function salpicarPiso() {
  agregarMancha(new Mancha(posX, height - RADIO * 0.3, RADIO * 0.9, colorPelota, vidaMancha()));
  agregarGotas(posX, height - RADIO, GOTAS_PISO, colorPelota, PI, TWO_PI);
}

// Salpicadura grande al hacer clic.
function salpicarGrande() {
  agregarMancha(new Mancha(posX, posY, RADIO_SALPICADOR, colorPelota, vidaMancha()));
  agregarGotas(posX, posY, GOTAS_PISO, colorPelota, 0, TWO_PI);
}

// Suelta gotas de pintura alrededor de (x, y) dentro de un rango de angulos.
function agregarGotas(x, y, cantidad, hex, anguloMin, anguloMax) {
  for (let i = 0; i < cantidad; i++) {
    const angulo = random(anguloMin, anguloMax);
    const rapidez = random(2, 7);
    agregarMancha(new Mancha(
      x, y, random(3, 8), hex, vidaMancha(),
      cos(angulo) * rapidez, sin(angulo) * rapidez, GRAVEDAD * 0.5
    ));
  }
}

// Rastro: la pelota pinta mientras se mueve.
function pintarRastro() {
  if (dist(posX, posY, ultimoTrazoX, ultimoTrazoY) < TRAZO_DISTANCIA) return;
  ultimoTrazoX = posX;
  ultimoTrazoY = posY;
  agregarMancha(new Mancha(posX, posY, RADIO_TRAZO, colorPelota, vidaMancha()));
}

// El mouse tambien deja salpicaduras pastel.
function salpicarMouse() {
  if (mouseX === 0 && mouseY === 0) return;   // p5 arranca el mouse en 0,0
  if (dist(mouseX, mouseY, ultimoMouseX, ultimoMouseY) < SALTO_MOUSE) return;
  ultimoMouseX = mouseX;
  ultimoMouseY = mouseY;
  agregarGotas(mouseX, mouseY, GOTAS_MOUSE, random(PINTURAS), 0, TWO_PI);
}

// Actualiza, dibuja y limpia las manchas ya apagadas.
function dibujarManchas() {
  for (let i = manchas.length - 1; i >= 0; i--) {
    const mancha = manchas[i];
    mancha.actualizar();
    if (!mancha.viva) {
      manchas.splice(i, 1);
      continue;
    }
    mancha.dibujar();
  }
}

// Vida aleatoria de una mancha (frames).
function vidaMancha() {
  return random(VIDA_MANCHA_MIN, VIDA_MANCHA_MAX);
}

// Una mancha de pintura: elipse que se desvanece con el tiempo.
class Mancha {
  constructor(x, y, radio, hex, vida, vx = 0, vy = 0, caida = 0) {
    this.x = x;
    this.y = y;
    this.radio = radio;
    const c = color(hex);
    this.rojo = red(c);
    this.verde = green(c);
    this.azul = blue(c);
    this.vidaMax = vida;
    this.vida = vida;
    this.vx = vx;
    this.vy = vy;
    this.caida = caida;                 // gravedad propia (0 = mancha fija)
    this.forma = random(0.75, 1.25);    // deformacion organica
    this.rot = random(TWO_PI);
  }

  actualizar() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.caida;
    this.vida--;
  }

  get viva() {
    return this.vida > 0;
  }

  dibujar() {
    const opacidad = 255 * (this.vida / this.vidaMax);
    noStroke();
    fill(this.rojo, this.verde, this.azul, opacidad);
    push();
    translate(this.x, this.y);
    rotate(this.rot);
    ellipse(0, 0, this.radio * 2 * this.forma, (this.radio * 2) / this.forma);
    pop();
  }
}

// ---------------------------------------------------------------------
// UTILIDAD DE COLOR
// ---------------------------------------------------------------------
// Rellena usando un color hex y, opcionalmente, una transparencia.
function rellenar(hex, alfa = 255) {
  const c = color(hex);
  fill(red(c), green(c), blue(c), alfa);
}

// ---------------------------------------------------------------------
// SONIDO
// ---------------------------------------------------------------------
// "Blip" suave; el tono sube cuanto mas fuerte fue el rebote.
function sonar(impacto) {
  if (!audioListo) return;
  const frecuencia = map(constrain(impacto, 0, VEL_MAX_Y), 0, VEL_MAX_Y, FREC_MIN, FREC_MAX);
  osc.freq(frecuencia + random(-8, 8));
  env.play();
}

// El navegador exige un gesto del usuario para habilitar el audio.
function iniciarAudio() {
  if (audioListo) return;
  userStartAudio();
  osc.start();
  audioListo = true;
}

// ---------------------------------------------------------------------
// ENTRADA
// ---------------------------------------------------------------------
// Al hacer clic: la pelota sale impulsada hacia el mouse y salpica.
function mousePressed() {
  iniciarAudio();
  impulsarHaciaMouse();
}

function touchStarted() {
  iniciarAudio();
  impulsarHaciaMouse();
  return false;   // evita el scroll y el mousePressed sintetico
}

// Da a la pelota un empujon en direccion al mouse.
function impulsarHaciaMouse() {
  const dx = mouseX - posX;
  const dy = mouseY - posY;
  const distancia = max(dist(mouseX, mouseY, posX, posY), 1);
  velX += (dx / distancia) * IMPULSO_CLIC;
  velY += (dy / distancia) * IMPULSO_CLIC;
  salpicarGrande();
}
