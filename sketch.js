/*
Pelota que rebota como si estuviera viva.

- Rebota en los cuatro bordes de la pantalla.
- La fuerza de cada rebote es aleatoria: a veces rebota mucho, a veces poco.
- Cada rebote emite un sonido corto y deja un sistema de particulas.
- Las particulas viven 20 segundos y luego desaparecen.
- La pelota huye del cursor: cuando el mouse se le acerca, pega un salto.
- Si logras atraparla con un clic, suena una melodia de celebracion.

Sonido: se usa p5.sound cuando la pagina se sirve por http/https. Si abres el
archivo con doble clic (file://), el navegador bloquea los AudioWorklets de
p5.sound, asi que se usa la Web Audio API nativa como respaldo. En ambos casos
el sonido arranca en el primer clic (los navegadores lo exigen).
*/

let pelota;

let audioListo = false;
let modoAudio = null;   // 'p5sound' o 'webaudio'
let osc, env;           // usados por p5.sound
let audioCtx;           // usado por la Web Audio API

let cursorCerca = false;    // para detectar cuando el mouse se acerca
let saltando = 0;           // temporizador visual del salto
let celebracion = 0;        // temporizador de la celebracion
let particulas = [];        // particulas que deja cada rebote

const GRAVEDAD = 0.4;
const VEL_MAX = 16;
const RADIO_DETECCION = 170;      // distancia a la que la pelota "siente" el mouse
const IMPULSO_ARRIBA = 10;        // que tan alto salta al huir del cursor
const DURACION_CELEBRACION = 45;
const VIDA_PARTICULA = 20000;     // vida de cada particula: 20 segundos
const MAX_PARTICULAS = 700;       // tope para no saturar

// p5.sound solo esta disponible si la pagina no es file:// y la libreria cargo.
const PUEDE_P5SOUND =
    location.protocol !== 'file:' &&
    typeof p5 !== 'undefined' &&
    typeof p5.Oscillator === 'function';

function setup() {
    createCanvas(windowWidth, windowHeight);
    pelota = crearPelota();
}

function crearPelota() {
    const r = 25;
    return {
        x: random(r, width - r),
        y: random(r, height - r),
        vx: random([-1, 1]) * random(2, 5),
        vy: random(-2, 2),
        r: r,
    };
}

function draw() {
    background(120);

    if (saltando > 0) {
        saltando--;
    }

    if (celebracion > 0) {
        // Mientras celebra, la pelota se queda quieta.
        celebracion--;
    } else {
        huirDelCursor();
        moverPelota();
    }

    actualizarParticulas();

    // Dibujamos la pelota.
    noStroke();
    fill(255, 150, 0);
    circle(pelota.x, pelota.y, pelota.r * 2);

    // Las particulas que dejaron los rebotes.
    dibujarParticulas();

    // Un anillo amarillo mientras da el salto.
    if (saltando > 0) {
        noFill();
        stroke(255, 220, 0, 160);
        strokeWeight(3);
        circle(pelota.x, pelota.y, pelota.r * 2 + saltando);
    }

    if (celebracion > 0) {
        dibujarCelebracion();
    }
}

// La pelota siente el mouse y salta cuando este se acerca.
function huirDelCursor() {
    const d = dist(mouseX, mouseY, pelota.x, pelota.y);
    const cerca = d < RADIO_DETECCION;

    // Solo salta en el momento en que el mouse "entra" al radio de deteccion.
    if (cerca && !cursorCerca) {
        let dx = pelota.x - mouseX;
        let dy = pelota.y - mouseY;
        const mag = Math.hypot(dx, dy);

        if (mag < 1) {
            // El mouse quedo justo encima: empujamos hacia arriba al azar.
            dx = random(-1, 1);
            dy = -1;
        } else {
            dx /= mag;
            dy /= mag;
        }

        // Cuanto mas cerca esté el mouse, mas fuerte es el salto.
        const fuerza = map(d, RADIO_DETECCION, 0, 4, 12);
        pelota.vx += dx * fuerza;
        pelota.vy += dy * fuerza - IMPULSO_ARRIBA; // salto hacia arriba
        saltando = 18;
    }

    cursorCerca = cerca;
}

function moverPelota() {
    // La gravedad tira hacia abajo.
    pelota.vy += GRAVEDAD;

    pelota.x += pelota.vx;
    pelota.y += pelota.vy;

    // Revisamos los cuatro bordes; cada rebote usa un "rebote vivo".
    let reboto = false;

    if (pelota.x < pelota.r) {
        pelota.x = pelota.r;
        pelota.vx = Math.abs(pelota.vx) * factorRebote();
        reboto = true;
    } else if (pelota.x > width - pelota.r) {
        pelota.x = width - pelota.r;
        pelota.vx = -Math.abs(pelota.vx) * factorRebote();
        reboto = true;
    }

    if (pelota.y < pelota.r) {
        pelota.y = pelota.r;
        pelota.vy = Math.abs(pelota.vy) * factorRebote();
        reboto = true;
    } else if (pelota.y > height - pelota.r) {
        pelota.y = height - pelota.r;
        pelota.vy = -Math.abs(pelota.vy) * factorRebote();
        reboto = true;
    }

    if (reboto) {
        sonarRebote();
        emitirParticulas(pelota.x, pelota.y);
    }

    // Un empujoncito horizontal aleatorio para que se sienta viva.
    pelota.vx += random(-0.15, 0.15);

    pelota.vx = constrain(pelota.vx, -VEL_MAX, VEL_MAX);
    pelota.vy = constrain(pelota.vy, -VEL_MAX, VEL_MAX);
}

