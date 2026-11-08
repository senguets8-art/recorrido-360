/* Navega360 · Visor público. Carga tour.json y las fotografías desde la misma web. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const el=(name,cls,text)=>{const e=document.createElement(name);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
let tour=null,index=0,viewer=null;
function path(p){const u=new URL(p,document.baseURI);if(!['https:','http:'].includes(u.protocol))throw new Error('URL no permitida.');return u.href;}
function iconText(h){return h.kind==='info'?'i':h.kind==='web'?'↗':'➜';}
function cleanWebURL(raw){const value=String(raw||'').trim();if(!value)return null;try{const url=new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value)?value:'https://'+value);return ['http:','https:'].includes(url.protocol)&&url.hostname?url.href:null;}catch{return null;}}
function fillHotspotFace(node,h){node.replaceChildren();node.style.setProperty('--spot-size',Math.min(110,Math.max(28,Number(h.iconSize)||46))+'px');const custom=typeof h.iconPath==='string'&&(/^assets\/[a-zA-Z0-9._-]+$/.test(h.iconPath)||/^https:\/\//i.test(h.iconPath));node.classList.toggle('custom-image',custom);if(custom){const img=el('img','hotspot-custom-icon');img.alt='';img.src=path(h.iconPath);img.draggable=false;node.append(img);}else node.append(document.createTextNode(iconText(h)));}
function clearViewer(){if(viewer){try{viewer.destroy();}catch(e){console.warn(e);}viewer=null;}}
function openInfo(h){$('infoTitle').textContent=h.label||'Información';$('infoText').textContent=h.body||'Sin descripción adicional.';$('infoOverlay').classList.remove('hidden');}
function activate(h){if(h.kind==='info'){openInfo(h);return;}if(h.kind==='web'){const url=cleanWebURL(h.url);if(!url){alert('Este enlace web no está configurado correctamente.');return;}if(h.newTab!==false)window.open(url,'_blank','noopener,noreferrer');else window.location.assign(url);return;}const target=tour.scenes.findIndex(s=>s.id===h.target);if(target>=0)show(target);}
function draw(){const s=tour.scenes[index],root=$('photoStage');clearViewer();root.replaceChildren();const allSpots=Array.isArray(s.hotspots)?s.hotspots:[];
 if(s.type==='360'){
  if(!window.pannellum){root.append(el('p','error-screen','No fue posible cargar el visor panorámico. Verifica tu conexión a Internet.'));return;}
  const spots=allSpots.filter(h=>Number.isFinite(Number(h.pitch))&&Number.isFinite(Number(h.yaw))).map(h=>({id:String(h.id||''),pitch:+h.pitch,yaw:+h.yaw,cssClass:'tour-hotspot'+(h.kind==='info'?' is-info':'')+(h.kind==='web'?' is-web':''),createTooltipFunc:(node)=>{fillHotspotFace(node,h);node.append(el('span','spot-label',h.label||'Explorar'));node.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();activate(h);});}}));
  try{viewer=window.pannellum.viewer(root,{type:'equirectangular',panorama:path(s.path),autoLoad:true,showZoomCtrl:true,showFullscreenCtrl:true,compass:false,hfov:100,yaw:s.initialYaw||0,pitch:s.initialPitch||0,hotSpots:spots});}catch(error){console.error(error);root.append(el('p','error-screen','No se pudo mostrar este panorama. Verifica el formato de imagen 360° equirectangular.'));}
 }else{
  const frame=el('div','flat-frame'),img=el('img');img.alt=s.title;img.src=path(s.path);img.style.maxHeight=Math.max(root.clientHeight,300)+'px';img.style.maxWidth=Math.max(root.clientWidth,300)+'px';frame.append(img);
  for(const h of allSpots){if(!Number.isFinite(Number(h.x))||!Number.isFinite(Number(h.y)))continue;const spot=el('div','flat-spot');spot.style.left=h.x+'%';spot.style.top=h.y+'%';const face=el('div','spot-circle'+(h.kind==='info'?' is-info':'')+(h.kind==='web'?' is-web':''));fillHotspotFace(face,h);spot.append(face,el('span','spot-label',h.label||'Explorar'));spot.onclick=()=>activate(h);frame.append(spot);}root.append(frame);
 }
 $('currentName').textContent=s.title;$('currentNumber').textContent=`Escena ${index+1} de ${tour.scenes.length} · ${s.type==='360'?'Vista 360°':'Fotografía'}`;$('goBack').disabled=index===0;$('goNext').disabled=index===tour.scenes.length-1;
 document.title=`${s.title} · ${tour.title}`;document.querySelectorAll('.scene-tile').forEach((b,i)=>b.classList.toggle('current',i===index));
 $('instructions').textContent=s.type==='360'?'Arrastra para mirar alrededor · Toca los puntos para descubrir más':'Toca los puntos interactivos o utiliza las flechas para continuar';
}
function show(i){if(i<0||i>=tour.scenes.length)return;index=i;draw();$('scenePanel').classList.remove('open');}
function buildMenu(){const root=$('sceneButtons');root.replaceChildren();tour.scenes.forEach((s,i)=>{const btn=el('button','scene-tile');const img=el('img');img.src=path(s.path);img.alt='';img.loading='lazy';const txt=el('div');txt.append(el('strong',null,s.title),el('small',null,`${i+1} · ${s.type==='360'?'Vista 360°':'Fotografía'}`));btn.append(img,txt);btn.onclick=()=>show(i);root.append(btn);});}
// Inicia la música cuando el navegador lo permita. Cuando bloquea sonido automático,
// espera la primera interacción real del visitante y mantiene el audio en bucle.
let musicPausedByVisitor=false;
function musicPrompt(show,message){
 const prompt=$('musicPrompt');
 if(message)$('musicPromptText').textContent=message;
 prompt.classList.toggle('hidden',!show);
}
function musicLabel(){
 const audio=$('backgroundAudio');
 $('musicButton').querySelector('span').textContent=audio.paused?'Escuchar música':'Pausar música';
 $('musicButton').setAttribute('aria-pressed',String(!audio.paused));
}
function tryMusicStart(){
 const audio=$('backgroundAudio');
 if(!tour?.music?.path || musicPausedByVisitor || !audio.paused)return;
 let attempt;
 try{attempt=audio.play();}catch(e){musicPrompt(true,'Toca «Activar música» para escucharla durante el recorrido.');return;}
 if(attempt?.then)attempt.then(()=>{musicPrompt(false);musicLabel();}).catch(error=>{
  musicLabel();
  if(error?.name==='NotAllowedError')musicPrompt(true,'Tu navegador necesita un toque para iniciar la música. Se repetirá automáticamente.');
  else if(error?.name!=='AbortError')musicPrompt(true,'No se pudo reproducir automáticamente. Pulsa para intentar activar el audio.');
 });
}
function musicSetup(){
 if(!tour.music?.path)return;
 const audio=$('backgroundAudio'),btn=$('musicButton');
 audio.src=path(tour.music.path);
 audio.loop=true;
 audio.preload='auto';
 audio.volume=.55;
 btn.classList.remove('hidden');
 musicPausedByVisitor=false;
 audio.addEventListener('play',()=>{musicPrompt(false);musicLabel();});
 audio.addEventListener('pause',musicLabel);
 btn.onclick=()=>{
  if(audio.paused){musicPausedByVisitor=false;tryMusicStart();}
  else{musicPausedByVisitor=true;audio.pause();musicPrompt(false);}
 };
 $('musicStartButton').onclick=()=>{musicPausedByVisitor=false;tryMusicStart();};
 // Si la reproducción directa está bloqueada, el primer clic o toque inicia el audio.
 // No interferimos con el botón de pausa ni con el botón específico para activar música.
 const unlock=e=>{
  if(musicPausedByVisitor || !audio.paused || e.target.closest?.('#musicButton,#musicStartButton'))return;
  tryMusicStart();
 };
 document.addEventListener('pointerdown',unlock,{capture:true});
 document.addEventListener('keydown',e=>{
  if(e.key==='Enter'||e.key===' '||e.key==='ArrowLeft'||e.key==='ArrowRight')unlock(e);
 },{capture:true});
 musicLabel();
 // Muchos navegadores lo bloquean por sus políticas de reproducción automática.
 // El intento es real, pero nunca prometemos audio sin interacción en todos ellos.
 tryMusicStart();
}
async function start(){try{const id=new URLSearchParams(location.search).get('tour')||(location.pathname.match(/^\/ver\/([a-z0-9-]{8,80})\/?$/)||[])[1];if(!id || !/^[a-z0-9-]{8,80}$/.test(id))throw new Error('Este enlace no contiene un recorrido válido.');const response=await fetch('/api/tour?id='+encodeURIComponent(id),{cache:'no-store'});if(!response.ok)throw new Error('No se encontró el recorrido publicado.');tour=await response.json();if(!Array.isArray(tour.scenes)||!tour.scenes.length)throw new Error('El recorrido no contiene fotografías.');$('tourName').textContent=tour.title||'Recorrido 360°';buildMenu();musicSetup();show(0);}catch(err){console.error(err);$('photoStage').replaceChildren(el('p','error-screen','No se pudo abrir este recorrido: '+err.message+' Pide al administrador que publique de nuevo el recorrido.'));}}
$('goBack').onclick=()=>show(index-1);$('goNext').onclick=()=>show(index+1);$('sceneListToggle').onclick=()=>$('scenePanel').classList.toggle('open');$('closePanel').onclick=()=>$('scenePanel').classList.remove('open');$('fullScreen').onclick=()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.();else document.exitFullscreen?.();};$('closeInfo').onclick=$('infoOkay').onclick=()=>$('infoOverlay').classList.add('hidden');$('infoOverlay').onclick=e=>{if(e.target===$('infoOverlay'))$('infoOverlay').classList.add('hidden');};document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('scenePanel').classList.remove('open');$('infoOverlay').classList.add('hidden');}if(e.key==='ArrowRight'&&e.target.tagName!=='INPUT')show(index+1);if(e.key==='ArrowLeft'&&e.target.tagName!=='INPUT')show(index-1);});window.addEventListener('resize',()=>{if(viewer)viewer.resize();else if(tour?.scenes[index]?.type==='flat')draw();});
start();
})();
