import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import Stats from 'https://unpkg.com/three@0.160.0/examples/jsm/libs/stats.module.js';

// 1. CONFIGURACIÓN BASE (Motor, Escena y Cámara)
let juegoIniciado = false;
const pantalla = document.getElementById('pantalla-inicio');
const btnEmpezar = document.getElementById('btn-empezar');

btnEmpezar.addEventListener('click', () => {
    pantalla.style.opacity = '0'; // Efecto de desvanecido
    setTimeout(() => {
        pantalla.style.display = 'none'; // Quitamos la capa
        juegoIniciado = true; // ¡Arrancamos!
    }, 500);
});
const clock = new THREE.Clock();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(0, 8, 12); 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Bloom
const renderScene = new RenderPass(scene, camera);
// Parámetros Bloom
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.8, 1, 0.85  // Fuerza / / Radio / / Umbral
)

// El "Composer" sustituirá a nuestro renderizador normal
const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);


// 2. ESTADO DEL JUEGO Y CONSTANTES

// Controles de Cámara
let camaraLibre = false; 

// Controles de Movimiento
const teclasPulsadas = { w: false, a: false, s: false, d: false };
const velocidadNave = 30.0
const alturaBase = 1.5; 

// Configuración del Mapa
const anchoMapa = 50; 
const anchoVia = 7;
const limiteLateral = (anchoMapa / 2) - 1; 
let posicionZActual = 0; 

// Almacenamiento Dinámico
const obstaculos = []; 

// Estado de Físicas y Colisiones
let enColision = false; // Interruptor de estado (Vivo / Chocado)
const posicionInicialDron = new THREE.Vector3(0, alturaBase, 0); // Guardamos la coordenada de salida
// Cajas matemáticas invisibles (Bounding Boxes) para detectar los golpes
const dronBox = new THREE.Box3();
const obstaculoEsfera = new THREE.Sphere(new THREE.Vector3(), 1.2);


// Sistema de Niveles y Meta
let nivelActual = 1;
let multiplicadorVelocidad = 0.5;
let enTransicion = false;
let zMeta = -165;

// --- NUEVO: Enlaces a la Interfaz de Usuario (HUD) ---
const uiNivel = document.getElementById('hud-nivel');
const uiVelocidad = document.getElementById('hud-velocidad');
const uiMensaje = document.getElementById('mensaje-centro');
const uiTextoMensaje = document.getElementById('texto-mensaje');
const btnReiniciar = document.getElementById('btn-reiniciar');

// 3. ILUMINACIÓN Y SOMBRAS

const ambientLight = new THREE.AmbientLight('#0a0025', 2.5); 
scene.add(ambientLight);

// Luz Puntual (Sol)
const sunLight = new THREE.PointLight('#fffef9e2', 15000, 1000); 
sunLight.position.set(0, 80, -94.5); 
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.bias = -0.0001; 
sunLight.shadow.normalBias = 0.05;
scene.add(sunLight);

// Representación Visual del Sol
const sunGeometry = new THREE.SphereGeometry(400, 532, 532); 
const sunMaterial = new THREE.MeshBasicMaterial({ color: '#fffcec' }); 
const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
//sunMesh.position.copy(sunLight.position); 
sunMesh.position.set(100, 1680, -1694.5); 
scene.add(sunMesh);



const luztierra = new THREE.PointLight('#aaccff', 3000, 800); 
luztierra.position.set(150, 50, -20); 
scene.add(luztierra);
//const chivatotierra = new THREE.PointLightHelper(luztierra, 15);
//scene.add(chivatotierra);

const luzstation1 = new THREE.PointLight('#fefff5', 50000, 300); 
luzstation1.position.set(150, 180, -350); 
scene.add(luzstation1);
//const chivatoEstacion1 = new THREE.PointLightHelper(luzstation1, 15);
//scene.add(chivatoEstacion1);

const luzstation2 = new THREE.PointLight('#fefff5', 500000, 90); 
luzstation2.position.set(-50, 90, -400);
scene.add(luzstation2);
//const chivatoEstacion2 = new THREE.PointLightHelper(luzstation2, 15);
//scene.add(chivatoEstacion2);