// Factor de rebote: casi siempre rebota menos, pero a veces toma impulso
// extra para que la pelota no se quede muerta en el suelo.
function factorRebote() {
    if (random() < 0.2) {
        return random(1.0, 1.4);
    }
    return random(0.5, 1.0);
}

// --- Sistema de particulas de los rebotes ---

// Suelta una pequena explosion de particulas en el punto de rebote.
function emitirParticulas(x, y) {
    const cantidad = floor(random(6, 13));

    for (let i = 0; i < cantidad; i++) {
        const angulo = random(TWO_PI);
        const rapidez = random(1, 5);

        particulas.push({
            x: x,
            y: y,
            vx: cos(angulo) * rapidez,
            vy: sin(angulo) * rapidez,
            tam: random(3, 9),
            r: random(230, 255),
            g: random(140, 210),
            b: random(0, 80),
            nacimiento: millis(),
        });
    }

    // Si hay demasiadas, quitamos las mas viejas.
    while (particulas.length > MAX_PARTICULAS) {
        particulas.shift();
    }
}

function actualizarParticulas() {
    const ahora = millis();
    const vivas = [];

    for (const p of particulas) {
        if (ahora - p.nacimiento < VIDA_PARTICULA) {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.985;   // se van frenando
            p.vy *= 0.985;
            vivas.push(p);
        }
        // Las que ya cumplieron 20 segundos simplemente no se copian: desaparecen.
    }

    particulas = vivas;
}

function dibujarParticulas() {
    const ahora = millis();
    noStroke();

    for (const p of particulas) {
        // Se desvanecen poco a poco durante sus 20 segundos de vida.
        const alpha = map(ahora - p.nacimiento, 0, VIDA_PARTICULA, 255, 0);
        fill(p.r, p.g, p.b, alpha);
        circle(p.x, p.y, p.tam);
    }
}

// Crea el audio en el primer gesto del usuario (los navegadores lo exigen).
function iniciarAudio() {
    if (audioListo) {
        return;
    }

    if (PUEDE_P5SOUND) {
        userStartAudio();

        osc = new p5.Oscillator('sine');
        env = new p5.Envelope();
        env.setADSR(0.005, 0.08, 0.25, 0.1); // ataque, caída, sostenido, liberación
        env.setRange(0.5, 0);
        env.connect(osc);   // el sobre controla la amplitud del oscilador
        osc.start();

        modoAudio = 'p5sound';
    } else {
        // Respaldo con Web Audio API: funciona incluso desde file://.
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        modoAudio = 'webaudio';
    }

    audioListo = true;
}

// Sonido corto en cada rebote.
function sonarRebote() {
    if (!audioListo) {
        return;
    }

    if (modoAudio === 'p5sound') {
        osc.freq(random(180, 560), 0.01);
        env.play(osc, 0, 0.02);
    } else {
        beepWebAudio(random(180, 560), audioCtx.currentTime, 0.15);
    }
}

// Melodia ascendente de celebracion al atrapar la pelota.
function sonarCelebracion() {
    if (!audioListo) {
        return;
    }

    const notas = [523.25, 659.25, 783.99, 1046.5]; // Do, Mi, Sol, Do agudo

    if (modoAudio === 'p5sound') {
        notas.forEach((frecuencia, i) => {
            setTimeout(() => {
                osc.freq(frecuencia, 0.005);
                env.play(osc, 0, 0.07);
            }, i * 90);
        });
    } else {
        const base = audioCtx.currentTime;
        notas.forEach((frecuencia, i) => {
            beepWebAudio(frecuencia, base + i * 0.09, 0.22, 0.3);
        });
    }
}

// "Blip" con la Web Audio API nativa (sin AudioWorklets).
function beepWebAudio(frecuencia, cuando, duracion, volumen) {
    const t = cuando || audioCtx.currentTime;
    const dur = duracion || 0.15;
    const vol = volumen || 0.25;

    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();

    o.type = 'sine';
    o.frequency.setValueAtTime(frecuencia, t);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
    o.onended = function () {
        o.disconnect();
        g.disconnect();
    };
}

// Se activa al hacer clic: primero habilita el audio y luego revisa si
// atrapaste la pelota.
function intentarAtrapar() {
    iniciarAudio();

    if (dist(mouseX, mouseY, pelota.x, pelota.y) <= pelota.r) {
        celebracion = DURACION_CELEBRACION;
        sonarCelebracion();
    }
}

function mousePressed() {
    intentarAtrapar();
}

function touchStarted() {
    intentarAtrapar();
}

// Anillos y texto al atrapar la pelota.
function dibujarCelebracion() {
    const progreso = 1 - celebracion / DURACION_CELEBRACION;

    noFill();
    stroke(255, 215, 0);
    strokeWeight(5);
    circle(pelota.x, pelota.y, pelota.r * 2 + progreso * 130);

    stroke(255, 255, 255, 170);
    strokeWeight(3);
    circle(pelota.x, pelota.y, pelota.r * 2 + progreso * 90);

    noStroke();
    fill(50);
    textAlign(CENTER, CENTER);
    text('¡la atrapaste!', pelota.x, pelota.y - pelota.r - 26);
}

// Mantiene el lienzo a pantalla completa al redimensionar la ventana.
function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}
