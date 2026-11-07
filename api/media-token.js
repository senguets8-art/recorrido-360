import {issueSignedToken,presignUrl} from '@vercel/blob';
import {json,method,requireEditor,parseBody,MEDIA_RE,allowedMimes,failure} from '../lib/shared.js';
export default async function handler(req,res){
 if(!method(req,res,'POST')||!requireEditor(req,res))return;
 try{
  const {pathname,mime,size}=parseBody(req);
  const bytes=Number(size),filetype=String(mime||'');
  if(typeof pathname!=='string'||!MEDIA_RE.test(pathname)||!allowedMimes.has(filetype)||!Number.isInteger(bytes)||bytes<1||bytes>250*1024*1024)return json(res,400,{error:'Archivo no compatible o supera el máximo de 250 MiB.'});
  const ext=pathname.split('.').pop().toLowerCase();
  const extType={jpg:['image/jpeg'],jpeg:['image/jpeg'],png:['image/png'],webp:['image/webp'],gif:['image/gif'],avif:['image/avif'],mp3:['audio/mpeg'],m4a:['audio/mp4','audio/x-m4a'],ogg:['audio/ogg'],wav:['audio/wav','audio/x-wav'],aac:['audio/aac']};
  if(!(extType[ext]||[]).includes(filetype))return json(res,400,{error:'La extensión no coincide con el tipo de archivo.'});
  const until=Date.now()+15*60*1000;
  const token=await issueSignedToken({pathname,operations:['put'],validUntil:until,allowedContentTypes:[filetype],maximumSizeInBytes:bytes});
  const {presignedUrl}=await presignUrl(token,{pathname,operation:'put',validUntil:until,access:'public',contentType:filetype});
  return json(res,200,{presignedUrl});
 }catch(e){return failure(res,e);}
}
