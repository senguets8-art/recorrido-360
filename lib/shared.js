import {timingSafeEqual} from 'node:crypto';
export const TOUR_RE=/^[a-z0-9][a-z0-9-]{7,79}$/;
export const MEDIA_RE=/^tours\/([a-z0-9][a-z0-9-]{7,79})\/media\/[a-zA-Z0-9_-]{8,120}\.(jpe?g|png|webp|gif|avif|mp3|m4a|ogg|wav|aac)$/;
export const allowedMimes=new Set(['image/jpeg','image/png','image/webp','image/gif','image/avif','audio/mpeg','audio/mp4','audio/x-m4a','audio/ogg','audio/wav','audio/x-wav','audio/aac']);
export function json(res,status,value){res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');return res.status(status).json(value);}
export function method(req,res,expected){if(req.method!==expected){res.setHeader('Allow',expected);json(res,405,{error:'Método no permitido'});return false;}return true;}
export function requireEditor(req,res){
 const expected=process.env.NAVEGA_ADMIN_PASSWORD||'';
 if(expected.length<16){json(res,503,{error:'Configura NAVEGA_ADMIN_PASSWORD en Vercel (mínimo 16 caracteres).'});return false;}
 const input=String(req.headers['x-navega-password']||'');
 const a=Buffer.from(expected,'utf8'),b=Buffer.from(input,'utf8');
 if(a.length!==b.length || !timingSafeEqual(a,b)){json(res,401,{error:'Contraseña de edición incorrecta.'});return false;}
 return true;
}
export function parseBody(req){if(typeof req.body==='string')return JSON.parse(req.body);if(Buffer.isBuffer(req.body))return JSON.parse(req.body.toString('utf8'));return req.body||{};}
export function failure(res,e,step='operación de almacenamiento'){
 console.error('[Navega360 Blob - '+step+']',e);
 return json(res,500,{step,error:'Falló Vercel Blob durante '+step+'. En el editor, usa «Comprobar conexión con Blob» para identificar la causa. También puedes revisar los registros (Logs) de Vercel.'});
}
