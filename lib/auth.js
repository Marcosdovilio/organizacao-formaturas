import {scrypt as nodeScrypt,randomBytes,randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {pool,init,transaction} from './db.js';
import {AppError,insist} from './domain.js';
const scrypt=promisify(nodeScrypt);
export const COOKIE='formaturas_session';
export const hash=v=>createHash('sha256').update(v).digest('hex');
export async function passwordHash(password){const salt=randomBytes(16).toString('hex'),key=await scrypt(password,salt,64);return salt+':'+key.toString('hex');}
async function matches(password,stored){const [salt,expected]=stored.split(':'),key=await scrypt(password,salt,64),target=Buffer.from(expected,'hex');return key.length===target.length&&timingSafeEqual(key,target);}
export function tokenFrom(request){const token=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);return token&&/^[a-f0-9]{64}$/.test(token)?token:null;}
export async function currentUser(request){
 await init();const token=tokenFrom(request);if(!token)return null;
 return (await pool().query('SELECT u.id,u.email FROM formaturas_sessions s JOIN formaturas_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[hash(token)])).rows[0]??null;
}
export async function initialized(){await init();return (await pool().query('SELECT 1 FROM formaturas_users LIMIT 1')).rows.length>0;}
export async function requireUser(request){const user=await currentUser(request);if(!user)throw new AppError('Entre na sua conta para continuar.',401);return user;}
export async function rateLimit(key,limit=10){
 await init();await pool().query('DELETE FROM formaturas_attempts WHERE expires_at<now()');
 const {rows}=await pool().query(`INSERT INTO formaturas_attempts(key,attempts,expires_at) VALUES($1,1,now()+interval '15 minutes')
 ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN formaturas_attempts.expires_at<now() THEN 1 ELSE formaturas_attempts.attempts+1 END,
 expires_at=CASE WHEN formaturas_attempts.expires_at<now() THEN now()+interval '15 minutes' ELSE formaturas_attempts.expires_at END RETURNING attempts`,[key]);
 insist(rows[0].attempts<=limit,'Muitas tentativas. Aguarde 15 minutos e tente novamente.',429);
}
function credentials(data){
 const email=String(data.email??'').trim().toLowerCase(),password=String(data.password??'');
 insist(email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Informe um e-mail válido.');
 insist(password.length>=10&&password.length<=200,'Use uma senha com pelo menos 10 caracteres.');return {email,password};
}
async function newSession(c,user){
 const token=randomBytes(32).toString('hex');await c.query('DELETE FROM formaturas_sessions WHERE expires_at<now()');
 await c.query("INSERT INTO formaturas_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",[hash(token),user.id]);return {user:{id:user.id,email:user.email},token};
}
export async function setup(data){
 await rateLimit('setup',10);const key=String(process.env.SETUP_KEY??'');
 insist(key.length>=24,'A chave do primeiro acesso ainda não foi configurada na hospedagem.',503);
 insist(timingSafeEqual(Buffer.from(hash(key)),Buffer.from(hash(String(data.setupKey??'')))),'A chave do primeiro acesso está incorreta.',403);
 const {email,password}=credentials(data),encoded=await passwordHash(password);
 return transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(72819414)');
 insist(!(await c.query('SELECT 1 FROM formaturas_users LIMIT 1')).rows.length,'O administrador já foi cadastrado. Entre com seu e-mail e senha.',409);
 const user={id:randomUUID(),email};await c.query('INSERT INTO formaturas_users(id,email,password_hash) VALUES($1,$2,$3)',[user.id,email,encoded]);return newSession(c,user);});
}
export async function login(data){
 const email=String(data.email??'').trim().toLowerCase(),password=String(data.password??'');
 await rateLimit('login-global',100);await rateLimit('login:'+hash(email),10);
 insist(email.length<=254&&password.length<=200,'E-mail ou senha incorretos.',401);
 const {rows}=await pool().query('SELECT id,email,password_hash FROM formaturas_users WHERE email=$1',[email]);
 const valid=await matches(password,rows[0]?.password_hash??'00000000000000000000000000000000:'+ '00'.repeat(64));
 insist(rows[0]&&valid,'E-mail ou senha incorretos.',401);return transaction(c=>newSession(c,rows[0]));
}
export function sessionCookie(request,token,clear=false){return COOKIE+'='+(clear?'':token)+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+(clear?0:604800)+(new URL(request.url).protocol==='https:'?'; Secure':'');}
export async function logout(request){const token=tokenFrom(request);if(token)await pool().query('DELETE FROM formaturas_sessions WHERE token_hash=$1',[hash(token)]);}
