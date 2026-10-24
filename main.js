//imports
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/loaders/GLTFLoader.js';

//Allgemein
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer(); //zum sehen der welt
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const clock = new THREE.Clock();
let delta; //zählt die Zeit seit dem letzten Frame
camera.position.z = 25;
//spieler
let playerLoaded = false;
let spielerMixer = null;
let spieler = null;
let speed = 0;
let maxSpeed = 40;
let beschleunigung = 0.1;
let richtung = new  THREE.Vector3(0, 0, 1);
let makeSpeed = true;
let spielerContainer = new THREE.Group();
let playerAlive = true;
let playerRocketSpeed = 100;
//Raketen
let zielRadius = 15;
let rockets = [];
let rocketTemplate = null;

//Asteroiden
let firstAsteroid = false;
let sichtfeldXPosition = 0;
let asteroidModell = null;
let asteroidTemplate = null;
let asteroids = [];
let lastAsteroidPos = new THREE.Vector3();
//Steuerung
let tiltX = 0;
let tiltY = 0;
let smoothX = 0;
let smoothY = 0;
let neutralX = 0;
let neutralY = 0;
let isCalibrated = false;

//Skybox
if (scene){
const loader = new THREE.CubeTextureLoader();
const textures = loader.load([
  './textures/space_ft.png',
  './textures/space_bk.png',
  './textures/space_up.png',
  './textures/space_dn.png',
  './textures/space_rt.png',
  './textures/space_lf.png'
]);
scene.background = textures;
}
//Light
function setLights() {
  if (scene) {
  // 1. Stärkeres Umgebungslicht (Grundhelligkeit erhöhen)
  const ambientLight = new THREE.AmbientLight(0x445588, 0.8); // heller & bläulicher
  scene.add(ambientLight);
  
  // 2. Hauptlicht - heller & wärmer (wie ein Stern)
  const sunLight = new THREE.DirectionalLight(0xfff5e0, 2.5); // heller & wärmer
  sunLight.position.set(10, 15, 10);
  scene.add(sunLight);
  
  // 3. Stärkeres Fülllicht von der Seite (für Konturen)
  const fillLight = new THREE.DirectionalLight(0x88aaff, 1.2); // stärker
  fillLight.position.set(-10, 5, -5);
  scene.add(fillLight);
  
  // 4. Bläuliches Licht von unten (für Atmosphäre)
  const blueLight = new THREE.DirectionalLight(0x4488ff, 0.8);
  blueLight.position.set(-5, -10, 5);
  scene.add(blueLight);
  
  // 5. Zusätzliches warmes Licht von hinten (Rim-Light)
  const rimLight = new THREE.DirectionalLight(0xffaa66, 1.0);
  rimLight.position.set(0, 5, -15);
  scene.add(rimLight);
  
  // 6. Punktlicht für Glow-Effekt (stärker)
  const glowLight = new THREE.PointLight(0xaaccff, 1.5, 100); // stärker & größere Reichweite
  glowLight.position.set(0, 0, 0);
  scene.add(glowLight);
}
}
setLights();

//Spieler Laden
const playerLoader = new GLTFLoader();
playerLoader.load('models/Player/scene.gltf', (gltf) =>{
  spieler = gltf.scene;  // wichtig speichert spieler ab damit es überall benutzt werden kann
  spielerMixer = new THREE.AnimationMixer(gltf.scene);
  gltf.animations.forEach((clip) => {
    spielerMixer.clipAction(clip).play();
  });
  spieler.rotation.y = -Math.PI / 2;
  
  spielerContainer.add(spieler);
  scene.add(spielerContainer);
  
  spielerContainer.position.set(0, 0, 0);
  spielerMixer.timeScale = 0.5;

  playerLoaded = true;
});
//Steuerung
function onTilt(event){
  if (event.beta === null || event.gamma === null) return;
  
  const isQuerformat = window.innerWidth > window.innerHeight;

  let rawX = isQuerformat ? event.beta : event.gamma;
  let rawY = isQuerformat ? event.gamma : event.beta;
  
  if(!isCalibrated){
    neutralX = rawX;
    neutralY = rawY;
    isCalibrated = true;
  }
  let x = rawX - neutralX; //berechnet Drehung von Links und Rechts
  let y = rawY - neutralY; //berechnet Drehung von Oben und Unten
  
  if(Math.abs(x) > 3) x = x - (Math.sign(x) * 3); else x = 0;//zu leichte Bewegungen werden nicht beachtet verhindert rattern
  if(Math.abs(y) > 3) y = y - (Math.sign(y) * 3);else y = 0; //abs nimmt den Betrag der Zahl //sign nimmt Vorzeichen //sorgt sorgt dafür das es sich langsam dreht und nicht springt
 
  let targetX = Math.max(-1, Math.min(1, x / 17)); //sorgt dafür das beim nach rechts(1) und links(-1) nicht zu stark ausschlägt
  let targetY = Math.max(-1, Math.min(1, y / 17)); //-1 beim hinteren Kippen→ oben fliegen + 1 beim vorderen Kippen→ unten fliegen

  smoothX += (targetX - smoothX) * 0.15;
  smoothY += (targetY - smoothY) * 0.15;

  tiltX = smoothX;
  tiltY = smoothY;
}
//Asteroiden Laden und Platz festlegen
function createAstroidTemplate() {
const asteroidLoader = new GLTFLoader(); //Loader für Asteroiden
asteroidLoader.load('models/Asteroid/asteroid.gltf', (gltf) => {
  asteroidModell = gltf.scene;
  asteroidModell.scale.set(10,10,10)
  asteroidTemplate = new THREE.Group(); //Template erstellen um dann viele zu spawen für Asteroidengürtel
  asteroidTemplate.add(asteroidModell);
});
}
createAstroidTemplate();

