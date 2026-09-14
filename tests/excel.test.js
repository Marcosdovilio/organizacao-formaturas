import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {buildWorkbook} from '../lib/excel.js';
import {seedState,mutateState} from '../lib/domain.js';
let n=0;const id=()=>String(++n);
test('XLSX real com valores numéricos, datas, vazios, filtros, estilos e alternativas',async()=>{
 let s=seedState(id);const eventId=s.events[0].id,categoryId=s.events[0].categories[4].id;
 const apply=(a,d)=>{const r=mutateState(s,a,d,id);s=r.state;return r;};apply('setYear',{year:2028});
 const supplierId=apply('supplier.save',{name:'Fornecedor de teste',phone:'(49) 99999-9999'}).resultId;
 const itemId=apply('item.save',{eventId,categoryId,description:'Cadeiras de teste',status:'Contratado',paid:'250',quote:{supplierId,quantity:'200',unitPrice:'5,50'}}).resultId;
 apply('quote.save',{eventId,itemId,supplierId,quantity:'200',unitPrice:'6,50'});
 const buffer=await buildWorkbook(s).xlsx.writeBuffer();assert.equal(Buffer.from(buffer).subarray(0,2).toString(),'PK');
 const parsed=new ExcelJS.Workbook();await parsed.xlsx.load(buffer);assert.equal(parsed.worksheets.length,7);
 const summary=parsed.getWorksheet('Resumo geral');assert.equal(summary.getCell('C2').value,1100);assert.equal(summary.getCell('D2').value,1100);
 assert.equal(summary.getCell('E2').value,250);assert.equal(summary.getCell('F2').value,850);assert.ok(summary.getCell('B2').value instanceof Date);
 assert.match(summary.getCell('C2').numFmt,/R\$/);assert.equal(summary.views[0].ySplit,1);assert.ok(summary.autoFilter);assert.equal(summary.getCell('A1').font.bold,true);
 const quotes=parsed.getWorksheet('Cotações');assert.equal(quotes.rowCount,3);assert.equal(quotes.getCell('J2').value,'Sim');assert.equal(quotes.getCell('J3').value,'Não');assert.equal(quotes.getCell('I3').value,1300);
 assert.equal(parsed.getWorksheet('PROERD Monte Carlo').getCell('J2').value,null);
 const individual=buildWorkbook(s,eventId);assert.equal(individual.worksheets.length,4);assert.equal(individual.getWorksheet('Cotações').rowCount,3);
});
test('abas com nomes únicos e seguros, sem ano e sem preços preservados',async()=>{
 const s=seedState(id);s.events[0].name='Cotações';s.events[1].name='cotações';s.events[2].name='Uma formatura / com nome muito grande e caracteres ?';
 const buffer=await buildWorkbook(s).xlsx.writeBuffer(),book=new ExcelJS.Workbook();await book.xlsx.load(buffer);
 assert.equal(new Set(book.worksheets.map(w=>w.name.toLowerCase())).size,7);assert.ok(book.worksheets.every(w=>w.name.length<=31));
 assert.match(book.getWorksheet('Resumo geral').getCell('B2').value,/ano a definir/);assert.equal(book.getWorksheet('Resumo geral').getCell('C2').value,null);
});
