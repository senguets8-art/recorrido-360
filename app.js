/* Navega360 Studio · Editor estático de recorridos 360°
 * Archivos y escenas permanecen en IndexedDB. No hay servidores de carga.
 */
(() => {
'use strict';
const $ = (id) => document.getElementById(id);
const emptyPanel = $('emptyState');
const DB_NAME = 'navega360-studio-v1';
const blank = () => ({version:1,title:'Mi recorrido virtual',scenes:[],music:null});
const uid = () => (crypto?.randomUUID?.() || 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2));
const slug = (s) => String(s||'recorrido').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,65) || 'recorrido';
const clone = (v) => JSON.parse(JSON.stringify(v));
let db, data=blank(), media=new Map(), currentId=null, selectedSpotId=null, activeTool=null;
let editorViewer=null, previewViewer=null, previewIndex=0, previewVisible=false;
let audio=null, saveTimeout=null, toastTimeout=null, rerenderTimeout=null, syncing=false;
const getCurrent = () => data.scenes.find(s=>s.id===currentId)||null;
const getSelectedSpot = () => getCurrent()?.hotspots.find(s=>s.id===selectedSpotId)||null;
const asset = (id) => media.get(id);
const imageURL = (id) => asset(id)?.url || '';
const iconSize = (hs) => Math.min(110,Math.max(28,Number(hs.iconSize)||46));
const iconText = (hs) => hs.kind==='info'?'i':hs.kind==='web'?'↗':'➜';
function cleanWebURL(raw){const value=String(raw||'').trim();if(!value)return null;try{const url=new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value)?value:'https://'+value);if(!['http:','https:'].includes(url.protocol)||!url.hostname)return null;return url.href;}catch{return null;}}
function isImageFile(file){return !!file && ['image/png','image/jpeg','image/webp','image/gif','image/avif'].includes(file.type || '') && /\.(png|jpe?g|webp|gif|avif)$/i.test(file.name);}
function imageMime(path){const ext=String(path).split('.').pop()?.toLowerCase();return ({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',avif:'image/avif'})[ext]||'';}
function fillHotspotFace(node,hs,iconSrc){node.replaceChildren();node.style.setProperty('--spot-size',iconSize(hs)+'px');node.classList.toggle('custom-image',!!iconSrc);if(iconSrc){const pic=el('img',{class:'hotspot-custom-icon',alt:''});pic.src=iconSrc;pic.draggable=false;node.append(pic);}else{node.append(document.createTextNode(iconText(hs)));}}
function openWebHotspot(hs){const url=cleanWebURL(hs.url);if(!url){notify('Este hotspot no tiene un enlace web válido. Pega una dirección como https://maps.google.com/');return;}if(hs.newTab!==false){window.open(url,'_blank','noopener,noreferrer');}else{window.location.assign(url);}}

function notify(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('show'),3400);}
function status(msg){$('saveStatus').textContent=msg;}
function database(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains('config'))d.createObjectStore('config');if(!d.objectStoreNames.contains('assets'))d.createObjectStore('assets');};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function transact(store,mode,fn){return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode);const request=fn(tx.objectStore(store));if(request){request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);}else{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);}});}
async function saveMeta(){if(!db || syncing)return;try{await transact('config','readwrite',os=>os.put(clone(data),'tour'));status('Cambios guardados en este navegador.');}catch(err){console.error(err);status('No se pudo guardar. Exporta el ZIP como respaldo.');notify('El navegador no permitió guardar los cambios.');}}
function scheduleSave(){status('Guardando cambios…');clearTimeout(saveTimeout);saveTimeout=setTimeout(()=>saveMeta(),450);}
async function saveAsset(id,blob,name){await transact('assets','readwrite',os=>os.put({blob,name},id));registerAsset(id,blob,name);}
function registerAsset(id,blob,name){const old=media.get(id);if(old)URL.revokeObjectURL(old.url);media.set(id,{blob,name,url:URL.createObjectURL(blob)});}
async function deleteAsset(id){if(!id)return;const stillUsed=data.scenes.some(s=>s.assetId===id || s.hotspots?.some(h=>h.iconAssetId===id))||data.music?.assetId===id;if(stillUsed)return;try{await transact('assets','readwrite',os=>os.delete(id));}catch(err){console.warn(err);}if(media.get(id))URL.revokeObjectURL(media.get(id).url);media.delete(id);}
async function restore(){db=await database();const saved=await transact('config','readonly',os=>os.get('tour'));if(saved&&Array.isArray(saved.scenes)){data=saved;data.music??=null;}const ids=new Set(data.scenes.flatMap(s=>[s.assetId,...(s.hotspots||[]).map(h=>h.iconAssetId).filter(Boolean)]).concat(data.music?.assetId||[]));for(const id of ids){const item=await transact('assets','readonly',os=>os.get(id));if(item?.blob)registerAsset(id,item.blob,item.name);}currentId=data.scenes[0]?.id||null;renderEverything();status('Cambios guardados en este navegador.');}