function setAsteroids() {
  if (!asteroidTemplate) return;
  if(asteroids.length >= 50) return;
  let asteroid = asteroidTemplate.clone();
  if(!firstAsteroid){
    asteroid.position.set(0, 0, 100);
    lastAsteroidPos.copy(asteroid.position)
    firstAsteroid = true;
  }else {
  scene.add(asteroid);
  asteroids.push(asteroid);
  let randomX = (Math.random() - 0.5)* 100; //-0,5 für Positionen -20 bis 20 
  let randomY = (Math.random() - 0.5)* 100;
  let randomZ = (Math.random() - 0.5)* 100;

  lastAsteroidPos.x += randomX;
  lastAsteroidPos.y += randomY;
  lastAsteroidPos.z += randomZ;

  asteroid.position.copy(lastAsteroidPos);
  }
  scene.add(asteroid);
  asteroids.push(asteroid);
}
//schießen
function shootPlayer() {
  const dir = new THREE.Vector3(0,0,1);
  dir.applyQuaternion(spielerContainer.quaternion);
  dir.normalize();
  
  const rocket = createRocket(spielerContainer.position,
  dir,
  spielerContainer.quaternion,
  playerRocketSpeed
  );
rockets.push(rocket);
}
 if (!rocketTemplate) {
    createRocketTemplate();
   }
 function createRocketTemplate(){
    if (!rocketTemplate) {
   const rocketLoader = new GLTFLoader();
   rocketLoader.load('models/Rocket/scene.gltf', (gltf) =>
   {
      const rocketModel = gltf.scene;
      
       rocketModel.rotation.x = Math.PI / 2;

       rocketTemplate = new THREE.Group();
       rocketTemplate.add(rocketModel);
         });
   }
 }
function createRocket(startPosition, direction, quaternion, speed){
  if (!rocketTemplate) return null; 
  const rocket = rocketTemplate.clone();
  
  rocket.position.copy(startPosition);
  rocket.position.x += direction.x * 5;
  rocket.position.y += direction.y * 5;
  rocket.position.z += direction.z * 5;
  
  rocket.quaternion.copy(quaternion);
  scene.add(rocket);
  
  return {
    mesh: rocket,
    richtung: direction.clone(),
    speed: speed,
    lebenszeit: 5
  }
}
function updateRockets(rockets) {
  for (let i = rockets.length -1; i >= 0; i--){
    const r = rockets[i];
    
    r.mesh.position.x += r.richtung.x * r.speed * delta;
    r.mesh.position.y += r.richtung.y * r.speed * delta;
    r.mesh.position.z += r.richtung.z * r.speed * delta;
    
    r.lebenszeit -= delta;
  
    if (r.lebenszeit <= 0){
      scene.remove(r.mesh);
      rockets.splice(i,1);
    }
  }
}
function checkCollisions(zielRadius){
  for(let i= asteroids.length-1; i >= 0; i--){
    let asteroid = asteroids[i];
    // Spieler wurde von Asteroiden getroffen
    const distanceToAsteroid = asteroid.position.distanceTo(spielerContainer.position);
    if(distanceToAsteroid < zielRadius){
      asteroids.splice(i,1);
      scene.remove(asteroid);
      scene.remove(spielerContainer);
      playerAlive = false;
      document.getElementById('crosshair').style.display = 'none';
      console.log("playerAlive = false");
      continue; // mach mit dem NächstemElement weiter 
    }
    
    // Hat die Rakete was getroffen
  for(let j = rockets.length-1; j >= 0; j--){
    let rocket = rockets[j]
    const distanceToRocket = asteroids[i].position.distanceTo(rocket.mesh.position);
    if (distanceToRocket < zielRadius){
      asteroids.splice(i,1);
      scene.remove(asteroid);
      rockets.splice(j,1);
      scene.remove(rocket.mesh);
      break; // beende die Schleife
      }
    }
  }
}

