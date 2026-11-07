/* Navega360 · Visor público. Carga tour.json y las fotografías desde la misma web. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const el=(name,cls,text)=>{const e=document.createElement(name);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
let tour=null,index=0,viewer=null;
function path(p){return new URL(p,document.baseURI).href;}
function clearViewer(){if(viewer){try{viewer.destroy();}catch(e){console.warn(e);}viewer=null;}}
function openInfo(h){$('infoTitle').textContent=h.label||'Información';$('infoText').textContent=h.body||'Sin descripción adicional.';$('infoOverlay').classList.remove('hidden');}
function activate(h){if(h.kind==='info'){openInfo(h);return;}const target=tour.scenes.findIndex(s=>s.id===h.target);if(target>=0)show(target);}
function draw(){const s=tour.scenes[index],root=$('photoStage');clearViewer();root.replaceChildren();const allSpots=Array.isArray(s.hotspots)?s.hotspots:[];
 if(s.type==='360'){
  if(!window.pannellum){root.append(el('p','error-screen','No fue posible cargar el visor panorámico. Verifica tu conexión a Internet.'));return;}
  const spots=allSpots.filter(h=>Number.isFinite(Number(h.pitch))&&Number.isFinite(Number(h.yaw))).map(h=>({id:String(h.id||''),pitch:+h.pitch,yaw:+h.yaw,cssClass:'tour-hotspot'+(h.kind==='info'?' is-info':''),createTooltipFunc:(node)=>{node.textContent=h.kind==='info'?'i':'➜';node.append(el('span','spot-label',h.label||'Explorar'));node.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();activate(h);});}}));
  try{viewer=window.pannellum.viewer(root,{type:'equirectangular',panorama:path(s.path),autoLoad:true,showZoomCtrl:true,showFullscreenCtrl:true,compass:false,hfov:100,yaw:s.initialYaw||0,pitch:s.initialPitch||0,hotSpots:spots});}catch(error){console.error(error);root.append(el('p','error-screen','No se pudo mostrar este panorama. Verifica el formato de imagen 360° equirectangular.'));}
 }else{
  const frame=el('div','flat-frame'),img=el('img');img.alt=s.title;img.src=path(s.path);img.style.maxHeight=Math.max(root.clientHeight,300)+'px';img.style.maxWidth=Math.max(root.clientWidth,300)+'px';frame.append(img);
  for(const h of allSpots){if(!Number.isFinite(Number(h.x))||!Number.isFinite(Number(h.y)))continue;const spot=el('div','flat-spot');spot.style.left=h.x+'%';spot.style.top=h.y+'%';spot.append(el('div','spot-circle'+(h.kind==='info'?' is-info':''),h.kind==='info'?'i':'➜'),el('span','spot-label',h.label||'Explorar'));spot.onclick=()=>activate(h);frame.append(spot);}root.append(frame);
 }
 $('currentName').textContent=s.title;$('currentNumber').textContent=`Escena ${index+1} de ${tour.scenes.length} · ${s.type==='360'?'Vista 360°':'Fotografía'}`;$('goBack').disabled=index===0;$('goNext').disabled=index===tour.scenes.length-1;
 document.title=`${s.title} · ${tour.title}`;document.querySelectorAll('.scene-tile').forEach((b,i)=>b.classList.toggle('current',i===index));
 $('instructions').textContent=s.type==='360'?'Arrastra para mirar alrededor · Toca los puntos para descubrir más':'Toca los puntos interactivos o utiliza las flechas para continuar';
}
function show(i){if(i<0||i>=tour.scenes.length)return;index=i;draw();$('scenePanel').classList.remove('open');}
function buildMenu(){const root=$('sceneButtons');root.replaceChildren();tour.scenes.forEach((s,i)=>{const btn=el('button','scene-tile');const img=el('img');img.src=path(s.path);img.alt='';img.loading='lazy';const txt=el('div');txt.append(el('strong',null,s.title),el('small',null,`${i+1} · ${s.type==='360'?'Vista 360°':'Fotografía'}`));btn.append(img,txt);btn.onclick=()=>show(i);root.append(btn);});}
function musicSetup(){if(!tour.music?.path)return;const audio=$('backgroundAudio'),btn=$('musicButton');audio.src=path(tour.music.path);audio.volume=.55;btn.classList.remove('hidden');btn.onclick=()=>{if(audio.paused){audio.play().then(()=>btn.querySelector('span').textContent='Pausar música').catch(()=>alert('Tu navegador no permite reproducir este archivo de audio.'));}else{audio.pause();btn.querySelector('span').textContent='Escuchar música';}};}
async function start(){try{const response=await fetch('./tour.json',{cache:'no-cache'});if(!response.ok)throw new Error('No se encontró tour.json.');tour=await response.json();if(!Array.isArray(tour.scenes)||!tour.scenes.length)throw new Error('El recorrido no contiene fotografías.');$('tourName').textContent=tour.title||'Recorrido 360°';buildMenu();musicSetup();show(0);}catch(err){console.error(err);$('photoStage').replaceChildren(el('p','error-screen','No se pudo abrir este recorrido: '+err.message+' Asegúrate de publicar el archivo tour.json y la carpeta assets junto con index.html.'));}}
$('goBack').onclick=()=>show(index-1);$('goNext').onclick=()=>show(index+1);$('sceneListToggle').onclick=()=>$('scenePanel').classList.toggle('open');$('closePanel').onclick=()=>$('scenePanel').classList.remove('open');$('fullScreen').onclick=()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.();else document.exitFullscreen?.();};$('closeInfo').onclick=$('infoOkay').onclick=()=>$('infoOverlay').classList.add('hidden');$('infoOverlay').onclick=e=>{if(e.target===$('infoOverlay'))$('infoOverlay').classList.add('hidden');};document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('scenePanel').classList.remove('open');$('infoOverlay').classList.add('hidden');}if(e.key==='ArrowRight'&&e.target.tagName!=='INPUT')show(index+1);if(e.key==='ArrowLeft'&&e.target.tagName!=='INPUT')show(index-1);});window.addEventListener('resize',()=>{if(viewer)viewer.resize();else if(tour?.scenes[index]?.type==='flat')draw();});
start();
})();