// 3.5. DECORACIÓN DEL ENTORNO: POLVO ESTELAR MULTICAPA

function crearCapaEstrellas(cantidad, tamano, opacidad) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(cantidad * 3);
    
    const radioVacio = 850; // El radio donde NO hay estrelas

    for (let i = 0; i < cantidad; i++) {
        let x, y, z, distancia;

        //Generar estrella si esta fuera del rango vacio
        do {
            x = (Math.random() - 0.5) * 5000;
            y = (Math.random() - 0.5) * 5000;
            z = (Math.random() - 0.5) * 5000;

            distancia = Math.sqrt((x * x) + (y * y) + (z * z));
            
        } while (distancia < radioVacio); // Si está en la zona prohibida, repite el proceso

        pos[i * 3] = x;
        pos[(i * 3) + 1] = y;
        pos[(i * 3) + 2] = z;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    
    const mat = new THREE.PointsMaterial({ 
        color: '#ffffff', 
        size: tamano, 
        transparent: true, 
        opacity: opacidad, 
        sizeAttenuation: true 
    });
    
    return new THREE.Points(geo, mat);
}

// Generacion de capas de estrellas, variando tamaños y cantidad
scene.add(crearCapaEstrellas(2000, 2.2, 0.4));
scene.add(crearCapaEstrellas(1500, 4.8, 0.8));
scene.add(crearCapaEstrellas(500, 8.5, 1.0));
scene.add(crearCapaEstrellas(100, 13.5, 1.0));
scene.add(crearCapaEstrellas(15, 40.5, 1.0));


// 4. MATERIALES Y GEOMETRÍAS REUTILIZABLES

// Entorno
const matSeguro = new THREE.MeshStandardMaterial({ color: '#e0dfdf', roughness: 0.5, metalness: 0.4 }); 
const matCarretera = new THREE.MeshStandardMaterial({ color: '#000000', roughness: 0.1, metalness: 0.8 }); 

// Obstáculos (Tráfico)
const geoObstaculo = new THREE.SphereGeometry(1.6, 16, 16); 
const matObstaculo = new THREE.MeshStandardMaterial({ color: '#e74c3c', visible: false});

// Jugador (Dron)
const geoDron = new THREE.BoxGeometry(1.5, 0.5, 3);
const matDron = new THREE.MeshStandardMaterial({ color: '#75b1bf', roughness: 0.3, metalness: 0.4 });

// Material Emisivo (Neón Azul) <---
const matBordeLuminoso = new THREE.MeshStandardMaterial({ 
    color: '#000000',
    emissive: '#1cecff',
    emissiveIntensity: 4.0 //
});
//SUELO
function generarSueloPlanchas(ancho, largo) {
    const grupoSuelo = new THREE.Group();

    // 1. Plancha base oscura para los surcos (las juntas de dilatación)
    const geoBase = new THREE.BoxGeometry(ancho, 0.4, largo);
    const matBase = new THREE.MeshStandardMaterial({ color: '#000000', roughness: 1.0, visible: false });
    const base = new THREE.Mesh(geoBase, matBase);
    base.position.y = 0.3; 
    base.receiveShadow = true;
    grupoSuelo.add(base);

    // 2. Material de las planchas
    const matPlancha = new THREE.MeshStandardMaterial({
        color: '#ffffff', 
        roughness: 0.5,
        metalness: 0.1 
    });
    // 3. Configuración de la cuadrícula
    const tamano = 1.5; 
    const separacion = 1.6; 
    const columnas = Math.ceil(ancho / separacion);
    const filas = Math.ceil(largo / separacion);
    const geoPlancha = new THREE.BoxGeometry(tamano, 0.2, tamano);

    // 4. Bucle para colocar las losas en una cuadrícula perfecta
    for (let row = 0; row <= filas; row++) {
        for (let col = 0; col <= columnas; col++) {
            const plancha = new THREE.Mesh(geoPlancha, matPlancha);
            // Coordenadas matemáticas simples
            let posX = (col - columnas / 2) * separacion;
            let posZ = (row - filas / 2) * separacion;
            // Recorte de bordes
            if (Math.abs(posX) < ancho/2 && Math.abs(posZ) < largo/2) {
                plancha.position.set(posX, 0.5, posZ);
                plancha.receiveShadow = true;
                // textura suelo: Aumentamos la probabilidad al 40% (0.60)
                if (Math.random() > 0.60) {
                    // Crea un relieve salvaje: entre -0.3 (hundido) y +0.2 (elevado)
                    plancha.position.y += (Math.random() * 0.5) - 0.3; 
                }

                grupoSuelo.add(plancha);
            }
        }
    }
    return grupoSuelo;
}

