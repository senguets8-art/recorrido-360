import {head} from '@vercel/blob';
import {json,method,requireEditor,parseBody,MEDIA_RE,failure} from '../lib/shared.js';
export default async function handler(req,res){
 if(!method(req,res,'POST')||!requireEditor(req,res))return;
 try{const {pathname}=parseBody(req);if(typeof pathname!=='string'||!MEDIA_RE.test(pathname))return json(res,400,{error:'Ruta de archivo no válida.'});
  const b=await head(pathname);return json(res,200,{url:b.url,size:b.size});
 }catch(e){return failure(res,e);}
}
