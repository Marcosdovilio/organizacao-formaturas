import ExcelJS from 'exceljs';
import {summarize,selected,quoteTotal,isActive,categorySummary} from './domain.js';
const BRL='"R$" #,##0.00;[Red]-"R$" #,##0.00',numeric=v=>v===null||v===undefined?null:v/100;
const date=e=>e.year?new Date(Date.UTC(e.year,e.month-1,e.day)):String(e.day).padStart(2,'0')+'/'+String(e.month).padStart(2,'0')+' (ano a definir)';
function sheet(book,name,columns,rows){
 const ws=book.addWorksheet(name,{views:[{state:'frozen',ySplit:1}]});
 ws.columns=columns.map(([header,key,width=22,format])=>({header,key,width,style:format?{numFmt:format}:{}}));rows.forEach(r=>ws.addRow(r));
 const header=ws.getRow(1);header.height=30;header.eachCell(c=>{c.font={bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF173A72'}};c.alignment={vertical:'middle',wrapText:true};});
 ws.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,ws.rowCount),column:columns.length}};
 for(let r=2;r<=ws.rowCount;r++){ws.getRow(r).alignment={vertical:'top',wrapText:true};if(r%2===0)ws.getRow(r).eachCell({includeEmpty:true},c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF2F6FC'}};});}return ws;
}
function summaryRow(name,t,when=null){return {name,date:when,expected:numeric(t.expected),contracted:numeric(t.contracted),paid:numeric(t.paid),balance:numeric(t.balance),expectedStatus:t.expectedPartial?'Parcial':'Completo',paidStatus:t.paidPartial?'Parcial':'Completo',balanceStatus:t.balancePartial?'Parcial':'Completo',pending:t.undefinedCategories};}
export function buildWorkbook(state,eventId=null){
 const book=new ExcelJS.Workbook();book.creator='Organização de Formaturas';book.created=new Date();
 const events=eventId?state.events.filter(e=>e.id===eventId):state.events;
 sheet(book,'Resumo geral',[
 ['Evento','name',30],['Data','date',24,'dd/mm/yyyy'],['Total previsto','expected',22,BRL],['Total contratado','contracted',22,BRL],['Total pago','paid',22,BRL],['Saldo a pagar','balance',22,BRL],
 ['Previsto: apuração','expectedStatus'],['Pago: apuração','paidStatus'],['Saldo: apuração','balanceStatus'],['Categorias sem definição','pending',24]
 ],[...events.map(e=>summaryRow(e.name,summarize(e),date(e))),summaryRow('TOTAL DO ESCOPO',summarize(events))]);
 const used=new Set(['resumo geral','cotações','fornecedores']),supplier=id=>state.suppliers.find(s=>s.id===id);
 for(const e of events){
 const base=e.name.replace(/[\\/*?:\[\]]/g,' ').replace(/^'+|'+$/g,'').trim().slice(0,31)||'Evento';let name=base,index=2;
 while(used.has(name.toLowerCase())){const suffix=' ('+(index++)+')';name=base.slice(0,31-suffix.length)+suffix;}used.add(name.toLowerCase());
 const rows=e.categories.flatMap(c=>{
 const items=e.items.filter(i=>i.categoryId===c.id),cs=categorySummary(e,c).status;if(!items.length)return [{category:c.name,categoryStatus:cs,date:date(e)}];
 return items.map(i=>{const q=selected(i),s=supplier(q?.supplierId),total=quoteTotal(q);return {category:c.name,categoryStatus:cs,date:date(e),description:i.description,supplier:s?.name??null,
 contact:s?[s.contact,s.phone,s.email].filter(Boolean).join(' · '):null,quantity:!q||q.quantity===null?null:q.quantity/1000,unit:i.unit,price:numeric(q?.unitPrice),total:numeric(total),status:i.status,paid:numeric(i.paidCents),
 balance:i.status==='Contratado'&&i.paidCents!==null?numeric(total-i.paidCents):null,notes:i.notes||null,quoteNotes:q?.notes||null,included:isActive(e,i)?'Sim':'Não'};});
 });
 const ws=sheet(book,name,[
 ['Categoria','category',26],['Situação da categoria','categoryStatus',22],['Data do evento','date',24,'dd/mm/yyyy'],['Descrição','description',42],['Fornecedor','supplier',30],['Contato do fornecedor','contact',36],
 ['Quantidade','quantity',16,'0.###'],['Unidade','unit',16],['Valor unitário','price',20,BRL],['Total do orçamento escolhido','total',26,BRL],['Situação do item','status',20],['Valor pago','paid',20,BRL],['Saldo a pagar','balance',20,BRL],['Observações do item','notes',42],['Observações do orçamento','quoteNotes',42],['Inclui nos totais','included',20]
 ],rows);ws.addRow({});const t=summarize(e);
 for(const [label,v,partial] of [['Total previsto',t.expected,t.expectedPartial],['Total contratado',t.contracted,false],['Total pago',t.paid,t.paidPartial],['Saldo a pagar',t.balance,t.balancePartial]])ws.addRow({description:label+(partial?' (parcial)':''),total:numeric(v)}).font={bold:true};
 }
 sheet(book,'Cotações',[
 ['Evento','event',30],['Categoria','category',26],['Item','item',42],['Fornecedor','supplier',30],['Contato','contact',32],['Quantidade','quantity',16,'0.###'],['Unidade','unit',16],['Valor unitário','price',20,BRL],['Total','total',20,BRL],['Orçamento escolhido','chosen',24],['Situação do item','status',22],['Categoria não se aplica','na',24],['Inclui nos totais','included',20],['Observações','notes',42]
 ],events.flatMap(e=>e.items.flatMap(i=>i.quotes.map(q=>{const c=e.categories.find(c=>c.id===i.categoryId),s=supplier(q.supplierId);return {event:e.name,category:c?.name,item:i.description,supplier:s?.name??null,contact:s?[s.contact,s.phone,s.email].filter(Boolean).join(' · '):null,quantity:q.quantity===null?null:q.quantity/1000,unit:i.unit,price:numeric(q.unitPrice),total:numeric(quoteTotal(q)),chosen:q.id===i.selectedQuoteId?'Sim':'Não',status:i.status,na:c?.notApplicable?'Sim':'Não',included:isActive(e,i)&&i.selectedQuoteId===q.id?'Sim':'Não',notes:q.notes||null};}))));
 const referenced=new Set(events.flatMap(e=>e.items.flatMap(i=>i.quotes.map(q=>q.supplierId))));
 sheet(book,'Fornecedores',[['Empresa ou profissional','name',34],['Pessoa de contato','contact',26],['Telefone/WhatsApp','phone',24],['E-mail','email',32],['Cidade','city',24],['Categorias atendidas','categories',42],['Observações','notes',42]],
 (eventId?state.suppliers.filter(s=>referenced.has(s.id)):state.suppliers).map(s=>({...s,contact:s.contact||null,phone:s.phone||null,email:s.email||null,city:s.city||null,categories:s.categories.join(', ')||null,notes:s.notes||null})));
 return book;
}