// 5. GENERADOR DE NIVEL Y TRÁFICO (Plataformas Flotantes)

const diseñoNivel = [
    { tipo: 'salvo', vias: 3 },     
    { tipo: 'carretera', vias: 2 }, 
    { tipo: 'salvo', vias: 2 },     
    { tipo: 'carretera', vias: 3 }, 
    { tipo: 'salvo', vias: 2 },     
    { tipo: 'carretera', vias: 4 }, 
    { tipo: 'salvo', vias: 2 },     
    { tipo: 'carretera', vias: 5 }, 
    { tipo: 'salvo', vias: 4 }      
];

diseñoNivel.forEach((bloque) => {
    const longitudBloque = bloque.vias * anchoVia;
    
if (bloque.tipo === 'salvo') {
        // suelo seguro normal
        const plataforma = generarSueloPlanchas(anchoMapa, longitudBloque);
        plataforma.position.z = posicionZActual - (longitudBloque / 2);
        scene.add(plataforma);
        // BARRERAS LUMINOSAS
        const grosorBarrera = 0.5; // Grosor del tubo
        const altoBarrera = 0.5;   // ¡EL TRUCO! Ahora es un tubo finito de 0.3 en vez de un muro de 2.0
        const geoBarrera = new THREE.BoxGeometry(grosorBarrera, altoBarrera, longitudBloque);
        
        const alturaNeon = 2.5; // Altura a la que flota (3 como pediste, o 2.5 para que quede a la altura de la nave)
        
        // Barrera Izquierda
        const barreraIzq = new THREE.Mesh(geoBarrera, matBordeLuminoso);
        barreraIzq.position.set(-anchoMapa/2 - grosorBarrera/2, alturaNeon, posicionZActual - (longitudBloque / 2));
        scene.add(barreraIzq);
        
        // Barrera Derecha
        const barreraDer = new THREE.Mesh(geoBarrera, matBordeLuminoso);
        barreraDer.position.set(anchoMapa/2 + grosorBarrera/2, alturaNeon, posicionZActual - (longitudBloque / 2));
        scene.add(barreraDer);
    
        
    } else if (bloque.tipo === 'carretera') {
        // 2. EN LAS CARRETERAS HAY "VACÍO", PERO SÍ GENERAMOS LOS ASTEROIDES
        for (let i = 0; i < bloque.vias; i++) {
            const zVia = posicionZActual - (anchoVia / 2) - (i * anchoVia);
            const direccion = i % 2 === 0 ? 1 : -1; 
            const velocidad = 0.15; 

            for(let j = 0; j < 2; j++) {
                const obs = new THREE.Mesh(geoObstaculo, matObstaculo);
                obs.position.set((Math.random() - 0.5) * anchoMapa, 1.3, zVia);
                obs.castShadow = true;
                obs.receiveShadow = true;
                scene.add(obs);
                
                obstaculos.push({ mesh: obs, vel: velocidad * direccion });
            }
        }
    }
    // 3. MUY IMPORTANTE: Siempre restamos la longitud al final.
    // Haya suelo o haya vacío, debemos dejar el hueco físico en el espacio.
    posicionZActual -= longitudBloque; 
});


// 6. CREACIÓN DEL JUGADOR Y GESTOR DE CARGAS

// 6.1. "Contenedor Lógico" vacío. mover con WASD.
const dron = new THREE.Group();
scene.add(dron);

// --- NUEVO: GESTOR DE CARGAS (Loading Manager) ---
const manager = new THREE.LoadingManager();

manager.onProgress = function (url, itemsLoaded, itemsTotal) {
    // Calculamos el porcentaje matemático
    const porcentaje = Math.floor((itemsLoaded / itemsTotal) * 100);
    const uiTextoCarga = document.getElementById('texto-carga');
    if (uiTextoCarga) {
        uiTextoCarga.innerText = "Cargando " + porcentaje + "%";
    }
};

