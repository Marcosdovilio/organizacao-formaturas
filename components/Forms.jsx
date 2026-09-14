'use client';
import {useState} from 'react';
import {Plus} from 'lucide-react';
import {Button,Field,FormDialog} from './ui';
import {STATUSES,selected,centsInput,quantityInput,quoteTotal,decimal,money} from '../lib/domain';
export function SupplierForm({supplier,onClose,onDone,ctx}){
 const [v,setV]=useState(supplier?{...supplier,categories:supplier.categories.join(', ')}:{name:'',contact:'',phone:'',email:'',city:'',categories:'',notes:''});
 const set=(k,value)=>setV(old=>({...old,[k]:value}));
 return <FormDialog title={supplier?'Editar fornecedor':'Cadastrar fornecedor'} onClose={onClose} busy={ctx.busy} onSubmit={async()=>{const r=await ctx.act('supplier.save',{...v,categories:v.categories.split(',').map(s=>s.trim()).filter(Boolean)});onDone?.(r.resultId??supplier.id);onClose();}}>
 <div className="form-grid">
 <Field label="Empresa ou profissional *" className="full"><input autoFocus required value={v.name} onChange={e=>set('name',e.target.value)} placeholder="Nome do fornecedor"/></Field>
 <Field label="Pessoa de contato"><input value={v.contact} onChange={e=>set('contact',e.target.value)} placeholder="Como a pessoa se chama"/></Field>
 <Field label="Telefone/WhatsApp"><input type="tel" value={v.phone} onChange={e=>set('phone',e.target.value)} placeholder="(49) 99999-9999"/></Field>
 <Field label="E-mail (opcional)"><input type="email" value={v.email} onChange={e=>set('email',e.target.value)} placeholder="contato@empresa.com.br"/></Field>
 <Field label="Cidade"><input value={v.city} onChange={e=>set('city',e.target.value)} placeholder="Ex.: Fraiburgo"/></Field>
 <Field label="Categorias atendidas" hint="Separe as categorias por vírgula." className="full"><input value={v.categories} onChange={e=>set('categories',e.target.value)} placeholder="Ex.: Decoração, Materiais"/></Field>
 <Field label="Observações" className="full"><textarea rows={3} value={v.notes} onChange={e=>set('notes',e.target.value)} placeholder="Prazos, condições ou outras informações"/></Field>
 </div></FormDialog>;
}
function SupplierSelect({value,onChange,ctx}){
 const [adding,setAdding]=useState(false),s=ctx.state.suppliers.find(s=>s.id===value);
 return <div className="full"><Field label="Fornecedor"><select value={value||''} onChange={e=>onChange(e.target.value)}><option value="">Ainda não informado</option>{ctx.state.suppliers.map(s=><option key={s.id} value={s.id}>{s.name}{s.city?' · '+s.city:''}</option>)}</select></Field>
 <div className="supplier-pick-footer"><small>{s?[s.contact,s.phone,s.email].filter(Boolean).join(' · ')||'Contato não informado':''}</small><Button variant="text" onClick={()=>setAdding(true)}><Plus size={15}/>Cadastrar fornecedor</Button></div>
 {adding&&<SupplierForm ctx={ctx} onClose={()=>setAdding(false)} onDone={onChange}/>}</div>;
}
function liveTotal(q,p){try{return money(quoteTotal({quantity:decimal(q,3),unitPrice:decimal(p,2)}));}catch{return 'Confira os valores';}}
export function ItemForm({event,item,categoryId,onClose,ctx}){
 const q=item?selected(item):null;
 const [v,setV]=useState({id:item?.id,description:item?.description??'',categoryId:item?.categoryId??(categoryId||event.categories.find(c=>!c.notApplicable)?.id||event.categories[0]?.id),unit:item?.unit??'serviço',status:item?.status??'A cotar',paid:centsInput(item?.paidCents),notes:item?.notes??'',supplierId:q?.supplierId??'',quantity:quantityInput(q?.quantity),unitPrice:centsInput(q?.unitPrice),quoteNotes:q?.notes??''});
 const set=(k,value)=>setV(old=>({...old,[k]:value}));
 const hasQuote=Boolean(q)||v.quantity!==''||v.unitPrice!==''||v.supplierId!==''||v.quoteNotes!=='';
 return <FormDialog title={item?'Editar item':'Adicionar item'} onClose={onClose} busy={ctx.busy} wide onSubmit={async()=>{await ctx.act('item.save',{...v,eventId:event.id,quote:hasQuote?{supplierId:v.supplierId,quantity:v.quantity,unitPrice:v.unitPrice,notes:v.quoteNotes}:undefined});onClose();}}>
 <div className="form-grid">
 <Field label="Descrição do serviço ou material *" className="full"><input autoFocus required value={v.description} onChange={e=>set('description',e.target.value)} placeholder="Ex.: Locação de 200 cadeiras"/></Field>
 <Field label="Categoria"><select value={v.categoryId} onChange={e=>set('categoryId',e.target.value)}>{event.categories.map(c=><option key={c.id} value={c.id}>{c.name}{c.notApplicable?' (não se aplica)':''}</option>)}</select></Field>
 <Field label="Situação"><select value={v.status} onChange={e=>set('status',e.target.value)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></Field></div>
 <div className="form-section"><h3>{q?'Orçamento escolhido':'Orçamento inicial'}</h3><p>Preencha o que já souber. Você poderá comparar outras cotações nos detalhes do item.</p></div>
 <div className="form-grid"><SupplierSelect ctx={ctx} value={v.supplierId} onChange={value=>set('supplierId',value)}/>
 <Field label="Quantidade" hint="Aceita até 3 casas decimais."><input inputMode="decimal" value={v.quantity} onChange={e=>set('quantity',e.target.value)} placeholder="Ex.: 200"/></Field>
 <Field label="Unidade"><input list="units" value={v.unit} onChange={e=>set('unit',e.target.value)} placeholder="Ex.: unidade"/><datalist id="units">{['serviço','unidade','diária','pacote','metro','hora'].map(u=><option key={u} value={u}/>)}</datalist></Field>
 <Field label="Valor unitário (R$)"><input inputMode="decimal" value={v.unitPrice} onChange={e=>set('unitPrice',e.target.value)} placeholder="Ex.: 6,50"/></Field>
 <div className="calculated"><span>Total do orçamento</span><strong>{liveTotal(v.quantity,v.unitPrice)}</strong></div>
 <Field label="Observações do orçamento" className="full"><textarea rows={2} value={v.quoteNotes} onChange={e=>set('quoteNotes',e.target.value)} placeholder="Prazo, frete ou condições deste orçamento"/></Field></div>
 <div className="form-section"><h3>Pagamento e observações</h3></div><div className="form-grid">
 <Field label="Valor já pago (R$)" hint="Total acumulado. Use 0 se confirmou que nada foi pago."><input inputMode="decimal" value={v.paid} onChange={e=>set('paid',e.target.value)} placeholder="Ainda não informado"/></Field>
 <div className="form-help">O item precisa estar contratado para registrar pagamentos. Campos vazios continuam como “Não informado”.</div>
 <Field label="Observações do item" className="full"><textarea rows={3} value={v.notes} onChange={e=>set('notes',e.target.value)} placeholder="O que a equipe precisa saber sobre este item?"/></Field>
 </div></FormDialog>;
}
export function QuoteForm({event,item,quote,onClose,ctx}){
 const [v,setV]=useState({id:quote?.id,supplierId:quote?.supplierId??'',quantity:quantityInput(quote?.quantity),unitPrice:centsInput(quote?.unitPrice),notes:quote?.notes??''}),set=(k,value)=>setV(old=>({...old,[k]:value}));
 return <FormDialog title={quote?'Editar cotação':'Adicionar cotação'} onClose={onClose} busy={ctx.busy} onSubmit={async()=>{await ctx.act('quote.save',{...v,eventId:event.id,itemId:item.id});onClose();}}>
 <p className="form-intro">{item.description}</p><div className="form-grid"><SupplierSelect ctx={ctx} value={v.supplierId} onChange={value=>set('supplierId',value)}/>
 <Field label="Quantidade"><input inputMode="decimal" value={v.quantity} onChange={e=>set('quantity',e.target.value)} placeholder="Ex.: 200"/></Field>
 <Field label="Valor unitário (R$)"><input inputMode="decimal" value={v.unitPrice} onChange={e=>set('unitPrice',e.target.value)} placeholder="Ex.: 6,50"/></Field>
 <div className="calculated full"><span>Total da cotação · {item.unit}</span><strong>{liveTotal(v.quantity,v.unitPrice)}</strong></div>
 <Field label="Observações" className="full"><textarea rows={3} value={v.notes} onChange={e=>set('notes',e.target.value)} placeholder="Prazo, condições e o que está incluído"/></Field>
 </div></FormDialog>;
}
export function EventForm({event,onClose,ctx}){
 const [v,setV]=useState(event?{id:event.id,name:event.name,day:event.day,month:event.month,year:event.year??''}:{name:'',day:'',month:11,year:ctx.state.defaultYear??''}),set=(k,value)=>setV(old=>({...old,[k]:value}));
 return <FormDialog title={event?'Editar evento':'Cadastrar evento'} onClose={onClose} busy={ctx.busy} onSubmit={async()=>{await ctx.act('event.save',v);onClose();}}>
 <Field label="Nome do evento *"><input autoFocus required value={v.name} onChange={e=>set('name',e.target.value)} placeholder="Nome da formatura"/></Field>
 <div className="form-grid thirds"><Field label="Dia *"><input type="number" required min="1" max="31" value={v.day} onChange={e=>set('day',e.target.value)}/></Field><Field label="Mês *"><input type="number" required min="1" max="12" value={v.month} onChange={e=>set('month',e.target.value)}/></Field><Field label="Ano"><input type="number" min="1900" max="9999" value={v.year} onChange={e=>set('year',e.target.value)} placeholder="A definir"/></Field></div>
 <p className="form-help">Se o ano ainda não estiver definido, deixe o campo vazio.</p></FormDialog>;
}
export function CategoryForm({event,category,onClose,ctx}){
 const [name,setName]=useState(category?.name??''),[na,setNa]=useState(category?.notApplicable??false);
 return <FormDialog title={category?'Editar categoria':'Adicionar categoria'} onClose={onClose} busy={ctx.busy} onSubmit={async()=>{await ctx.act('category.save',{eventId:event.id,id:category?.id,name,notApplicable:na});onClose();}}>
 <Field label="Nome da categoria *"><input autoFocus required value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Alimentação"/></Field><label className="checkbox-row"><input type="checkbox" checked={na} onChange={e=>setNa(e.target.checked)}/>Não se aplica a este evento</label>
 <p className="form-help">Quando marcado, os itens continuam disponíveis para consulta e exportação, mas ficam fora dos totais.</p></FormDialog>;
}
export function YearForm({onClose,ctx}){
 const [year,setYear]=useState(ctx.state.defaultYear??''),[all,setAll]=useState(false);
 return <FormDialog title="Definir ano das formaturas" onClose={onClose} busy={ctx.busy} submitLabel="Salvar ano" onSubmit={async()=>{await ctx.act('setYear',{year,applyAll:all});onClose();}}>
 <p className="form-intro">As datas de novembro já estão cadastradas. Qual é o ano das formaturas?</p><Field label="Ano *"><input autoFocus required type="number" min="1900" max="9999" value={year} onChange={e=>setYear(e.target.value)} placeholder="Digite o ano"/></Field>
 <label className="checkbox-row"><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/>Aplicar também aos eventos que já têm ano</label><p className="form-help">Por padrão, atualiza apenas eventos com o ano em branco. Você também pode editar a data de cada evento.</p></FormDialog>;
}
export function PayForm({event,item,onClose,ctx}){
 const [amount,setAmount]=useState('');
 return <FormDialog title="Registrar pagamento" onClose={onClose} busy={ctx.busy} submitLabel="Registrar pagamento" onSubmit={async()=>{await ctx.act('item.pay',{eventId:event.id,itemId:item.id,amount});onClose();}}>
 <p className="form-intro">{item.description}</p><div className="detail-grid"><div><span>Valor contratado</span><strong>{money(quoteTotal(selected(item)))}</strong></div><div><span>Já pago</span><strong>{money(item.paidCents)}</strong></div></div>
 <Field label="Valor deste pagamento (R$) *" hint="Este valor será acrescentado ao total já pago."><input autoFocus required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Ex.: 250,00"/></Field></FormDialog>;
}
