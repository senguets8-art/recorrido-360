import {list, put, del, issueSignedToken, presignUrl} from '@vercel/blob';
import {randomUUID} from 'node:crypto';
import {json,method,requireEditor,parseBody} from '../lib/shared.js';

// Diagnóstico autenticado: verifica lectura, escritura y creación de URLs firmadas.
// Elimina el archivo pequeño de prueba y jamás expone credenciales al navegador.
function safeError(e){
  let message=String(e?.message||'Error desconocido').slice(0,550);
  for(const secret of [process.env.BLOB_READ_WRITE_TOKEN,process.env.NAVEGA_ADMIN_PASSWORD]){
    if(secret && secret.length>7) message=message.split(secret).join('[oculto]');
  }
  message=message.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi,'Bearer [oculto]').replace(/vercel_blob_rw_[A-Za-z0-9._-]+/gi,'[oculto]');
  return {message,name:String(e?.name||'Error').slice(0,70),code:String(e?.code||'').slice(0,70)};
}
export default async function handler(req,res){
  if(!method(req,res,'POST')||!requireEditor(req,res))return;
  let step='lectura',createdUrl=null;
  try{
    await list({limit:1});
    step='escritura';
    const id=randomUUID(),pathname=`diagnostico-navega360/${id}.txt`;
    const item=await put(pathname,'Prueba temporal de Navega360.',{access:'public',contentType:'text/plain',addRandomSuffix:false});
    createdUrl=item.url;
    step='enlace temporal para subir fotos';
    const target=`diagnostico-navega360/${randomUUID()}.png`,until=Date.now()+2*60*1000;
    const token=await issueSignedToken({pathname:target,operations:['put'],validUntil:until,allowedContentTypes:['image/png'],maximumSizeInBytes:1024});
    const {presignedUrl}=await presignUrl(token,{pathname:target,operation:'put',validUntil:until,access:'public',contentType:'image/png'});
    if(!presignedUrl) throw new Error('La función de firma no devolvió URL.');
    step='limpieza';
    await del(createdUrl);createdUrl=null;
    return json(res,200,{ok:true,message:'Conexión, escritura y URLs de subida: correctas. Prueba a publicar el recorrido.'});
  }catch(e){
    console.error('[Navega360 diagnóstico Blob - '+step+']',e);
    if(createdUrl){try{await del(createdUrl);}catch(cleanup){console.error('[Navega360 limpieza Blob]',cleanup);}}
    return json(res,503,{ok:false,step,details:safeError(e),error:'Falló la comprobación de Blob en: '+step+'. Comprueba la conexión Storage del proyecto y revisa Logs en Vercel.'});
  }
}