manager.onLoad = function () {
    console.log("¡Todos los modelos 3D y texturas cargados!");
    
    // Cambiamos el texto
    const uiTextoCarga = document.getElementById('texto-carga');
    if (uiTextoCarga) uiTextoCarga.innerText = "Listo";
    
    // Hacemos aparecer el botón suavemente
    const btnEmpezar = document.getElementById('btn-empezar');
    if (btnEmpezar) {
        btnEmpezar.classList.remove('oculto');
        btnEmpezar.classList.add('visible');
    }
};


const loader = new GLTFLoader(manager);

// 6.2. Cargamos el archivo GLB
loader.load(
    'models/nave.glb',
    function (gltf) {
        const modeloNave = gltf.scene;
        modeloNave.scale.set(0.5, 0.5, 0.5); 
        modeloNave.traverse(function (nodo) {
            if (nodo.isMesh) {
                nodo.castShadow = true;
                nodo.receiveShadow = true;
            }
        });
        dron.add(modeloNave);
        console.log("¡Nave cargada con éxito!");
    }
);
// 6.3 CARGA Y CLONACIÓN DE ASTEROIDES
loader.load(
    'models/asteroide.glb', 
    function (gltf) {
        const modeloAsteroide = gltf.scene;
        obstaculos.forEach(obsObj => {
            const rocaClonada = modeloAsteroide.clone();
            rocaClonada.rotation.set(
                Math.random() * Math.PI, 
                Math.random() * Math.PI, 
                Math.random() * Math.PI
            );
            const escalaRandom = 0.015- (Math.random() * 0.002) ;
            rocaClonada.scale.set(escalaRandom, escalaRandom, escalaRandom);
            rocaClonada.traverse(function (nodo) {
                if (nodo.isMesh) {
                    nodo.castShadow = true;
                    nodo.receiveShadow = true;
                }
            });
            obsObj.mesh.add(rocaClonada);
        });
        console.log("¡Campo de asteroides generado con éxito!");
    },
    undefined,
    function (error) {
        console.error('Error cargando el asteroide:', error);
    }
);

// 7. CONTROLADORES DE EVENTOS (Inputs)
window.addEventListener('keydown', (e) => {
    const tecla = e.key.toLowerCase();
    if (teclasPulsadas.hasOwnProperty(tecla)) {
        teclasPulsadas[tecla] = true;
    }
    // Toggle de Cámara Libre
    if (tecla === 'v') {
        camaraLibre = !camaraLibre; 
        console.log(camaraLibre ? "Modo: Cámara Libre" : "Modo: Seguimiento");
    }
});

window.addEventListener('keyup', (e) => {
    const tecla = e.key.toLowerCase();
    if (teclasPulsadas.hasOwnProperty(tecla)) {
        teclasPulsadas[tecla] = false;
    }
});
let saturnoObjeto; 
loader.load(
    'models/saturn.glb', 
    function (gltf) {
        const modeloSaturno = gltf.scene;
        modeloSaturno.traverse(function (nodo) {
            if (nodo.isMesh) {
                // luminación
                nodo.material.emissive = new THREE.Color('#23180b'); 
                nodo.material.emissiveIntensity = 0.3;

                //nodo.material.transparent = false;
                //nodo.material.depthWrite = true;
                
                nodo.castShadow = true;
                nodo.receiveShadow = false;
            }
        });

        modeloSaturno.scale.set(45, 45, 45); 
        modeloSaturno.rotation.x = 6.01; 
        modeloSaturno.rotation.z = 6.01;
        modeloSaturno.position.set(-650, 0, -50); 

        // 3. AÑADIR A LA ESCENA (¡Esto te faltaba!)
        scene.add(modeloSaturno);
        saturnoObjeto = modeloSaturno; 
        console.log("¡Saturno cargado correctamente!");
    },
    undefined, 
    function (error) {
        console.error('Error cargando Saturno:', error);
    }
);

let earthObjeto; 