function el(tag,attrs={},content=''){const n=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k==='class')n.className=v;else if(k==='title')n.title=v;else if(k==='style')n.style.cssText=v;else n.setAttribute(k,v);}if(content)n.textContent=content;return n;}
function getDimensions(blob){return new Promise(resolve=>{const url=URL.createObjectURL(blob);const img=new Image();img.onload=()=>{resolve({w:img.naturalWidth,h:img.naturalHeight});URL.revokeObjectURL(url)};img.onerror=()=>{resolve({w:0,h:0});URL.revokeObjectURL(url)};img.src=url;});}
async function addImages(list){const files=[...list].filter(f=>f.type.startsWith('image/')||/\.(jpg|jpeg|png|webp|avif)$/i.test(f.name));if(!files.length){notify('Selecciona fotografías JPG, PNG o WEBP.');return;}const initial=data.scenes.length===0;for(let i=0;i<files.length;i++){const file=files[i],id=uid(),sceneId=uid();const d=await getDimensions(file);let type=(d.w&&d.h&&Math.abs(d.w/d.h-2)<.2)?'360':'flat';if(initial && (i===0||i===files.length-1))type='flat';await saveAsset(id,file,file.name);data.scenes.push({id:sceneId,title:file.name.replace(/\.[^/.]+$/,'').replace(/[_-]/g,' ')||'Nueva escena',type,assetId:id,originalName:file.name,initialYaw:0,initialPitch:0,hotspots:[]});if(file.size>25*1024*1024)notify('Una imagen supera 25 MB: GitHub puede requerir Git LFS o reducir su tamaño.');}if(!currentId)currentId=data.scenes[0]?.id;activeTool=null;selectedSpotId=null;renderEverything();scheduleSave();notify(`${files.length} fotografía${files.length>1?'s':''} agregada${files.length>1?'s':''}.`);}
function moveScene(id,delta){const i=data.scenes.findIndex(s=>s.id===id),j=i+delta;if(i<0||j<0||j>=data.scenes.length)return;[data.scenes[i],data.scenes[j]]=[data.scenes[j],data.scenes[i]];renderEverything();scheduleSave();}
async function removeScene(){const scene=getCurrent();if(!scene||!confirm(`¿Eliminar la escena «${scene.title}» y sus puntos?`))return;const i=data.scenes.indexOf(scene),icons=scene.hotspots.map(h=>h.iconAssetId).filter(Boolean);data.scenes.splice(i,1);for(const s of data.scenes){const removed=s.hotspots.filter(h=>h.kind==='link'&&h.target===scene.id);icons.push(...removed.map(h=>h.iconAssetId).filter(Boolean));s.hotspots=s.hotspots.filter(h=>!(h.kind==='link'&&h.target===scene.id));}currentId=data.scenes[Math.min(i,data.scenes.length-1)]?.id||null;selectedSpotId=null;activeTool=null;await deleteAsset(scene.assetId);for(const icon of icons)await deleteAsset(icon);renderEverything();scheduleSave();notify('Escena eliminada.');}
function selectScene(id){if(!data.scenes.some(s=>s.id===id))return;currentId=id;selectedSpotId=null;activeTool=null;renderEverything();}
function renderSceneList(){const list=$('sceneList');list.replaceChildren();$('sceneCount').textContent=data.scenes.length;for(const [i,s] of data.scenes.entries()){const row=el('div',{class:'scene-card'+(s.id===currentId?' active':'')});const thumb=el('img',{class:'scene-thumb',alt:''});thumb.src=imageURL(s.assetId);const box=el('div',{class:'scene-info'});box.append(el('span',{class:'scene-index'},'ESCENA '+String(i+1).padStart(2,'0')),el('strong',{},s.title),el('small',{},s.type==='360'?'◉ Vista panorámica 360°':'▧ Imagen normal'));row.append(thumb,box);const controls=el('div',{class:'reorder'});const up=el('button',{title:'Mover escena hacia arriba','aria-label':'Subir'},'↑'),down=el('button',{title:'Mover escena hacia abajo','aria-label':'Bajar'},'↓');up.disabled=i===0;down.disabled=i===data.scenes.length-1;up.onclick=e=>{e.stopPropagation();moveScene(s.id,-1);};down.onclick=e=>{e.stopPropagation();moveScene(s.id,1);};controls.append(up,down);row.append(controls);row.onclick=()=>selectScene(s.id);list.append(row);}}
function renderProperties(){const scene=getCurrent();$('noSelection').classList.toggle('hidden',!!scene);$('sceneProperties').classList.toggle('hidden',!scene);if(!scene)return;$('sceneTitle').value=scene.title;$('sceneType').value=scene.type;$('sceneFilename').textContent=scene.originalName||asset(scene.assetId)?.name||'Sin archivo';renderSpotList();renderSpotEditor();}
function renderSpotList(){const scene=getCurrent(),container=$('spotList');container.replaceChildren();$('spotCount').textContent=scene?.hotspots.length||0;if(!scene?.hotspots.length){container.append(el('p',{class:'no-spots'},'Aún no hay puntos. Usa Escena, Sitio web o Información sobre la imagen.'));return;}for(const hs of scene.hotspots){const row=el('button',{class:'spot-row'+(hs.id===selectedSpotId?' active':'')});const avatar=el('span',{class:'spot-indicator'+(hs.kind==='info'?' info':'')+(hs.kind==='web'?' web':'')});const custom=imageURL(hs.iconAssetId);if(custom){avatar.classList.add('icon-avatar');const img=el('img',{alt:''});img.src=custom;avatar.append(img);}else avatar.textContent=iconText(hs);row.append(avatar,el('span',{},hs.label||'Punto sin nombre'));row.onclick=()=>{selectedSpotId=hs.id;activeTool=null;renderSpotList();renderSpotEditor();updateToolUI();renderSurface('editor',true);};container.append(row);}}
function renderSpotEditor(){const spot=getSelectedSpot(),scene=getCurrent();$('hotspotEditor').classList.toggle('hidden',!spot);if(!spot||!scene)return;$('spotHeading').textContent=spot.kind==='info'?'Punto informativo':spot.kind==='web'?'Enlace a sitio web':'Punto de navegación';$('spotLabel').value=spot.label||'';$('spotKind').value=['link','info','web'].includes(spot.kind)?spot.kind:'link';$('destinationField').classList.toggle('hidden',spot.kind!=='link');$('webField').classList.toggle('hidden',spot.kind!=='web');$('infoField').classList.toggle('hidden',spot.kind!=='info');$('spotInfo').value=spot.body||'';$('spotURL').value=spot.url||'';$('spotNewTab').checked=spot.newTab!==false;const dest=$('spotDestination');dest.replaceChildren();dest.append(el('option',{value:''},'Seleccionar destino…'));for(const s of data.scenes){if(s.id===scene.id)continue;dest.append(el('option',{value:s.id},s.title));}dest.value=spot.target||'';const iconPreview=$('spotIconPreview');iconPreview.replaceChildren();const custom=imageURL(spot.iconAssetId);iconPreview.classList.toggle('uploaded',!!custom);if(custom){const pic=el('img',{alt:'Imagen personalizada actual'});pic.src=custom;iconPreview.append(pic);}else iconPreview.textContent=iconText(spot);$('btnRemoveSpotIcon').classList.toggle('hidden',!custom);$('spotIconSize').value=iconSize(spot);$('spotIconSizeText').textContent=iconSize(spot)+' px';$('spotCoords').textContent=scene.type==='360'?`Posición: horizontal ${Number(spot.yaw??0).toFixed(1)}°, vertical ${Number(spot.pitch??0).toFixed(1)}°`:`Posición: X ${Math.round(spot.x??50)}%, Y ${Math.round(spot.y??50)}%`;}
function renderEverything(){renderSceneList();renderProperties();renderToolbar();renderSurface('editor');$('tourTitle').value=data.title||'';$('musicName').textContent=data.music?.name||'Sin archivo de audio';$('btnRemoveMusic').classList.toggle('hidden',!data.music);}
function renderToolbar(){const scene=getCurrent(),index=data.scenes.indexOf(scene);$('currentLabel').textContent=scene?.title||'Sin escena seleccionada';$('currentTypeBadge').textContent=scene?(scene.type==='360'?'360°':'NORMAL'):'';$('currentTypeBadge').style.display=scene?'':'none';$('positionLabel').textContent=scene?`${index+1} / ${data.scenes.length}`:'0 / 0';$('prevScene').disabled=index<=0;$('nextScene').disabled=index<0||index===data.scenes.length-1;for(const id of ['btnNewNav','btnNewWeb','btnNewInfo','btnMoveSpot','btnSaveView'])$(id).disabled=!scene || (id==='btnMoveSpot'&&!getSelectedSpot()) || (id==='btnSaveView'&&scene.type!=='360');updateToolUI();}
function updateToolUI(){const map={btnNewNav:'link',btnNewWeb:'web',btnNewInfo:'info',btnMoveSpot:'move'};for(const [id,type] of Object.entries(map))$(id).classList.toggle('active',activeTool===type);$('stageHint').classList.toggle('hidden',!activeTool);$('stageHint').textContent=activeTool==='link'?'Selecciona dónde colocar el enlace a una escena · Esc para cancelar':activeTool==='web'?'Selecciona dónde colocar el enlace web · Esc para cancelar':activeTool==='info'?'Selecciona dónde colocar el punto informativo · Esc para cancelar':activeTool==='move'?'Haz clic en la nueva ubicación del punto · Esc para cancelar':'';}
function setTool(type){if(!getCurrent())return;if(type==='move'&&!getSelectedSpot()){notify('Selecciona un punto de la lista para moverlo.');return;}activeTool=activeTool===type?null:type;updateToolUI();}
function destroyViewer(kind){const p=kind==='preview'?previewViewer:editorViewer;if(p){try{p.destroy();}catch(e){console.warn(e);}if(kind==='preview')previewViewer=null;else editorViewer=null;}}
function makeSpotButton(hs,isSelected,visit){const circle=el('span',{class:'spot-circle'+(hs.kind==='info'?' is-info':'')+(hs.kind==='web'?' is-web':'')+(isSelected?' spot-selected':'')});fillHotspotFace(circle,hs,imageURL(hs.iconAssetId));const tooltip=el('span',{class:'hot-tooltip'},hs.label||'Punto interactivo');const holder=el('div',{class:'flat-spot'});holder.title=hs.label||'Punto interactivo';holder.append(circle,tooltip);holder.onclick=e=>{e.stopPropagation();visit(hs);};return holder;}
function handleSpotClick(hs,preview){if(preview){if(hs.kind==='web'){openWebHotspot(hs);}else if(hs.kind==='link'){if(!hs.target){notify('Este punto aún no tiene una escena de destino.');return;}const i=data.scenes.findIndex(s=>s.id===hs.target);if(i>=0){previewIndex=i;renderSurface('preview');}}else showInfo(hs.label,hs.body);return;}if(activeTool)return;selectedSpotId=hs.id;renderSpotList();renderSpotEditor();renderToolbar();renderSurface('editor',true);}
function showInfo(title,body){const box=el('div',{class:'visitor-info'});box.append(el('button',{class:'info-close','aria-label':'Cerrar información'},'✕'),el('h2',{},title||'Información'),el('p',{},body||'Sin descripción adicional.'));const backdrop=el('div',{class:'visitor-overlay'});backdrop.append(box);backdrop.onclick=e=>{if(e.target===backdrop)backdrop.remove();};box.querySelector('button').onclick=()=>backdrop.remove();$('preview').append(backdrop);}
function placePoint(event, scene, position){if(previewVisible||!activeTool||!scene||scene.id!==currentId)return;if(activeTool==='move'){const hs=getSelectedSpot();if(!hs)return;Object.assign(hs,position);notify('Punto reubicado.');}else{const kind=activeTool;const hs={id:uid(),kind,label:kind==='info'?'Más información':kind==='web'?'Abrir página web':'Ir a otra escena',body:'',target:'',url:'',newTab:true,iconAssetId:null,iconSize:46,...position};if(kind==='link'){const i=data.scenes.findIndex(s=>s.id===scene.id);hs.target=data.scenes[i+1]?.id||data.scenes.find(s=>s.id!==scene.id)?.id||'';}scene.hotspots.push(hs);selectedSpotId=hs.id;notify('Punto agregado. Configura sus propiedades a la derecha.');}activeTool=null;renderSpotList();renderSpotEditor();renderToolbar();renderSurface('editor',true);scheduleSave();}
function renderSurface(kind,preserve=false){const preview=kind==='preview',root=preview?$('previewStage'):$('stage');const scene=preview?data.scenes[previewIndex]:getCurrent();let oldView=null;const old=preview?previewViewer:editorViewer;if(old && preserve && scene?.type==='360'){try{oldView={yaw:old.getYaw(),pitch:old.getPitch(),hfov:old.getHfov()};}catch(e){}}
 destroyViewer(kind);root.onclick=null;root.replaceChildren();if(!scene){if(!preview)root.append(emptyPanel);return;}
 const source=imageURL(scene.assetId);if(!source){root.append(el('p',{class:'missing-asset'},'No encontramos el archivo de esta escena. Importa tu ZIP de respaldo.'));return;}
 if(scene.type==='flat'){
   const frame=el('div',{class:'flat-frame'}),img=el('img',{alt:scene.title});img.src=source;img.style.maxHeight=Math.max(root.clientHeight,300)+'px';img.style.maxWidth=Math.max(root.clientWidth,300)+'px';frame.append(img);for(const hs of scene.hotspots){if(!Number.isFinite(Number(hs.x))||!Number.isFinite(Number(hs.y)))continue;const btn=makeSpotButton(hs,!preview&&hs.id===selectedSpotId,(hot)=>handleSpotClick(hot,preview));btn.style.left=hs.x+'%';btn.style.top=hs.y+'%';frame.append(btn);}if(!preview){frame.onclick=e=>{if(!activeTool)return;const rect=img.getBoundingClientRect();const x=Math.max(0,Math.min(100,(e.clientX-rect.left)*100/rect.width));const y=Math.max(0,Math.min(100,(e.clientY-rect.top)*100/rect.height));if(Number.isFinite(x)&&Number.isFinite(y))placePoint(e,scene,{x:Math.round(x*100)/100,y:Math.round(y*100)/100});};}root.append(frame);
 }else{
  if(!window.pannellum){root.append(el('p',{class:'missing-asset'},'No se pudo cargar el visor 360°. Comprueba que tienes conexión a Internet.'));return;}
  const panoSpots=scene.hotspots.filter(h=>Number.isFinite(Number(h.pitch))&&Number.isFinite(Number(h.yaw))).map(hs=>({id:hs.id,pitch:hs.pitch,yaw:hs.yaw,cssClass:'tour-hotspot'+(hs.kind==='info'?' is-info':'')+(hs.kind==='web'?' is-web':'')+(!preview&&hs.id===selectedSpotId?' spot-selected':''),createTooltipFunc:(element)=>{fillHotspotFace(element,hs,imageURL(hs.iconAssetId));const tooltip=el('span',{class:'hot-tooltip'},hs.label||'Punto interactivo');element.append(tooltip);element.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();handleSpotClick(hs,preview);});}}));
  try{const p=window.pannellum.viewer(root,{type:'equirectangular',panorama:source,autoLoad:true,showZoomCtrl:true,showFullscreenCtrl:true,compass:false,keyboardZoom:true,hfov:oldView?.hfov||100,yaw:oldView?.yaw??scene.initialYaw??0,pitch:oldView?.pitch??scene.initialPitch??0,hotSpots:panoSpots});if(preview)previewViewer=p;else editorViewer=p;}catch(error){console.error(error);root.append(el('p',{class:'missing-asset'},'No se pudo abrir esta panorámica. Comprueba el formato equirectangular.'));return;}
  if(!preview){root.onclick=function onClick(e){if(!activeTool||e.target.closest('.pnlm-hotspot-base'))return;const p=editorViewer;if(!p)return;try{const coords=p.mouseEventToCoords(e);if(coords&&coords.length===2&&coords.every(Number.isFinite))placePoint(e,scene,{pitch:+coords[0].toFixed(2),yaw:+coords[1].toFixed(2)});}catch(err){console.warn(err);}};}
 }
 if(preview){$('previewTitle').textContent=scene.title;$('previewPosition').textContent=`Escena ${previewIndex+1} de ${data.scenes.length}`;$('previewPrev').disabled=previewIndex===0;$('previewNext').disabled=previewIndex===data.scenes.length-1;}
}
async function setMusic(file){if(!file)return;if(!(file.type.startsWith('audio/')||/\.(mp3|wav|ogg|m4a)$/i.test(file.name))){notify('Selecciona un archivo de audio compatible.');return;}const old=data.music?.assetId,id=uid();await saveAsset(id,file,file.name);data.music={assetId:id,name:file.name};if(old)await deleteAsset(old);$('musicName').textContent=file.name;$('btnRemoveMusic').classList.remove('hidden');scheduleSave();notify('Música añadida. El visitante la podrá activar manualmente.');}
function stopAudio(){if(audio){audio.pause();audio.src='';audio=null;}}
function toggleAudio(){const music=data.music;if(!music){notify('No hay música cargada.');return;}if(!audio){audio=new Audio(imageURL(music.assetId));audio.loop=true;audio.volume=.55;}if(audio.paused){audio.play().then(()=>{$('previewMusic').textContent='♫ Pausar música';}).catch(()=>notify('El navegador no permitió reproducir este audio.'));}else{audio.pause();$('previewMusic').textContent='♫ Reproducir música';}}
function openPreview(){if(!data.scenes.length){notify('Primero agrega fotografías.');return;}previewVisible=true;previewIndex=Math.max(0,data.scenes.findIndex(s=>s.id===currentId));destroyViewer('editor');$('preview').classList.remove('hidden');$('preview').setAttribute('aria-hidden','false');$('previewMusic').classList.toggle('hidden',!data.music);$('previewMusic').textContent='♫ Reproducir música';renderSurface('preview');}
function closePreview(){previewVisible=false;stopAudio();$('preview').classList.add('hidden');$('preview').setAttribute('aria-hidden','true');$('preview').querySelectorAll('.visitor-overlay').forEach(e=>e.remove());destroyViewer('preview');renderSurface('editor');}
const WEB_FILE_LIMIT = 22 * 1024 * 1024; // Margen de seguridad bajo el límite GitHub web de 25 MiB.
function asMiB(bytes){return (bytes/(1024*1024)).toFixed(2)+' MiB';}
function showExportDialog(){
 if(!data.scenes.length){notify('Agrega al menos una escena antes de exportar.');return;}
 $('exportResult').classList.add('hidden');$('exportResult').replaceChildren();
 $('exportModal').classList.remove('hidden');$('exportModal').setAttribute('aria-hidden','false');
}
function closeExportDialog(){if($('btnConfirmExport').disabled)return;$('exportModal').classList.add('hidden');$('exportModal').setAttribute('aria-hidden','true');}
function imageFromBlob(blob){return new Promise((resolve,reject)=>{
 const url=URL.createObjectURL(blob),img=new Image();
 img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
 img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('No se pudo abrir la fotografía para optimizarla.'));};
 img.src=url;
});}
function canvasJpeg(canvas,quality){return new Promise((resolve,reject)=>canvas.toBlob(b=>{
 if(b && b.type==='image/jpeg')resolve(b);else reject(new Error('Este navegador no pudo generar el JPG optimizado.'));
},'image/jpeg',quality));}
async function optimizeSceneImage(original,options){
 if(!options.optimize)return {blob:original,changed:false};
 // No modificar PNG pequeños y de tamaño adecuado para conservar transparencia.
 const img=await imageFromBlob(original);
 if(!img.naturalWidth||!img.naturalHeight)throw new Error('Dimensiones inválidas.');
 const noResize=img.naturalWidth<=options.width;
 if(noResize && original.size<=WEB_FILE_LIMIT)return {blob:original,changed:false};
 let maxWidth=Math.min(options.width,img.naturalWidth),quality=options.quality;
 let result=null;
 for(let attempt=0;attempt<8;attempt++){
  const width=Math.max(512,Math.min(img.naturalWidth,Math.round(maxWidth)));
  const height=Math.max(1,Math.round(img.naturalHeight*width/img.naturalWidth));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d',{alpha:false});
  if(!context)throw new Error('Sin memoria suficiente para convertir las fotografías.');
  context.fillStyle='#ffffff';context.fillRect(0,0,width,height);
  context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
  context.drawImage(img,0,0,width,height);
  result=await canvasJpeg(canvas,quality);
  canvas.width=1;canvas.height=1;
  if(result.size<=WEB_FILE_LIMIT)break;
  maxWidth*=0.77;quality=Math.max(0.60,quality-0.045);
 }
 if(!result||result.size>WEB_FILE_LIMIT)throw new Error('No se pudo reducir una foto bajo 22 MiB. Prueba la resolución 4096.');
 // Evita aumentar el peso de fotos originales que ya eran válidas.
 if(original.size<result.size && original.size<=WEB_FILE_LIMIT)return {blob:original,changed:false};
 return {blob:result,changed:true};
}
async function exportSite(){
 if(!data.scenes.length){notify('Agrega al menos una escena antes de exportar.');return;}
 if(!window.JSZip){notify('No está disponible el exportador ZIP.');return;}
 const options={optimize:$('exportOptimize').checked,width:Number($('exportMaxWidth').value),quality:Number($('exportQuality').value)};
 const btn=$('btnConfirmExport'),original=btn.textContent;btn.disabled=true;
 const resultNode=$('exportResult');resultNode.classList.remove('hidden');resultNode.textContent='Preparando archivos…';
 try{
  const zip=new JSZip(),manifest={version:3,title:data.title||'Recorrido virtual',scenes:[],music:null,createdAt:new Date().toISOString()};
  let originalSize=0,publishedSize=0,optimizedCount=0;
  const report=[];
  function appendFile(path,blob){
   if(blob.size>WEB_FILE_LIMIT)throw new Error(`Archivo demasiado grande para subir desde GitHub web: ${path} (${asMiB(blob.size)}). Cambia o comprime este archivo.`);
   zip.file(path,blob);publishedSize+=blob.size;report.push({path,size:blob.size});
  }
  for(let i=0;i<data.scenes.length;i++){
   const s=data.scenes[i],file=asset(s.assetId);if(!file)throw new Error(`Falta la fotografía de ${s.title}.`);
   btn.textContent=`Optimizando foto ${i+1} de ${data.scenes.length}…`;
   originalSize+=file.blob.size;
   let chosen;
   try{chosen=await optimizeSceneImage(file.blob,options);}catch(err){throw new Error(`Escena «${s.title}»: ${err.message}`);}
   let ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
   if(chosen.changed)ext='jpg';
   const safeExt=['jpg','jpeg','png','webp','avif'].includes(ext)?ext:'jpg';
   const path=`assets/escena-${String(i+1).padStart(2,'0')}-${slug(s.title)}.${safeExt}`;
   appendFile(path,chosen.blob);
   if(chosen.changed)optimizedCount++;
   const hotspots=[];
   for(let j=0;j<(s.hotspots||[]).length;j++){
    const h=s.hotspots[j],out={...h};delete out.iconAssetId;
    if(h.iconAssetId){
     const icon=asset(h.iconAssetId);
     if(!icon)throw new Error(`Falta la imagen personalizada de «${h.label||'un punto'}».`);
     const ext=icon.name.split('.').pop().toLowerCase();
     if(!['jpg','jpeg','png','webp','gif','avif'].includes(ext))throw new Error('Formato de ícono no admitido.');
     const iconPath=`assets/hotspot-${String(i+1).padStart(2,'0')}-${String(j+1).padStart(2,'0')}.${ext}`;
     appendFile(iconPath,icon.blob);out.iconPath=iconPath;
    }
    hotspots.push(out);
   }
   manifest.scenes.push({id:s.id,title:s.title,type:s.type,path,initialYaw:s.initialYaw||0,initialPitch:s.initialPitch||0,hotspots});
  }
  if(data.music){const file=asset(data.music.assetId);if(file){const ext=(file.name.split('.').pop()||'mp3').toLowerCase().replace(/[^a-z0-9]/g,'');const path=`assets/musica.${['mp3','m4a','ogg','wav','aac'].includes(ext)?ext:'mp3'}`;appendFile(path,file.blob);manifest.music={path,name:file.name};}}
  for(const name of ['index.html','viewer.css','viewer.js']){const response=await fetch('./publicador/'+name);if(!response.ok)throw new Error('No se pudo cargar la plantilla '+name);zip.file(name,await response.text());}
  zip.file('tour.json',JSON.stringify(manifest,null,2));zip.file('vercel.json',JSON.stringify({version:2,cleanUrls:true},null,2));
  const info='NAVEGA360 · PUBLICACIÓN PARA GITHUB Y VERCEL\n\n'+
  '1. Descomprime este ZIP. NO subas el archivo ZIP completo a GitHub.\n'+
  '2. Sube index.html, viewer.js, viewer.css, tour.json, vercel.json y la carpeta assets/ (con sus archivos) al repositorio.\n'+
  '3. GitHub en navegador solo permite 25 MiB POR ARCHIVO; este exportador usa margen de 22 MiB.\n'+
  '4. Si algún archivo no se puede reducir (por ejemplo música), reemplázalo con una versión más ligera y exporta de nuevo.\n'+
  '5. En Vercel importa el repositorio con Framework Other y sin comando Build.\n'+
  '6. Para seguir editando importa ESTE ZIP desde Navega360 Studio; conserva otra copia como respaldo.\n\n'+
  'Archivos y tamaños (MiB):\n'+report.map(r=>`${asMiB(r.size).padStart(12)}   ${r.path}`).join('\n')+'\n\n'+
  'Este ZIP contiene imágenes listas para publicación, que podrían haber perdido calidad respecto a tus originales.\n'+
  'Los enlaces de hotspots y su ubicación se conservan. La música puede requerir permiso del visitante para reproducirse.\n';
  zip.file('LEEME-PUBLICAR.txt',info);
  btn.textContent='Creando ZIP…';
  const out=await zip.generateAsync({type:'blob',compression:'STORE',streamFiles:true},info=>{btn.textContent=`Creando ZIP ${Math.round(info.percent)}%…`;});
  const url=URL.createObjectURL(out),a=el('a',{href:url,download:`${slug(data.title)}-sitio-web-optimizado.zip`});
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),45000);
  resultNode.textContent=`✓ ZIP descargado. ${optimizedCount} fotografía(s) optimizada(s). Originales: ${asMiB(originalSize)} → fotografías publicadas y otros medios: ${asMiB(publishedSize)}. Máximo por archivo: 22 MiB. Descomprime antes de subir a GitHub.`;
  notify('ZIP listo: descomprímelo antes de subir sus archivos a GitHub.');
 }catch(err){console.error(err);resultNode.textContent='No se pudo exportar: '+err.message;notify('No se pudo exportar: '+err.message);}finally{btn.textContent=original;btn.disabled=false;}
}
async function importSite(file){
 if(!file)return;if(data.scenes.length&&!confirm('Se reemplazará el recorrido actual por el que hay dentro del ZIP. ¿Continuar?'))return;
 try{
  const zip=await JSZip.loadAsync(file),manifestFile=zip.file('tour.json');if(!manifestFile)throw new Error('El ZIP no contiene tour.json.');
  const manifest=JSON.parse(await manifestFile.async('string'));
  if(!Array.isArray(manifest.scenes)||!manifest.scenes.length||manifest.scenes.length>300)throw new Error('El archivo no tiene escenas válidas.');
  const incoming=blank();incoming.title=String(manifest.title||'Mi recorrido virtual').slice(0,110);const assets=[];
  for(const s of manifest.scenes){
   if(typeof s.path!=='string'||!/^assets\/[a-zA-Z0-9._-]+$/.test(s.path))throw new Error('Ruta de imagen no válida: '+s.path);
   const zf=zip.file(s.path);if(!zf)throw new Error('Falta el archivo '+s.path);
   const fid=uid(),blob=new Blob([await zf.async('uint8array')],{type:imageMime(s.path)});
   assets.push({id:fid,blob,name:s.path.split('/').pop()});
   const hotspots=[];
   for(const h of (Array.isArray(s.hotspots)?s.hotspots.slice(0,200):[])){
    if(!h || typeof h!=='object')continue;
    const newSpot={id:String(h.id||uid()),kind:['info','link','web'].includes(h.kind)?h.kind:'link',label:String(h.label||'').slice(0,100),body:String(h.body||'').slice(0,1000),target:String(h.target||''),url:String(h.url||'').slice(0,2048),newTab:h.newTab!==false,iconAssetId:null,iconSize:iconSize(h),x:Number(h.x??50),y:Number(h.y??50),pitch:Number(h.pitch??0),yaw:Number(h.yaw??0)};
    if(typeof h.iconPath==='string' && /^assets\/[a-zA-Z0-9._-]+$/.test(h.iconPath) && imageMime(h.iconPath)){
     const iconFile=zip.file(h.iconPath);if(!iconFile)throw new Error('Falta la imagen del hotspot '+h.iconPath);
     const iconBlob=new Blob([await iconFile.async('uint8array')],{type:imageMime(h.iconPath)}),iconId=uid();
     assets.push({id:iconId,blob:iconBlob,name:h.iconPath.split('/').pop()});newSpot.iconAssetId=iconId;
    }
    hotspots.push(newSpot);
   }
   incoming.scenes.push({id:typeof s.id==='string'?s.id:uid(),title:String(s.title||'Escena').slice(0,90),type:s.type==='360'?'360':'flat',assetId:fid,originalName:s.path.split('/').pop(),initialYaw:Number(s.initialYaw)||0,initialPitch:Number(s.initialPitch)||0,hotspots});
  }
  if(manifest.music?.path){const path=manifest.music.path;if(/^assets\/[a-zA-Z0-9._-]+$/.test(path)&&zip.file(path)){const fid=uid();assets.push({id:fid,blob:await zip.file(path).async('blob'),name:manifest.music.name||path.split('/').pop()});incoming.music={assetId:fid,name:manifest.music.name||path.split('/').pop()};}}
  syncing=true;const tx=db.transaction(['assets','config'],'readwrite');tx.objectStore('assets').clear();for(const a of assets)tx.objectStore('assets').put({blob:a.blob,name:a.name},a.id);tx.objectStore('config').put(clone(incoming),'tour');await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
  for(const old of media.values())URL.revokeObjectURL(old.url);media.clear();for(const a of assets)registerAsset(a.id,a.blob,a.name);
  data=incoming;currentId=data.scenes[0].id;selectedSpotId=null;activeTool=null;syncing=false;renderEverything();status('Proyecto restaurado desde el ZIP.');notify('Proyecto importado correctamente.');
 }catch(err){syncing=false;console.error(err);notify('Error al importar: '+err.message);}
}
async function uploadSpotIcon(file){const hs=getSelectedSpot();if(!hs||!file)return;if(!isImageFile(file)){notify('La imagen debe ser PNG, JPG, WEBP, GIF o AVIF.');return;}if(file.size>8*1024*1024){notify('El ícono debe ocupar menos de 8 MB.');return;}const old=hs.iconAssetId,uidNew=uid();await saveAsset(uidNew,file,file.name);hs.iconAssetId=uidNew;if(old)await deleteAsset(old);renderSpotEditor();renderSpotList();renderSurface('editor',true);scheduleSave();notify('Imagen del hotspot actualizada.');}
function setup(){
 $('dropzone').onclick=()=>$('imageInput').click();$('dropzone').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('imageInput').click();}};$('btnEmptyUpload').onclick=()=>$('imageInput').click();$('imageInput').onchange=async e=>{try{await addImages(e.target.files);}catch(err){console.error(err);notify('No se pudieron guardar las imágenes. Revisa el espacio del navegador.');}e.target.value='';};
 for(const name of ['dragenter','dragover'])$('dropzone').addEventListener(name,e=>{e.preventDefault();$('dropzone').classList.add('drag-over');});for(const name of ['dragleave','drop'])$('dropzone').addEventListener(name,e=>{e.preventDefault();$('dropzone').classList.remove('drag-over');});$('dropzone').addEventListener('drop',e=>addImages(e.dataTransfer.files).catch(err=>notify('No se pudieron agregar archivos: '+err.message)));
 $('tourTitle').oninput=e=>{data.title=e.target.value;scheduleSave();};$('sceneTitle').oninput=e=>{const s=getCurrent();if(!s)return;s.title=e.target.value;renderSceneList();renderToolbar();scheduleSave();};$('sceneType').onchange=e=>{const s=getCurrent();if(!s)return;const requested=e.target.value;/* Al cambiar de tipo, las coordenadas anteriores dejan de tener sentido. */if(s.hotspots.length&&!confirm('Al cambiar el tipo de imagen se eliminarán sus puntos, porque sus coordenadas son diferentes. ¿Continuar?')){e.target.value=s.type;return;}const icons=s.hotspots.map(h=>h.iconAssetId).filter(Boolean);s.type=requested;s.hotspots=[];selectedSpotId=null;for(const id of icons)deleteAsset(id);renderEverything();scheduleSave();};
 $('btnNewNav').onclick=()=>setTool('link');$('btnNewWeb').onclick=()=>setTool('web');$('btnNewInfo').onclick=()=>setTool('info');$('btnMoveSpot').onclick=()=>setTool('move');$('btnReposition').onclick=()=>setTool('move');$('btnDeleteScene').onclick=removeScene;
 $('btnDeleteSpot').onclick=async()=>{const s=getCurrent(),hs=getSelectedSpot();if(!s||!hs)return;const old=hs.iconAssetId;s.hotspots=s.hotspots.filter(x=>x.id!==hs.id);selectedSpotId=null;if(old)await deleteAsset(old);renderProperties();renderSurface('editor',true);renderToolbar();scheduleSave();notify('Punto eliminado.');};
 $('spotLabel').oninput=e=>{const hs=getSelectedSpot();if(!hs)return;hs.label=e.target.value;scheduleSave();clearTimeout(rerenderTimeout);rerenderTimeout=setTimeout(()=>{renderSpotList();renderSurface('editor',true);},650);};$('spotInfo').oninput=e=>{const hs=getSelectedSpot();if(!hs)return;hs.body=e.target.value;scheduleSave();};$('spotDestination').onchange=e=>{const hs=getSelectedSpot();if(!hs)return;hs.target=e.target.value;scheduleSave();};
 $('spotKind').onchange=e=>{const hs=getSelectedSpot();if(!hs)return;hs.kind=e.target.value;renderSpotList();renderSpotEditor();renderSurface('editor',true);scheduleSave();};
 $('spotURL').oninput=e=>{const hs=getSelectedSpot();if(!hs)return;hs.url=e.target.value;scheduleSave();};
 $('spotURL').onblur=e=>{const hs=getSelectedSpot();if(!hs||!e.target.value.trim())return;const clean=cleanWebURL(e.target.value);if(clean){hs.url=clean;e.target.value=clean;scheduleSave();}else notify('La dirección debe ser una URL HTTP o HTTPS válida.');};
 $('spotNewTab').onchange=e=>{const hs=getSelectedSpot();if(!hs)return;hs.newTab=e.target.checked;scheduleSave();};
 $('btnUploadSpotIcon').onclick=()=>$('spotIconInput').click();
 $('spotIconInput').onchange=async e=>{try{await uploadSpotIcon(e.target.files[0]);}catch(err){notify('No se pudo guardar el ícono: '+err.message);}e.target.value='';};
 $('btnRemoveSpotIcon').onclick=async()=>{const hs=getSelectedSpot();if(!hs?.iconAssetId)return;const old=hs.iconAssetId;hs.iconAssetId=null;await deleteAsset(old);renderSpotEditor();renderSpotList();renderSurface('editor',true);scheduleSave();notify('Se restauró el ícono predeterminado.');};
 $('spotIconSize').oninput=e=>{const hs=getSelectedSpot();if(!hs)return;hs.iconSize=Number(e.target.value);$('spotIconSizeText').textContent=hs.iconSize+' px';renderSurface('editor',true);scheduleSave();};
 $('prevScene').onclick=()=>{const i=data.scenes.findIndex(s=>s.id===currentId);if(i>0)selectScene(data.scenes[i-1].id);};$('nextScene').onclick=()=>{const i=data.scenes.findIndex(s=>s.id===currentId);if(i<data.scenes.length-1)selectScene(data.scenes[i+1].id);};$('btnSaveView').onclick=()=>{const s=getCurrent();if(!s||!editorViewer||s.type!=='360')return;s.initialYaw=editorViewer.getYaw();s.initialPitch=editorViewer.getPitch();scheduleSave();notify('Orientación de entrada guardada.');};
 $('btnMusic').onclick=()=>$('musicInput').click();$('musicInput').onchange=async e=>{try{await setMusic(e.target.files[0]);}catch(err){notify('Error al guardar la música: '+err.message);}e.target.value='';};$('btnRemoveMusic').onclick=async()=>{const old=data.music?.assetId;data.music=null;stopAudio();await deleteAsset(old);$('musicName').textContent='Sin archivo de audio';$('btnRemoveMusic').classList.add('hidden');scheduleSave();notify('Música quitada.');};
 $('btnPreview').onclick=openPreview;$('btnClosePreview').onclick=closePreview;$('previewNext').onclick=()=>{if(previewIndex<data.scenes.length-1){previewIndex++;renderSurface('preview');}};$('previewPrev').onclick=()=>{if(previewIndex>0){previewIndex--;renderSurface('preview');}};$('previewMusic').onclick=toggleAudio;
 $('btnExport').onclick=showExportDialog;$('btnConfirmExport').onclick=exportSite;$('btnCloseExport').onclick=closeExportDialog;$('exportOptimize').onchange=e=>$('exportOptions').classList.toggle('hidden',!e.target.checked);$('exportModal').onclick=e=>{if(e.target.id==='exportModal')closeExportDialog();};$('btnImport').onclick=()=>$('projectInput').click();$('projectInput').onchange=async e=>{await importSite(e.target.files[0]);e.target.value='';};
 const help=()=>$('helpModal').classList.remove('hidden');$('btnHelp').onclick=help;$('btnCloseHelp').onclick=$('btnHelpOk').onclick=()=>$('helpModal').classList.add('hidden');$('helpModal').onclick=e=>{if(e.target.id==='helpModal')$('helpModal').classList.add('hidden');};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('helpModal').classList.contains('hidden'))$('helpModal').classList.add('hidden');else if(!$('exportModal').classList.contains('hidden'))closeExportDialog();else if(previewVisible)closePreview();else if(activeTool){activeTool=null;updateToolUI();}}});window.addEventListener('resize',()=>{if(previewVisible){if(previewViewer)previewViewer.resize();}else if(editorViewer)editorViewer.resize();else if(getCurrent()?.type==='flat')renderSurface('editor');});
}
setup();restore().catch(err=>{console.error(err);status('No hay guardado disponible. Exporta el ZIP periódicamente.');notify('No se pudo iniciar el almacenamiento local. Comprueba los permisos del navegador.');renderEverything();});
})();
