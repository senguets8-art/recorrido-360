/* Navega360 V4: publicación sin ZIP en el mismo proyecto Vercel. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const hooks=window.NavegaCloudHooks;
const slug=s=>String(s||'recorrido').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,35)||'recorrido';
let busy=false;
function code(){
 const data=hooks.getData();
 if(data.cloudId&&/^[a-z0-9][a-z0-9-]{7,79}$/.test(data.cloudId))return data.cloudId;
 const next=slug(data.title)+'-'+crypto.randomUUID().slice(0,8);
 hooks.setCloudId(next);return next;
}
function visitUrl(id){return location.origin+'/publicador/index.html?tour='+encodeURIComponent(id);}
function status(message){$('cloudStatus').textContent=message;}
function safeShow(target,show){$(target).classList.toggle('hidden',!show);}
function openPublish(){const id=code();$('cloudCode').value=id;safeShow('cloudModal',true);$('cloudModal').setAttribute('aria-hidden','false');safeShow('cloudResult',false);$('cloudLink').value='';$('cloudVisit').removeAttribute('href');status('Pulsa «Guardar y actualizar» para subir o actualizar el recorrido. El enlace para visitantes solo aparecerá cuando Vercel confirme la publicación.');}
function closePublish(){if(busy)return;safeShow('cloudModal',false);$('cloudModal').setAttribute('aria-hidden','true');$('cloudPassword').value='';}
async function api(endpoint,body,password){const response=await fetch('/api/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-navega-password':password},body:JSON.stringify(body)});const json=await response.json().catch(()=>({error:'Respuesta inesperada del servidor.'}));if(!response.ok)throw new Error(json.error||'No se pudo conectar con Vercel.');return json;}
function extFor(blob,name){
 const mime=blob?.type||'';const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif','audio/mpeg':'mp3','audio/mp4':'m4a','audio/x-m4a':'m4a','audio/ogg':'ogg','audio/wav':'wav','audio/x-wav':'wav','audio/aac':'aac'};
 if(types[mime])return types[mime];
 const ext=(name||'').split('.').pop().toLowerCase();
 return ['jpg','jpeg','png','webp','gif','avif','mp3','m4a','ogg','wav','aac'].includes(ext)?ext:null;
}
async function uploadMedia(id,tourId,password,progress){
 const record=hooks.getMedia(id);if(!record)throw new Error('Falta una foto, ícono o audio en el editor. Comprueba que no se borraron los datos del navegador.');
 if(record.remoteURL)return record.remoteURL;
 if(!record.blob)throw new Error('Este archivo no está disponible localmente; vuelve a cargar el recorrido desde la nube.');
 const blob=record.blob,ext=extFor(blob,record.name);if(!ext)throw new Error('Formato no admitido: '+record.name);
 const pathname=`tours/${tourId}/media/${id.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,70)}-${slug(record.name).slice(0,25)}-${crypto.randomUUID().slice(0,8)}.${ext}`;
 const canonicalMime={'jpg':'image/jpeg','jpeg':'image/jpeg','png':'image/png','webp':'image/webp','gif':'image/gif','avif':'image/avif','mp3':'audio/mpeg','m4a':'audio/mp4','ogg':'audio/ogg','wav':'audio/wav','aac':'audio/aac'};
 const mime=(blob.type==='audio/x-m4a'||blob.type==='audio/x-wav')?blob.type:canonicalMime[ext];
 if(!mime)throw new Error('Este archivo no tiene un tipo MIME reconocible: '+record.name);
 const token=await api('media-token',{pathname,mime,size:blob.size},password);
 progress('Subiendo '+record.name+' ('+(blob.size/1048576).toFixed(1)+' MiB)…');
 const sent=await fetch(token.presignedUrl,{method:'PUT',headers:{'Content-Type':mime},body:blob});
 if(!sent.ok){let body='';try{body=(await sent.text()).slice(0,250);}catch{}throw new Error('La nube rechazó el archivo «'+record.name+'» (HTTP '+sent.status+'). '+body);}
 let result;
 for(let tries=0;tries<5;tries++){
  try{result=await api('media-url',{pathname},password);break;}catch(e){if(tries===4)throw new Error('Se subió el archivo pero no se confirmó su dirección. Vuelve a publicar. '+e.message);await new Promise(r=>setTimeout(r,400*(tries+1)));}
 }
 await hooks.markRemoteAsset(id,result.url);
 return result.url;
}
async function publish(){
 if(busy)return;const password=$('cloudPassword').value;const data=hooks.getData();
 if(!data.scenes.length){status('Agrega fotografías antes de publicar.');return;}
 if(!password){status('Escribe la contraseña configurada en Vercel.');return;}
 const id=code(),btn=$('cloudPublish');busy=true;btn.disabled=true;
 try{
  const allIds=new Set();
  data.scenes.forEach(s=>{allIds.add(s.assetId);(s.hotspots||[]).forEach(h=>{if(h.iconAssetId)allIds.add(h.iconAssetId);});});
  if(data.music?.assetId)allIds.add(data.music.assetId);
  const urls=new Map(),ids=[...allIds];
  for(let i=0;i<ids.length;i++){
   status(`Archivo ${i+1} de ${ids.length}.\nPreparando…`);
   urls.set(ids[i],await uploadMedia(ids[i],id,password,m=>status(`Archivo ${i+1} de ${ids.length}.\n${m}`)));
  }
  status('Guardando escenas, hotspots y enlaces…');
  const manifest={title:data.title,scenes:data.scenes.map(s=>({id:s.id,title:s.title,type:s.type,path:urls.get(s.assetId),initialYaw:s.initialYaw||0,initialPitch:s.initialPitch||0,hotspots:(s.hotspots||[]).map(h=>({id:h.id,kind:h.kind,label:h.label,body:h.body,target:h.target,url:h.url,newTab:h.newTab,iconSize:h.iconSize,iconPath:h.iconAssetId?urls.get(h.iconAssetId):null,x:h.x,y:h.y,pitch:h.pitch,yaw:h.yaw}))})),music:data.music?{path:urls.get(data.music.assetId),name:data.music.name}:null};
  await api('publish',{id,tour:manifest},password);
  hooks.setCloudId(id);await hooks.saveNow();
  const link=visitUrl(id);$('cloudLink').value=link;$('cloudVisit').href=link;safeShow('cloudResult',true);
  status('✓ Recorrido publicado.\nComparte el enlace de visualización. Las personas que lo abran no podrán modificar las escenas desde ese visor.');
  hooks.notify('¡Recorrido publicado! Copia el enlace para compartirlo.');
 }catch(error){console.error(error);status('No se pudo publicar:\n'+error.message);}
 finally{busy=false;btn.disabled=false;}
}
async function load(){
 const raw=$('cloudLoadInput').value.trim();let id=raw;
 try{if(raw.includes('/')){const url=new URL(raw);id=(url.pathname.match(/\/ver\/([a-z0-9-]+)/)||[])[1]||url.searchParams.get('tour')||'';}}catch{}
 if(!/^[a-z0-9][a-z0-9-]{7,79}$/.test(id)){$('cloudLoadStatus').textContent='Introduce un enlace de visita válido.';return;}
 const btn=$('cloudLoadAction');btn.disabled=true;$('cloudLoadStatus').textContent='Recuperando recorrido…';
 try{const response=await fetch('/api/tour?id='+encodeURIComponent(id),{cache:'no-store'});const tour=await response.json();if(!response.ok)throw new Error(tour.error||'No se encontró el recorrido.');
  const done=await hooks.loadRemoteTour(tour,id);if(done){$('cloudLoadModal').classList.add('hidden');hooks.notify('Escenas, música y hotspots cargados desde la nube.');}
 }catch(e){$('cloudLoadStatus').textContent='No se pudo cargar: '+e.message;}
 finally{btn.disabled=false;}
}
$('btnCloud').addEventListener('click',openPublish);
$('cloudClose').addEventListener('click',closePublish);
$('cloudModal').addEventListener('click',e=>{if(e.target===$('cloudModal'))closePublish();});
$('cloudPublish').addEventListener('click',publish);
$('cloudCopy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('cloudLink').value);hooks.notify('Enlace copiado.');}catch{ $('cloudLink').select();document.execCommand('copy');hooks.notify('Enlace seleccionado para copiar.');}});
$('btnCloudOpen').addEventListener('click',()=>safeShow('cloudLoadModal',true));
$('cloudLoadClose').addEventListener('click',()=>safeShow('cloudLoadModal',false));
$('cloudLoadAction').addEventListener('click',load);
$('cloudLoadInput').addEventListener('keydown',e=>{if(e.key==='Enter')load();});
})();
