'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {X,LoaderCircle} from 'lucide-react';
export function Button({children,variant='primary',className='',...props}){return <button type="button" className={'button '+variant+' '+className} {...props}>{children}</button>;}
export function Badge({children}){const cls=['Contratado','Definido'].includes(children)?'success':children==='Em cotação'?'warning':['Cancelado','Não se aplica'].includes(children)?'muted':'neutral';return <span className={'badge '+cls}>{children}</span>;}
export function Field({label,hint,children,className=''}){return <label className={'field '+className}><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;}
export function Empty({icon:Icon,title,children,action}){return <div className="empty">{Icon&&<div className="empty-icon"><Icon size={26}/></div>}<h3>{title}</h3>{children&&<p>{children}</p>}{action}</div>;}
export function Modal({title,children,onClose,wide=false,busy=false}){
 const ref=useRef(null),[mounted,setMounted]=useState(false);
 useEffect(()=>setMounted(true),[]);useEffect(()=>{if(mounted&&ref.current&&!ref.current.open)ref.current.showModal();},[mounted]);
 if(!mounted)return null;
 return createPortal(<dialog className={'dialog '+(wide?'wide':'')} ref={ref} aria-label={title} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}><div className="dialog-header"><h2>{title}</h2><button type="button" className="icon-button" aria-label="Fechar" disabled={busy} onClick={onClose}><X size={22}/></button></div>{children}</dialog>,document.body);
}
export function FormDialog({title,children,onClose,onSubmit,submitLabel='Salvar',busy=false,wide=false}){
 const [error,setError]=useState('');
 async function submit(e){e.preventDefault();setError('');try{await onSubmit();}catch(err){setError(err.message);}}
 return <Modal title={title} onClose={onClose} busy={busy} wide={wide}><form onSubmit={submit}><div className="dialog-body"><fieldset disabled={busy}>{children}</fieldset>{error&&<div className="notice danger" role="alert">{error}</div>}</div><div className="dialog-footer"><Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button><Button type="submit" disabled={busy}>{busy&&<LoaderCircle size={17} className="spin"/>}{busy?'Salvando…':submitLabel}</Button></div></form></Modal>;
}