loader.load('models/earth.glb', 
    function (gltf) {
        const modeloEarth = gltf.scene; 

        modeloEarth.traverse(function (nodo) {
            if (nodo.isMesh) {
                nodo.material.emissive = new THREE.Color('#040404'); 
                nodo.material.emissiveIntensity = 1.5;
                
                if (nodo.material.transparent === true || nodo.material.opacity < 1.0) {
                    nodo.material.depthWrite = false;
                    nodo.material.opacity = 0.03;
                    nodo.renderOrder = 2;
                } else {
                    nodo.material.depthWrite = true;
                    nodo.renderOrder = 1;
                }
                
                nodo.castShadow = true;
                nodo.receiveShadow = false;
            }
        });

        modeloEarth.scale.set(0.2, 0.2, 0.2); 
        modeloEarth.rotation.x = 6.01; 
        modeloEarth.rotation.z = 6.01;
        modeloEarth.position.set(200, 0, 0);

        scene.add(modeloEarth);
        earthObjeto = modeloEarth; 

        console.log("¡Earth cargado con orden de profundidad perfecto!");
    }
);


const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
dracoLoader.setDecoderConfig({ type: 'js' }); 
loader.setDRACOLoader(dracoLoader);
let station1Objeto; 
loader.load('models/station1.glb', 
    function (gltf) {
        const modeloStation1 = gltf.scene; 
        modeloStation1.traverse(function (nodo) {
            if (nodo.isMesh) {
                nodo.material.emissive = new THREE.Color('#040404'); 
                nodo.material.emissiveIntensity = 1.5;
                nodo.material.transparent = true;
                nodo.material.depthWrite = true;
                nodo.castShadow = true;
                nodo.receiveShadow = false;
            }
        });
        // 1. ESCALA
        modeloStation1.scale.set(3, 3, 3); 
        // 2. POSICIÓN Y ROTACIÓN
        modeloStation1.rotation.x = 0.01; 
        modeloStation1.rotation.z = 0.01;
        modeloStation1.rotation.y = 45.01;
        modeloStation1.position.set(300, 160, -360);
        // 3. AÑADIR A LA ESCENA
        scene.add(modeloStation1);
        // 4. GUARDAR EN LA VARIABLE GLOBAL
        station1Objeto = modeloStation1; 
        console.log("¡station1 cargado correctamente!");
    }
);
let station2Objeto; 
loader.load('models/station2.glb', 
    function (gltf) {
        const modeloStation2 = gltf.scene; 
        modeloStation2.traverse(function (nodo) {
            if (nodo.isMesh) {
                nodo.material.emissive = new THREE.Color('#040404'); 
                nodo.material.emissiveIntensity = 1.5;
                nodo.material.transparent = true;
                nodo.material.depthWrite = true;
                nodo.castShadow = true;
                nodo.receiveShadow = false;
            }
        });
        // 1. ESCALA
        modeloStation2.scale.set(0.51, 0.51, 0.51); 
        // 2. POSICIÓN Y ROTACIÓN
        modeloStation2.rotation.x = 0.01; 
        modeloStation2.rotation.z = 0.01;
        modeloStation2.rotation.y = 45.01;
        modeloStation2.position.set(-100, 50, -460);
        // 3. AÑADIR A LA ESCENA
        scene.add(modeloStation2);
        // 4. GUARDAR EN LA VARIABLE GLOBAL
        station2Objeto = modeloStation2; 
        console.log("¡station2 cargado correctamente!");
    }
);

