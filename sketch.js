// Pelota que rebota + sistema de particulas.
//
// Comportamiento:
//  - Rebota en las cuatro paredes y al chocar cambia de color.
//  - La energia del rebote es aleatoria: a veces salta mucho y a veces poco.
//  - Cada rebote emite un sonido corto (p5.sound.js).
//  - Si el cursor se posa sobre la pelota, esta se detiene.
//  - Al hacer clic/tocar la pelota, se acelera un 20% (con tope) y a los
//    3 segundos vuelve a su velocidad normal.
//  - Desde la posicion del mouse salen figuras geometricas (particulas) que
//    se desvanecen con el tiempo.
//
// Nota: el navegador solo permite audio despues de una interaccion del usuario
// (politica de autoplay), por eso userStartAudio() se llama en el primer
// clic/toque.

// Firefox no implementa AudioParam.cancelAndHoldAtTime, que Tone.js (dentro de
// p5.sound) usa al cambiar la frecuencia. Sin este polyfill,
// osc.freq() lanza "this._param.cancelAndHoldAtTime is not a function" y rompe
// el draw(). En navegadores que ya lo soportan queda intacto.
if (typeof AudioParam !== 'undefined' && !AudioParam.prototype.cancelAndHoldAtTime) {
  AudioParam.prototype.cancelAndHoldAtTime = function (cancelTime) {
    const valor = this.value;
    this.cancelScheduledValues(cancelTime);
    this.setValueAtTime(valor, cancelTime);
    return this;
  };
}

const RADIO = 25;
const GRAVEDAD = 0.5;

// Impulso al hacer clic/tocar la pelota.
const AUMENTO_VELOCIDAD = 1.2;   // +20% por toque
const VELOCIDAD_MAX = 2.5;       // tope del multiplicador (no se descontrola)
const DURACION_IMPULSO = 3000;   // ms; luego vuelve a la velocidad normal

// Particulas.
const MAX_PARTICULAS = 400;
const EMISION_POR_FRAME = 2;

// Colores que va tomando la pelota al chocar con las paredes.
const PALETA = ['#f77f00', '#e63946', '#9b5de5', '#00bbf9', '#2a9d8f', '#f15bb5'];
let indiceColor = 0;

let posX, posY;
let velX, velY;
let colorPelota;

let multiplicador = 1;           // 1 = velocidad normal
let temporizadorImpulso = null;  // programado al impulsar la pelota

let particulas = [];

let osc, env;          // cadena de audio: oscilador -> envolvente -> salida
let audioListo = false;

function setup() {
  createCanvas(windowWidth, windowHeight);
  posX = width / 2;
  posY = 150;
  velX = random(-4, 4);
  velY = 0;
  colorPelota = color(PALETA[indiceColor]);

  // Envolvente de amplitud (attack, decay, sustain, release).
  env = new p5.Envelope(0.005, 0.08, 0.12, 0.15);
  osc = new p5.Oscillator('sine');
  osc.disconnect();    // lo sacamos de la salida por defecto...
  osc.connect(env);    // ...y lo hacemos pasar por la envolvente.
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  background(255, 209, 220);   // rosa pastel

  // Particulas: emitir, actualizar y dibujar (detras de la pelota).
  emitirParticulas();
  for (let i = particulas.length - 1; i >= 0; i--) {
    const p = particulas[i];
    p.actualizar();
    if (!p.viva) {
      particulas.splice(i, 1);
      continue;
    }
    p.dibujar();
  }

  const sobrePelota = dist(mouseX, mouseY, posX, posY) <= RADIO;

  if (sobrePelota) {
    // El cursor la detiene: se congela en el sitio.
    velX = 0;
    velY = 0;
  } else {
    actualizarFisica();
  }

  fill(colorPelota);
  noStroke();
  circle(posX, posY, RADIO * 2);
}

function actualizarFisica() {
  velY += GRAVEDAD;
  // El multiplicador hace que todo el movimiento vaya mas rapido.
  posX += velX * multiplicador;
  posY += velY * multiplicador;

  // Paredes laterales.
  if (posX > width - RADIO) {
    posX = width - RADIO;
    velX = -abs(velX) * rebote();
    cambiarColorPelota();
    sonar(velX);
  } else if (posX < RADIO) {
    posX = RADIO;
    velX = abs(velX) * rebote();
    cambiarColorPelota();
    sonar(velX);
  }

  // Piso: rebote aleatorio + empujon lateral para que se sienta viva.
  if (posY > height - RADIO) {
    posY = height - RADIO;
    velY = -max(abs(velY) * rebote(), random(5, 9));
    velX += random(-1.5, 1.5);
    cambiarColorPelota();
    sonar(velY);
  } else if (posY < RADIO) {
    // Techo.
    posY = RADIO;
    velY = abs(velY) * rebote();
    cambiarColorPelota();
    sonar(velY);
  }

  velX = constrain(velX, -20, 20);
  velY = constrain(velY, -24, 24);
}

