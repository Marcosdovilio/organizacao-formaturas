import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {seedState,mutateState,AppError} from './domain.js';
let initialization;
export function pool(){
 if(!process.env.DATABASE_URL)throw new AppError('O banco de dados ainda não foi configurado. Configure DATABASE_URL na hospedagem.',503);
 if(!globalThis.formaturasPool)globalThis.formaturasPool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:3,idleTimeoutMillis:20000,connectionTimeoutMillis:10000});
 return globalThis.formaturasPool;
}
export async function transaction(fn){
 const c=await pool().connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function init(){
 if(!initialization)initialization=transaction(async c=>{
 await c.query('SELECT pg_advisory_xact_lock(72819413)');
 await c.query(`
 CREATE TABLE IF NOT EXISTS formaturas_users(id uuid PRIMARY KEY,singleton boolean NOT NULL DEFAULT true UNIQUE CHECK(singleton),email text NOT NULL UNIQUE,password_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS formaturas_sessions(token_hash text PRIMARY KEY,user_id uuid NOT NULL REFERENCES formaturas_users(id) ON DELETE CASCADE,expires_at timestamptz NOT NULL);
 CREATE INDEX IF NOT EXISTS formaturas_sessions_expiry ON formaturas_sessions(expires_at);
 CREATE TABLE IF NOT EXISTS formaturas_attempts(key text PRIMARY KEY,attempts integer NOT NULL,expires_at timestamptz NOT NULL);
 CREATE TABLE IF NOT EXISTS formaturas_workspace(id integer PRIMARY KEY CHECK(id=1),revision integer NOT NULL DEFAULT 1,data jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
 `);
 await c.query('INSERT INTO formaturas_workspace(id,data) VALUES(1,$1::jsonb) ON CONFLICT(id) DO NOTHING',[JSON.stringify(seedState(randomUUID))]);
 }).catch(e=>{initialization=null;throw e;});await initialization;
}
export async function readState(){
 await init();const {rows}=await pool().query('SELECT data,revision FROM formaturas_workspace WHERE id=1');return {...rows[0].data,revision:rows[0].revision};
}
export async function changeState(action,data,revision){
 await init();return transaction(async c=>{
 const {rows}=await c.query('SELECT data,revision FROM formaturas_workspace WHERE id=1 FOR UPDATE'),current=rows[0];
 if(revision!==current.revision)throw new AppError('Os dados foram alterados em outra aba ou dispositivo. Atualizamos a tela; confira os dados e tente novamente.',409);
 const changed=mutateState(current.data,action,data,randomUUID),next=current.revision+1;
 await c.query('UPDATE formaturas_workspace SET data=$1::jsonb,revision=$2,updated_at=now() WHERE id=1',[JSON.stringify(changed.state),next]);
 return {state:{...changed.state,revision:next},resultId:changed.resultId};
 });
}
