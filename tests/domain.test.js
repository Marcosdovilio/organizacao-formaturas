import test from 'node:test';
import assert from 'node:assert/strict';
import {seedState,mutateState,decimal,quoteTotal,selected,summarize,categorySummary} from '../lib/domain.js';
let n=0;const id=()=>String(++n);
function fixture(){let state=seedState(id);return {get state(){return state;},get event(){return state.events[0];},apply(action,data){const r=mutateState(state,action,data,id);state=r.state;return r;}};}
test('quatro eventos, sem ano presumido nem fornecedores e preços inventados',()=>{
 const s=seedState(id);assert.equal(s.events.length,4);assert.deepEqual(s.events.map(e=>e.day),[12,18,10,11]);
 assert.ok(s.events.every(e=>e.year===null&&e.month===11&&e.items.length===0&&e.categories.length===6));assert.equal(s.suppliers.length,0);assert.equal(s.events[0].categories[0].notApplicable,true);
 assert.equal(summarize(s.events).expected,null);assert.equal(summarize(s.events).undefinedCategories,23);assert.equal(summarize(s.events).expectedPartial,true);
});
test('centavos exatos, quantidade decimal e distinção entre vazio e zero',()=>{
 assert.equal(decimal(''),null);assert.equal(decimal('0'),0);assert.equal(decimal('1.250,35'),125035);
 assert.equal(quoteTotal({quantity:decimal('1,125',3),unitPrice:decimal('10,01')}),1126);
 assert.equal(quoteTotal({quantity:1000,unitPrice:null}),null);assert.equal(quoteTotal({quantity:100,unitPrice:10}),1);
 assert.throws(()=>decimal('-1'));assert.throws(()=>decimal('1.001'));assert.throws(()=>decimal('abc'));
});
test('orçamento escolhido único, alternativa fora do total e pagamento validado',()=>{
 const x=fixture(),eventId=x.event.id,categoryId=x.event.categories[1].id;
 const itemId=x.apply('item.save',{eventId,categoryId,description:'Teste',quote:{quantity:'200',unitPrice:'6,50'}}).resultId;
 const quoteId=x.apply('quote.save',{eventId,itemId,quantity:'200',unitPrice:'5,50'}).resultId;
 assert.equal(summarize(x.event).expected,130000);
 x.apply('quote.choose',{eventId,itemId,quoteId});assert.equal(x.event.items[0].quotes.length,2);assert.equal(selected(x.event.items[0]).id,quoteId);assert.equal(summarize(x.event).expected,110000);
 x.apply('item.save',{eventId,id:itemId,categoryId,description:'Teste',status:'Contratado',paid:'0'});
 x.apply('item.pay',{eventId,itemId,amount:'250'});
 const t=summarize(x.event);assert.deepEqual([t.contracted,t.paid,t.balance],[110000,25000,85000]);
 assert.throws(()=>x.apply('item.pay',{eventId,itemId,amount:'900'}),/ultrapassar/);
 assert.throws(()=>x.apply('item.save',{eventId,id:itemId,categoryId,description:'Teste',status:'Contratado',paid:'250',quote:{quantity:'1',unitPrice:'100'}}),/ultrapassar/);
 assert.equal(categorySummary(x.event,x.event.categories[1]).status,'Definido');
});
test('categorias não aplicáveis e itens cancelados não entram nos totais',()=>{
 const x=fixture(),eventId=x.event.id,categoryId=x.event.categories[1].id;
 const itemId=x.apply('item.save',{eventId,categoryId,description:'Teste',status:'Contratado',paid:'25',quote:{quantity:'1',unitPrice:'100'}}).resultId;
 x.apply('category.save',{eventId,id:categoryId,name:'Decoração',notApplicable:true});
 assert.equal(summarize(x.event).contracted,0);assert.equal(summarize(x.event).paid,0);
 x.apply('category.save',{eventId,id:categoryId,name:'Decoração',notApplicable:false});
 x.apply('item.save',{eventId,id:itemId,categoryId,description:'Teste',status:'Cancelado',paid:'25'});
 assert.equal(summarize(x.event).contracted,0);assert.equal(summarize(x.event).paid,0);assert.equal(x.event.items[0].paidCents,2500);
});
test('pagamento desconhecido gera saldo desconhecido e total parcial',()=>{
 const x=fixture();x.apply('item.save',{eventId:x.event.id,categoryId:x.event.categories[1].id,description:'Pendente',status:'Contratado',quote:{quantity:'1',unitPrice:'100'}});
 const t=summarize(x.event);assert.equal(t.paid,null);assert.equal(t.balance,null);assert.equal(t.paidPartial,true);
});
test('duplicação limpa pagamentos e exclusão de fornecedor respeita vínculos',()=>{
 const x=fixture(),eventId=x.event.id,categoryId=x.event.categories[1].id,supplierId=x.apply('supplier.save',{name:'Teste'}).resultId;
 const itemId=x.apply('item.save',{eventId,categoryId,description:'Teste',status:'Contratado',paid:'5',quote:{supplierId,quantity:'1',unitPrice:'10'}}).resultId;
 x.apply('item.duplicate',{eventId,itemId});const copy=x.event.items[1];
 assert.equal(copy.paidCents,null);assert.equal(copy.status,'A cotar');assert.notEqual(copy.quotes[0].id,x.event.items[0].quotes[0].id);assert.equal(selected(copy).unitPrice,1000);
 assert.throws(()=>x.apply('supplier.delete',{id:supplierId}),/ligado/);
});
test('validação de datas, ano explícito e categoria adicional',()=>{
 const x=fixture();assert.throws(()=>x.apply('setYear',{year:''}));assert.throws(()=>x.apply('event.save',{name:'Inválido',day:31,month:11,year:2028}));
 x.apply('setYear',{year:2028});assert.ok(x.state.events.every(e=>e.year===2028));x.apply('event.save',{name:'Novo',day:29,month:2,year:2028});
 assert.throws(()=>x.apply('setYear',{year:2029,applyAll:true}));
 x.apply('category.save',{eventId:x.event.id,name:'Alimentação'});assert.equal(x.event.categories.at(-1).name,'Alimentação');
});