// Factor de restitucion aleatorio: a veces rebota mucho y a veces poco.
// Valores mas altos = rebotes mas fuertes.
function rebote() {
  return random(0.6, 1.05);
}

// La pelota cambia a otro color de la paleta (distinto del actual).
function cambiarColorPelota() {
  indiceColor = (indiceColor + 1 + int(random(PALETA.length - 1))) % PALETA.length;
  colorPelota = color(PALETA[indiceColor]);
}

// --- Particulas -----------------------------------------------------------

// Emite figuras geometricas desde la posicion del mouse.
function emitirParticulas() {
  // mouseX/mouseY arrancan en 0,0: no emitir hasta que el mouse se mueva.
  if (mouseX === 0 && mouseY === 0) return;
  for (let i = 0; i < EMISION_POR_FRAME; i++) {
    if (particulas.length >= MAX_PARTICULAS) break;
    particulas.push(new Particula(mouseX, mouseY));
  }
}

class Particula {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    const angulo = random(TWO_PI);
    const rapidez = random(1, 5);
    this.vx = cos(angulo) * rapidez;
    this.vy = sin(angulo) * rapidez - random(0.5, 2);
    this.vidaMax = random(40, 90);   // frames (~0.7 a 1.5 s)
    this.vida = this.vidaMax;
    this.tamano = random(6, 18);
    this.forma = int(random(3));     // 0 circulo, 1 cuadrado, 2 triangulo
    this.rot = random(TWO_PI);
    this.velRot = random(-0.1, 0.1);
    this.r = random(120, 255);
    this.g = random(80, 210);
    this.b = random(120, 255);
  }

  actualizar() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.08;      // gravedad suave
    this.vx *= 0.99;
    this.rot += this.velRot;
    this.vida--;
  }

  get viva() {
    return this.vida > 0;
  }

  dibujar() {
    const t = this.vida / this.vidaMax;      // 1 al nacer -> 0 al morir
    const s = this.tamano * (0.4 + 0.6 * t); // se encoge al envejecer
    push();
    translate(this.x, this.y);
    rotate(this.rot);
    noStroke();
    fill(this.r, this.g, this.b, 255 * t);
    if (this.forma === 0) {
      circle(0, 0, s);
    } else if (this.forma === 1) {
      rect(-s / 2, -s / 2, s, s);
    } else {
      triangle(0, -s / 2, -s / 2, s / 2, s / 2, s / 2);
    }
    pop();
  }
}

// --- Sonido ---------------------------------------------------------------

// Cada rebote emite un "blip"; el tono depende de la velocidad del impacto.
function sonar(velocidad) {
  if (!audioListo) return;
  const velocidadAbs = abs(velocidad);
  osc.freq(
    constrain(map(velocidadAbs, 0, 15, 180, 800) + random(-40, 40), 150, 1000)
  );
  env.play();
}

// --- Impulso al hacer clic/tocar la pelota -------------------------------

function cursorSobrePelota() {
  return dist(mouseX, mouseY, posX, posY) <= RADIO;
}

// Acelera un 20% (con tope) y programa la vuelta a la velocidad normal.
function impulsarPelota() {
  multiplicador = min(multiplicador * AUMENTO_VELOCIDAD, VELOCIDAD_MAX);

  if (temporizadorImpulso !== null) clearTimeout(temporizadorImpulso);
  temporizadorImpulso = setTimeout(() => {
    multiplicador = 1;            // vuelve a la velocidad normal
    temporizadorImpulso = null;
  }, DURACION_IMPULSO);
}

// El audio necesita un gesto del usuario para arrancar.
function iniciarAudio() {
  if (audioListo) return;
  userStartAudio();
  osc.start();
  audioListo = true;
}

function mousePressed() {
  iniciarAudio();
  if (cursorSobrePelota()) impulsarPelota();
}

function touchStarted() {
  iniciarAudio();
  if (cursorSobrePelota()) impulsarPelota();
  return false; // evita el scroll y el mousePressed sintetico
}
