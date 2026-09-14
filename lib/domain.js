export const CATEGORIES=['Apresentação cultural','Decoração','Sonorização','Foto/filmagem','Cadeiras','Materiais'];
export const STATUSES=['A cotar','Em cotação','Contratado','Cancelado'];
const LIMIT=1000000000000;
export class AppError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export function insist(ok,message,status=400){if(!ok)throw new AppError(message,status);}
export function textValue(value,label,required=false,max=300){
 const s=String(value??'').trim();insist(!required||s.length>0,'Preencha '+label+'.');insist(s.length<=max,label+' excedeu o tamanho permitido.');return s;
}
export function decimal(value,scale=2,label='O valor'){
 if(value===null||value===undefined||value==='')return null;
 let s=String(value).trim();if(!s)return null;
 if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
 insist(new RegExp('^\\d+(?:\\.\\d{1,'+scale+'})?$').test(s),label+' deve ser positivo ou zero, com até '+scale+' casas decimais.');
 const [whole,fraction='']=s.split('.');
 const n=BigInt(whole)*10n**BigInt(scale)+BigInt(fraction.padEnd(scale,'0'));
 insist(n<=BigInt(LIMIT),label+' é muito alto.');return Number(n);
}
export function quoteTotal(q){return !q||q.quantity===null||q.unitPrice===null?null:Number((BigInt(q.quantity)*BigInt(q.unitPrice)+500n)/1000n);}
export function centsInput(v){return v===null||v===undefined?'':(v/100).toFixed(2);}
export function quantityInput(v){return v===null||v===undefined?'':String(v/1000);}
export function money(v){return v===null||v===undefined?'Não informado':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100);}
export function selected(i){return i.quotes.find(q=>q.id===i.selectedQuoteId)??null;}
export function isActive(e,i){return i.status!=='Cancelado'&&!e.categories.find(c=>c.id===i.categoryId)?.notApplicable;}
export function dateText(e){return String(e.day).padStart(2,'0')+'/'+String(e.month).padStart(2,'0')+(e.year?'/'+e.year:' · ano a definir');}
function sum(values){
 const known=values.filter(v=>v!==null);if(!known.length)return null;
 const n=known.reduce((a,v)=>a+BigInt(v),0n);insist(n<=BigInt(Number.MAX_SAFE_INTEGER),'A soma dos valores ultrapassou o limite de cálculo.');return Number(n);
}
export function categorySummary(e,c){
 if(c.notApplicable)return {status:'Não se aplica',value:null,partial:false};
 const items=e.items.filter(i=>i.categoryId===c.id&&i.status!=='Cancelado');
 if(!items.length)return {status:'A preencher',value:null,partial:true};
 const values=items.map(i=>quoteTotal(selected(i))),partial=values.some(v=>v===null);
 return {status:partial?'Em cotação':'Definido',value:sum(values),partial};
}
export function summarize(events){
 if(!Array.isArray(events))events=[events];
 const active=events.flatMap(e=>e.items.filter(i=>isActive(e,i))),contracts=active.filter(i=>i.status==='Contratado');
 const categories=events.flatMap(e=>e.categories.filter(c=>!c.notApplicable).map(c=>categorySummary(e,c)));
 const paidPartial=contracts.some(i=>i.paidCents===null);
 return {expected:active.length?sum(active.map(i=>quoteTotal(selected(i)))):(categories.length?null:0),
 contracted:contracts.length?sum(contracts.map(i=>quoteTotal(selected(i)))):0,
 paid:contracts.length?sum(contracts.map(i=>i.paidCents)):0,
 balance:contracts.length?sum(contracts.map(i=>i.paidCents===null?null:quoteTotal(selected(i))-i.paidCents)):0,
 expectedPartial:categories.some(c=>c.partial),paidPartial,balancePartial:paidPartial,
 undefinedCategories:categories.filter(c=>c.status!=='Definido').length,contractedCount:contracts.length,itemsCount:active.length};
}
export function seedState(id){
 return {version:1,defaultYear:null,suppliers:[],events:[['Bombeiro Mirim',12],['PROERD Monte Carlo',18],['PROERD Fraiburgo',10],['PROERD São Joaquim',11]].map(([name,day],index)=>({
 id:id(),name,day,month:11,year:null,color:index,categories:CATEGORIES.map((name,i)=>({id:id(),name,notApplicable:index===0&&i===0})),items:[]}))};
}
function find(list,id,label){const result=list.find(x=>x.id===id);insist(result,label+' não encontrado.',404);return result;}
function checkDate(day,month,year){
 insist(Number.isInteger(day)&&Number.isInteger(month)&&month>=1&&month<=12,'Informe uma data válida.');
 insist(year===null||Number.isInteger(year)&&year>=1900&&year<=9999,'Informe um ano entre 1900 e 9999.');
 const d=new Date(Date.UTC(year??2000,month-1,day));insist(d.getUTCMonth()===month-1&&d.getUTCDate()===day,'Este dia não existe no mês escolhido.');
}
function ensureItem(e,i,s){
 insist(STATUSES.includes(i.status),'Escolha uma situação válida.');find(e.categories,i.categoryId,'Categoria');
 insist(!i.selectedQuoteId||i.quotes.some(q=>q.id===i.selectedQuoteId),'Escolha um orçamento deste item.');
 const total=quoteTotal(selected(i));
 for(const q of i.quotes){if(q.supplierId)find(s.suppliers,q.supplierId,'Fornecedor');const t=quoteTotal(q);insist(t===null||Number.isSafeInteger(t)&&t<=LIMIT,'O total deste orçamento é muito alto.');}
 if(i.status==='Contratado')insist(total!==null,'Para contratar, escolha um orçamento com quantidade e valor unitário.');
 if(i.paidCents!==null&&i.paidCents>0){
 insist(['Contratado','Cancelado'].includes(i.status),'Somente itens contratados podem ter pagamentos. Itens cancelados preservam os valores anteriores.');
 insist(total!==null&&i.paidCents<=total,'O valor pago não pode ultrapassar o valor contratado.');
 }
}
export function mutateState(source,action,data,id){
 const state=structuredClone(source);let resultId=null;
 if(action==='setYear'){
 const year=Number(data.year);checkDate(1,1,year);state.defaultYear=year;
 for(const e of state.events)if(!e.year||data.applyAll){checkDate(e.day,e.month,year);e.year=year;}
 }else if(action==='supplier.save'){
 const fields={name:textValue(data.name,'o nome do fornecedor',true),contact:textValue(data.contact,'a pessoa de contato'),phone:textValue(data.phone,'o telefone'),email:textValue(data.email,'o e-mail'),city:textValue(data.city,'a cidade'),
 categories:(Array.isArray(data.categories)?data.categories:[]).slice(0,100).map(s=>textValue(s,'a categoria',true)),notes:textValue(data.notes,'as observações',false,5000)};
 insist(!fields.email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email),'Informe um e-mail válido.');
 if(data.id)Object.assign(find(state.suppliers,data.id,'Fornecedor'),fields);else{resultId=id();state.suppliers.push({id:resultId,...fields});}
 }else if(action==='supplier.delete'){
 insist(!state.events.some(e=>e.items.some(i=>i.quotes.some(q=>q.supplierId===data.id))),'Este fornecedor está ligado a uma cotação. Remova o vínculo antes de excluí-lo.');
 find(state.suppliers,data.id,'Fornecedor');state.suppliers=state.suppliers.filter(s=>s.id!==data.id);
 }else if(action==='event.save'){
 const fields={name:textValue(data.name,'o nome do evento',true),day:Number(data.day),month:Number(data.month),year:data.year?Number(data.year):null};checkDate(fields.day,fields.month,fields.year);
 if(data.id)Object.assign(find(state.events,data.id,'Evento'),fields);else{resultId=id();state.events.push({id:resultId,...fields,color:state.events.length%4,categories:CATEGORIES.map(name=>({id:id(),name,notApplicable:false})),items:[]});}
 }else{
 const event=find(state.events,data.eventId,'Evento');
 if(action==='category.save'){
 const name=textValue(data.name,'o nome da categoria',true);insist(!event.categories.some(c=>c.name.toLowerCase()===name.toLowerCase()&&c.id!==data.id),'Já existe uma categoria com esse nome.');
 if(data.id)Object.assign(find(event.categories,data.id,'Categoria'),{name,notApplicable:Boolean(data.notApplicable)});else{resultId=id();event.categories.push({id:resultId,name,notApplicable:Boolean(data.notApplicable)});}
 }else if(action==='item.save'){
 const fields={categoryId:data.categoryId,description:textValue(data.description,'a descrição',true),unit:textValue(data.unit,'a unidade',false,60)||'serviço',status:data.status??'A cotar',notes:textValue(data.notes,'as observações',false,5000),paidCents:decimal(data.paid,2,'O valor pago')};
 let item;if(data.id){item=find(event.items,data.id,'Item');Object.assign(item,fields);}else{resultId=id();item={id:resultId,...fields,quotes:[],selectedQuoteId:null};event.items.push(item);}
 if(data.quote){
 let q=selected(item);const fields={supplierId:data.quote.supplierId||null,quantity:decimal(data.quote.quantity,3,'A quantidade'),unitPrice:decimal(data.quote.unitPrice,2,'O valor unitário'),notes:textValue(data.quote.notes,'as observações do orçamento',false,5000)};
 if(q)Object.assign(q,fields);else{q={id:id(),...fields};item.quotes.push(q);item.selectedQuoteId=q.id;}
 }ensureItem(event,item,state);
 }else{
 const item=find(event.items,data.itemId,'Item');
 if(action==='item.delete')event.items=event.items.filter(i=>i.id!==item.id);
 else if(action==='item.duplicate'){
 const copy=structuredClone(item),chosenId=copy.selectedQuoteId;copy.id=id();copy.description+=' (cópia)';copy.status='A cotar';copy.paidCents=null;
 copy.quotes=copy.quotes.map(q=>{const next={...q,id:id()};if(q.id===chosenId)copy.selectedQuoteId=next.id;return next;});event.items.push(copy);resultId=copy.id;
 }else if(action==='quote.save'){
 const fields={supplierId:data.supplierId||null,quantity:decimal(data.quantity,3,'A quantidade'),unitPrice:decimal(data.unitPrice,2,'O valor unitário'),notes:textValue(data.notes,'as observações',false,5000)};
 if(data.id)Object.assign(find(item.quotes,data.id,'Cotação'),fields);else{resultId=id();item.quotes.push({id:resultId,...fields});}ensureItem(event,item,state);
 }else if(action==='quote.choose'){find(item.quotes,data.quoteId,'Cotação');item.selectedQuoteId=data.quoteId;ensureItem(event,item,state);
 }else if(action==='quote.delete'){find(item.quotes,data.quoteId,'Cotação');if(item.selectedQuoteId===data.quoteId)item.selectedQuoteId=null;item.quotes=item.quotes.filter(q=>q.id!==data.quoteId);ensureItem(event,item,state);
 }else if(action==='item.pay'){
 insist(item.status==='Contratado','Marque o item como Contratado antes de registrar o pagamento.');const amount=decimal(data.amount,2,'O pagamento');insist(amount!==null&&amount>0,'Informe um pagamento maior que zero.');item.paidCents=(item.paidCents??0)+amount;ensureItem(event,item,state);
 }else throw new AppError('Ação não reconhecida.');
 }}
 insist(state.events.length<=500&&state.suppliers.length<=10000,'O limite de cadastros foi atingido.');
 for(const e of state.events){insist(e.items.length<=5000&&e.categories.length<=100,'O limite de itens ou categorias foi atingido.');for(const i of e.items){insist(i.quotes.length<=100,'O limite de cotações deste item foi atingido.');ensureItem(e,i,state);}}
 summarize(state.events);return {state,resultId};
}
