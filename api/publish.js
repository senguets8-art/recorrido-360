import {put} from '@vercel/blob';
import {randomUUID} from 'node:crypto';
import {TOUR_RE,json,method,requireEditor,parseBody,failure} from '../lib/shared.js';
function isUrl(x){try{const u=new URL(x);return u.protocol==='https:'&&u.hostname.endsWith('.blob.vercel-storage.com');}catch{return false;}}
function cleanTour(raw){
 if(!raw||!Array.isArray(raw.scenes)||!raw.scenes.length||raw.scenes.length>300)throw new Error('Se requieren de 1 a 300 escenas.');
 const scenes=raw.scenes.map(s=>{
  if(!isUrl(s.path))throw new Error('Falta una fotografía subida a Vercel Blob.');
  return {id:String(s.id||'').slice(0,100),title:String(s.title||'Escena').slice(0,90),type:s.type==='360'?'360':'flat',path:s.path,initialYaw:Number(s.initialYaw)||0,initialPitch:Number(s.initialPitch)||0,
   hotspots:(Array.isArray(s.hotspots)?s.hotspots:[]).slice(0,200).map(h=>({id:String(h.id||'').slice(0,100),kind:['info','web','link'].includes(h.kind)?h.kind:'info',label:String(h.label||'').slice(0,100),body:String(h.body||'').slice(0,1000),target:String(h.target||'').slice(0,100),url:String(h.url||'').slice(0,2048),newTab:h.newTab!==false,iconSize:Math.min(110,Math.max(28,Number(h.iconSize)||46)),iconPath:isUrl(h.iconPath)?h.iconPath:null,x:Number(h.x??50),y:Number(h.y??50),pitch:Number(h.pitch??0),yaw:Number(h.yaw??0)}))};
 });
 return {version:4,title:String(raw.title||'Recorrido virtual').slice(0,110),scenes,music:raw.music?.path&&isUrl(raw.music.path)?{path:raw.music.path,name:String(raw.music.name||'Música').slice(0,160)}:null,publishedAt:new Date().toISOString()};
}
export default async function handler(req,res){
 if(!method(req,res,'POST')||!requireEditor(req,res))return;
 try{const body=parseBody(req),id=String(body.id||'');if(!TOUR_RE.test(id))return json(res,400,{error:'Identificador no válido.'});
  const tour=cleanTour(body.tour);
  const name=`tours/${id}/snapshots/${Date.now()}-${randomUUID()}.json`;
  await put(name,JSON.stringify(tour),{access:'public',contentType:'application/json',addRandomSuffix:false});
  return json(res,200,{id,viewerUrl:`/publicador/index.html?tour=${encodeURIComponent(id)}`,publishedAt:tour.publishedAt});
 }catch(e){if(String(e.message).includes('Se requieren')||String(e.message).includes('Falta una fotografía'))return json(res,400,{error:e.message});return failure(res,e);}
}