//marte
let marteObjeto; 
loader.load('models/marte.glb', 
    function (gltf) {
        const modelomarte = gltf.scene; 
        modelomarte.traverse(function (nodo) {
            if (nodo.isMesh) {
                //nodo.material.emissive = new THREE.Color('#000000'); 
                nodo.material.emissiveIntensity = 1.5;
                nodo.material.transparent = true;
                nodo.material.depthWrite = true;
                nodo.castShadow = true;
                nodo.receiveShadow = false;
            }
        });
        // 1. ESCALA
        modelomarte.scale.set(1.91, 1.91, 1.91); 
        // 2. POSICIÓN Y ROTACIÓN
        modelomarte.rotation.x = 0.01; 
        modelomarte.rotation.z = 0.01;
        modelomarte.rotation.y = 45.01;
        modelomarte.position.set(1300, 250, -560);
        // 3. AÑADIR A LA ESCENA
        scene.add(modelomarte);
        // 4. GUARDAR EN LA VARIABLE GLOBAL
        marteObjeto = modelomarte; 
        console.log("marte cargado correctamente");
    }
);
const luzmarte = new THREE.PointLight('#fefff5', 50000, 5000); 
luzmarte.position.set(900, 250, -600);
scene.add(luzmarte);
const luzmarte2 = new THREE.PointLight('#fefff5', 50000, 5000); 
luzmarte2.position.set(900, 250, -450);
scene.add(luzmarte2);
//const chivatomarte = new THREE.PointLightHelper(luzmarte, 15);
//scene.add(chivatomarte);
//skybox
let skyboxObjeto; // Variable para controlar el cielo
loader.load(
    'models/sky.glb',
    function (gltf) {
        const skybox = gltf.scene;
        skybox.scale.set(160, 160, 160);

        // --- REGULADOR DE OSCURIDAD ---
        // 1.0 = Brillo original
        // 0.5 = Mitad de oscuro
        // 0.2 = Muy oscuro (Ideal para dar protagonismo a tu pista)
        const nivelLuz = 0.09; 
        skybox.traverse(function (nodo) {
            if (nodo.isMesh) {
                // Tus configuraciones de optimización originales
                nodo.castShadow = false;
                nodo.receiveShadow = false;
                nodo.material.depthWrite = false; 
                nodo.renderOrder = -1; 
                if (nodo.material.color) {
                    nodo.material.color.setScalar(nivelLuz);
                }
                if (nodo.material.emissive) {
                    nodo.material.emissive.setScalar(nivelLuz);
                }
            }
        });

        scene.add(skybox);
        skyboxObjeto = skybox; 
        
        console.log("Skybox instalado");
    }
);

// 8. FUNCIÓN DE REINICIO TOTAL

function reiniciarJuego() {
    // 1. Resetear las variables de dificultad y estado
    nivelActual = 1;
    multiplicadorVelocidad = 0.5;
    enColision = false;
    enTransicion = false;

    // 2. Devolver la nave a la salida
    dron.position.copy(posicionInicialDron);
    dron.rotation.set(0, 0, 0);

    // 3. Restaurar los textos del HUD
    uiNivel.innerText = "LEVEL 1";
    uiVelocidad.innerText = "SPEED: 0.5x";
    uiMensaje.classList.remove('visible');
    uiMensaje.classList.add('oculto');

    // 4. Re-distribuir los asteroides al azar para que no choques nada más nacer
    obstaculos.forEach(obsObj => {
        obsObj.mesh.position.x = (Math.random() - 0.5) * anchoMapa;
    });

    console.log("Juego reiniciado manualmente");
}

btnReiniciar.addEventListener('click', reiniciarJuego);

// 9. BUCLE DE ANIMACIÓN Y FÍSICAS

const fpsElemento = document.getElementById('fps');
let ultimoTiempo = performance.now();
let fotogramas = 0;

