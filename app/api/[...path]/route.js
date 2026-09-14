import {currentUser,initialized,setup,login,requireUser,logout,sessionCookie} from '../../../lib/auth.js';
import {changeState,readState} from '../../../lib/db.js';
import {AppError,insist} from '../../../lib/domain.js';
import {buildWorkbook} from '../../../lib/excel.js';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
function json(data,status=200,headers={}){return Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});}
async function handle(request){
 try{
 const url=new URL(request.url),path=url.pathname;
 if(request.method==='GET'&&path==='/api/auth/status'){const ready=await initialized();return json({initialized:ready,user:ready?await currentUser(request):null});}
 if(request.method==='POST'){
 insist(request.headers.get('origin')===url.origin,'Esta solicitação não veio do sistema. Atualize a página e tente novamente.',403);
 insist(request.headers.get('content-type')?.includes('application/json'),'Envie os dados no formato correto.',415);
 insist(Number(request.headers.get('content-length')??0)<=100000,'Este formulário é muito grande.',413);
 const body=await request.text();insist(Buffer.byteLength(body)<=100000,'Este formulário é muito grande.',413);
 let data;try{data=JSON.parse(body);}catch{throw new AppError('Não foi possível ler os dados enviados.');}
 insist(data&&typeof data==='object'&&!Array.isArray(data),'Envie um formulário válido.');
 if(path==='/api/auth/setup'||path==='/api/auth/login'){const result=path.endsWith('setup')?await setup(data):await login(data);return json({user:result.user},200,{'Set-Cookie':sessionCookie(request,result.token)});}
 await requireUser(request);
 if(path==='/api/auth/logout'){await logout(request);return json({ok:true},200,{'Set-Cookie':sessionCookie(request,'',true)});}
 if(path==='/api/mutate'){insist(Number.isInteger(data.revision),'Atualize a página antes de salvar.');return json(await changeState(data.action,data.data??{},data.revision));}
 }
 await requireUser(request);
 if(request.method==='GET'&&path==='/api/state')return json(await readState());
 if(request.method==='GET'&&path==='/api/export'){
 const state=await readState(),eventId=url.searchParams.get('eventId');if(eventId)insist(state.events.some(e=>e.id===eventId),'Evento não encontrado.',404);
 const bytes=await buildWorkbook(state,eventId).xlsx.writeBuffer();
 return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="formaturas'+(eventId?'-evento':'-completo')+'.xlsx"','Cache-Control':'no-store'}});
 }
 return json({error:'Página não encontrada.'},404);
 }catch(error){
 if(error instanceof AppError)return json({error:error.message},error.status);
 console.error('Falha na operação de formaturas:',error.code??error.name);
 return json({error:'Não foi possível concluir a operação. Verifique a conexão e tente novamente. Se continuar, confira a configuração do banco na hospedagem.'},500);
 }
}
export const GET=handle;
export const POST=handle;
