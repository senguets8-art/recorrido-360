import {list} from '@vercel/blob';
import {TOUR_RE,json,method,failure} from '../lib/shared.js';
export default async function handler(req,res){
 if(!method(req,res,'GET'))return;
 try{
  const id=String(req.query?.id||'');if(!TOUR_RE.test(id))return json(res,400,{error:'Identificador de recorrido no válido.'});
  let cursor=undefined,latest=null,pages=0,hasMore=true;
  // Se usan nombres inmutables con fecha inicial: los cambios se reflejan sin esperar la caché de un archivo sobrescrito.
  while(hasMore && pages<20){
    const result=await list({prefix:`tours/${id}/snapshots/`,limit:1000,...(cursor?{cursor}:{})});
    for(const item of result.blobs)if(item.pathname.endsWith('.json')&&(!latest||item.pathname>latest.pathname))latest=item;
    hasMore=result.hasMore;cursor=result.cursor;pages++;
  }
  if(!latest)return json(res,404,{error:'Recorrido no publicado.'});
  const response=await fetch(latest.url,{cache:'no-store'});
  if(!response.ok)throw new Error('No se pudo leer el manifiesto.');
  const document=await response.json();
  res.setHeader('Cache-Control','no-store');return json(res,200,document);
 }catch(e){return failure(res,e,'lectura del recorrido');}
}