function animate() {
    requestAnimationFrame(animate);
    
    // Calculamos el delta time al principio del frame
    const delta = clock.getDelta();

    // CÁLCULO DE FPS
    const tiempoActual = performance.now();
    fotogramas++;

    // Si ha pasado 1 segundo
    if (tiempoActual - ultimoTiempo >= 1000) {
        if (fpsElemento) fpsElemento.innerText = fotogramas; 
        fotogramas = 0; 
        ultimoTiempo = tiempoActual; 
    }
    
    dronBox.setFromObject(dron);
    if (juegoIniciado) {
        // A. Movimiento del Jugador y Estado
        if (!enColision && !enTransicion) {
            // ESTADO NORMAL VIVO Y JUGANDO
            if (teclasPulsadas.w) dron.position.z -= velocidadNave * delta;
            if (teclasPulsadas.s) dron.position.z += velocidadNave * delta;
            
            if (teclasPulsadas.a && dron.position.x > -limiteLateral) {
                dron.position.x -= velocidadNave * delta;
            }
            if (teclasPulsadas.d && dron.position.x < limiteLateral) {
                dron.position.x += velocidadNave * delta;
            }

            const efectoFlote = Math.sin(Date.now() * 0.007) * 0.05; 
            dron.position.y = alturaBase + efectoFlote;

        } else if (enColision) {
            //ESTADO CHOCADO
            dron.position.y += 5.0 * delta;
            dron.position.z += -25.0 * delta;
            dron.rotation.x += 1.0 * delta;
            dron.rotation.y += 1.0 * delta;
            dron.rotation.z += 3.0 * delta;
            
        } else if (enTransicion) {
            // ESTADO DE VICTORIA
            dron.position.z -= (velocidadNave * 0.4) * delta; 
            const efectoFlote = Math.sin(Date.now() * 0.007) * 0.05; 
            dron.position.y = alturaBase + efectoFlote;
        }

        // B. Animación del Tráfico y Detección
        obstaculos.forEach(obsObj => {
            const velocidadAsteroideBase = obsObj.vel * 200;
            
            obsObj.mesh.position.x += (velocidadAsteroideBase * multiplicadorVelocidad) * delta;

            if (obsObj.mesh.children.length > 0) {
                obsObj.mesh.children[0].rotation.y += 2.0 * delta; 
                obsObj.mesh.children[0].rotation.x += 1.0 * delta; 
            }
            
            const limiteReciclaje = (anchoMapa / 2) + 2;
            if (obsObj.mesh.position.x > limiteReciclaje) {
                obsObj.mesh.position.x = -limiteReciclaje;
            } else if (obsObj.mesh.position.x < -limiteReciclaje) {
                obsObj.mesh.position.x = limiteReciclaje;
            }
            
            // Colisiones
            if (!enColision && !enTransicion) {
                obstaculoEsfera.center.copy(obsObj.mesh.position);
                
                if (dronBox.intersectsSphere(obstaculoEsfera)) {
                    enColision = true; 
                    
                    // HUD IMPACTO
                    uiTextoMensaje.innerText = "TRY AGAIN";
                    uiTextoMensaje.style.color = "#ff0000"; 
                    uiTextoMensaje.style.textShadow = "0 0 20px #ff0000";
                    uiMensaje.classList.remove('oculto');
                    uiMensaje.classList.add('visible');

                    setTimeout(() => {
                        // HUD COLORES
                        uiTextoMensaje.style.color = "#00ffff"; 
                        uiTextoMensaje.style.textShadow = "0 0 20px #00ffff, 0 0 40px #00ffff";
                        uiMensaje.classList.remove('visible');
                        uiMensaje.classList.add('oculto');

                        dron.position.copy(posicionInicialDron); 
                        dron.rotation.set(0, 0, 0); 
                        enColision = false; 
                    }, 1000);
                }
            }
        });

        // C. Lógica de Meta (Nivel Completado)
        if (!enColision && !enTransicion && dron.position.z <= zMeta) {
            enTransicion = true; 
            
            uiTextoMensaje.innerText = "SAFE ZONE";
            uiMensaje.classList.remove('oculto');
            uiMensaje.classList.add('visible');
            
            setTimeout(() => {
                nivelActual++;
                multiplicadorVelocidad *= 1.3; 
                
                uiNivel.innerText = "LEVEL " + nivelActual;
                uiVelocidad.innerText = "SPEED: " + multiplicadorVelocidad.toFixed(1) + "x";
                
                uiMensaje.classList.remove('visible');
                uiMensaje.classList.add('oculto');
                
                dron.position.copy(posicionInicialDron);
                dron.rotation.set(0, 0, 0);
                
                enTransicion = false; 
            }, 1500); 
        }
    } 
    //animaciones rotacion
    if (typeof earthObjeto !== 'undefined' && earthObjeto) {
        earthObjeto.rotation.y += 0.1 * delta; 
    }
    if (typeof marteObjeto !== 'undefined' && marteObjeto) {
        marteObjeto.rotation.y += 0.05 * delta; 
    }

    // D. Sistema de Cámaras
    if (!camaraLibre) {
        const offset = camera.position.clone().sub(controls.target);
        controls.target.copy(dron.position); 
        camera.position.copy(dron.position).add(offset);
    } 

    // E. Renderizado Final
    controls.update(); 
    composer.render();
}

animate();