//Listeners
document.getElementById('fireBtn').addEventListener('pointerdown', (event) => {
  event.preventDefault(); // stoppt bei schnellem klicken das markieren oder zoomen 
  shootPlayer();
});

//Loop
function animate(time) {
  if(!playerAlive) return;
  
  requestAnimationFrame(animate); //sorgt für die regelmäßigen Aufrufe von animate
  delta = clock.getDelta();
  
  // Gas / Bremse
  if (makeSpeed) {
    speed += beschleunigung * delta * 60;
    if (speed > maxSpeed) speed = maxSpeed;
  }
    
    //Bewegung, Rotation und Richtung
if(playerLoaded){
    spielerContainer.rotateY(-tiltX * 0.7 * delta);
    spielerContainer.rotateX(-tiltY * 0.7 * delta);
    
    richtung.set(0, 0, 1);
    richtung.applyQuaternion(spielerContainer.quaternion);
    richtung.normalize();

    spielerContainer.position.x += richtung.x * speed * delta;
    spielerContainer.position.y += richtung.y * speed * delta;
    spielerContainer.position.z += richtung.z * speed * delta;
}
  
  //Animation
  if (spielerMixer) {
    spielerMixer.timeScale = 0.3 + speed * 0.001;
    spielerMixer.update(delta);
  }
           
  //Kamera (Container!)
  if (spielerContainer) {
    const offset = new THREE.Vector3(0, 10, -50).applyQuaternion(spielerContainer.quaternion);
    camera.position.copy(spielerContainer.position).add(offset);
    camera.up.set(0,1,0).applyQuaternion(spielerContainer.quaternion);
    camera.lookAt(spielerContainer.position);
  }
  //Raketen
  updateRockets(rockets);
  
  //Asteroiden
setAsteroids();
  //Kollisionenüberprüfen
checkCollisions(zielRadius);
  
  //rendern: zeichnen der Scene
  renderer.render(scene, camera);
}

//starten des Spiels
document.getElementById('startBtn').addEventListener('click', async () => {
  try{
    //Vollbild anfordern
    await document.documentElement.requestFullscreen();
    await new Promise((resolve) => { //das Promise paussiert den Code bis resolve Bescheid gibt
      if (document.fullscreenElement) return resolve(); //wenn Handy bereits Vollbild das mach sofort weiter also kein resolve
      document.addEventListener('fullscreenchange', resolve, {once: true}); //wenn fullscreenchange(Vollbild) aktiviert wird resolve aufgerufen
    }); //once sorgt dafür das der Listener nach verwendung gelöscht wird => keine Zumüllung des Speichers
    if (screen.orientation && screen.orientation.lock){ //sicherheitscheck für iOS ob der Browser die Funktion kennt
      await screen.orientation.lock('landscape'); //jetzt ins querformat
    }
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight; //neue Berechnung des Sichtfelds der Kamera da querformat
      camera.updateProjectionMatrix(); //3D-Perspektive wird neu Berechnet damit Bild nicht gestreckt
      renderer.setSize(window.innerWidth, window.innerHeight); // Zeichenfläche bekommt neue Größe
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    });
  } catch (error){
    alert("Bitte halte dein Handy im Querformat");
  }

  //Sensor Berechtigung anfordern
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function'){
try{
  const state = await DeviceOrientationEvent.requestPermission();
    if ( state === 'granted'){ 
      window.addEventListener('deviceorientation', onTilt); //für iOS
}
}catch(error){
  alert("Zugriff auf den Sensor wurde verweigert");                                       
  }
}else {
 window.addEventListener('deviceorientation', onTilt); //für Android
}
//Startbildschirm ausblenden
document.getElementById('startScreen').style.display = 'none';
//Steuerkreuz anzeigen
document.getElementById('crosshair').style.display = 'block';d
//Kalibrierung zurücksetzen und Spiel starten
isCalibrated = false;
animate();
});
