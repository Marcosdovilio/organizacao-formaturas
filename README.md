# Organização de Formaturas

Aplicação em português para organizar fornecedores, serviços, cotações e pagamentos. Preparada para **Vercel + Neon PostgreSQL**.

## Publicar na Vercel

1. No Neon, crie um projeto e copie a conexão **pooled**, com `sslmode=require`.
2. Na Vercel, importe este repositório, selecione a branch `main`, framework **Next.js** e **Node.js 22**. Mantenha os comandos padrão de instalação e build.
3. Cadastre as variáveis abaixo **apenas no servidor**, antes do deploy:

| Variável | Conteúdo |
| --- | --- |
| `DATABASE_URL` | Conexão PostgreSQL pooled do Neon |
| `SETUP_KEY` | Chave aleatória de pelo menos 24 caracteres, usada somente para cadastrar o primeiro administrador |

Gere a chave no seu computador:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

4. Faça o deploy. As tabelas são criadas automaticamente na primeira conexão. O usuário PostgreSQL precisa de permissão para criar tabelas.
5. Abra o site e cadastre o administrador usando seu e-mail, uma senha com pelo menos 10 caracteres e a `SETUP_KEY`.
6. Informe o **ano das formaturas** na configuração inicial. Nenhum ano é presumido.
7. Depois de criar o administrador, você pode remover `SETUP_KEY` da Vercel e fazer outro deploy. O login existente continuará funcionando.

Se alterar variáveis depois do deploy, publique novamente para a aplicação receber os valores atualizados.

Não coloque a conexão ou a chave no código, no GitHub ou em variáveis `NEXT_PUBLIC_*`. Use bancos ou branches do Neon separados para produção e testes.

Documentação oficial: [variáveis da Vercel](https://vercel.com/docs/environment-variables), [Next.js](https://nextjs.org/docs), [conexões Neon](https://neon.com/docs/connect/connect-from-any-app).

## Primeiro uso

Criados **apenas uma vez**, sem fornecedores ou preços de demonstração:

- Bombeiro Mirim — 12 de novembro;
- PROERD Monte Carlo — 18 de novembro;
- PROERD Fraiburgo — 10 de novembro;
- PROERD São Joaquim — 11 de novembro.

Cada evento começa com Apresentação cultural, Decoração, Sonorização, Foto/filmagem, Cadeiras e Materiais. Em Bombeiro Mirim, Apresentação cultural começa como “Não se aplica”. É possível editar nomes, datas e categorias, além de cadastrar novos eventos.

1. Cadastre fornecedores ou use “Cadastrar fornecedor” dentro do formulário do item.
2. Abra um evento e clique em “Adicionar item”. Você pode salvar antes de saber o preço.
3. Abra “Detalhes e cotações” para adicionar alternativas e usar “Escolher este orçamento”.
4. Edite a situação para “Contratado” quando houver quantidade e preço.
5. Informe o total já pago ou clique em “Registrar pagamento”.
6. Exporte o evento ou todas as formaturas para Excel.

**Valor já pago** no formulário é o total acumulado. **Registrar pagamento** acrescenta o novo valor ao que já foi pago. Informe zero quando confirmar que nada foi pago; deixe vazio quando a informação for desconhecida.

No computador, descrição e situação podem ser editadas diretamente na tabela. No celular, os itens aparecem em cartões. Os detalhes incluem edição, duplicação e exclusão, com confirmação nas exclusões.

## Regras financeiras

- Quantidade: até 3 casas decimais. Dinheiro: 2 casas decimais.
- Cálculos em centavos inteiros; multiplicação com `BigInt` e arredondamento de meio centavo para cima.
- Previsto: somente os orçamentos escolhidos dos itens ativos.
- Contratado, pago e saldo: somente itens contratados de categorias aplicáveis.
- Cotações alternativas, itens cancelados e categorias não aplicáveis ficam fora dos totais.
- Contratado já faz parte do previsto. Esses valores não são somados.
- Vazio é diferente de zero. Valores desconhecidos aparecem como “Não informado”.
- Totais com informação faltando são marcados como parciais.
- Se o pagamento de um contrato é desconhecido, seu saldo permanece desconhecido. Saldo parcial soma somente os saldos conhecidos.
- Sem contratos registrados, contratado, pago e saldo são zero.
- A categoria fica “Definido” quando todos os seus itens ativos têm orçamento escolhido com quantidade e preço; “Em cotação” quando há itens pendentes; “A preencher” quando não há itens ativos.
- Pagamentos negativos ou superiores ao contratado são rejeitados no servidor.
- Cancelamento preserva valores anteriores para consulta e remove o item dos totais.
- Duplicação limpa pagamentos, mantém cotações e muda a cópia para “A cotar”.

## Excel

Exportação real em `.xlsx` usando ExcelJS:

- “Resumo geral”: eventos, datas, totais e identificação de apuração parcial;
- uma aba por evento, incluindo categorias vazias e todos os itens;
- “Cotações”: todas as alternativas e identificação da escolha;
- “Fornecedores”: contatos cadastrados. Na exportação individual, somente fornecedores citados nas cotações daquele evento.

Cabeçalhos destacados, filtros, primeira linha congelada, larguras adequadas, dinheiro numérico formatado em reais e datas completas como datas do Excel. Campos não preenchidos permanecem vazios. Filtros da tela não limitam a exportação.

## Desenvolvimento local

Pré-requisitos: Node.js 22 e PostgreSQL local ou Neon.

```bash
npm install
cp .env.example .env.local
npm run dev
```

No Windows, copie `.env.example` para `.env.local` pelo explorador de arquivos. Preencha as variáveis e abra [localhost:3000](http://localhost:3000).

## Validação

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

O teste de navegador precisa de um **banco separado e vazio** e de `SETUP_KEY`: ele cadastra um administrador e dados de teste. Nunca use o banco de produção para esses testes.

O GitHub Actions usa um PostgreSQL temporário e verifica:

- eventos iniciais, datas, categorias e valores ausentes;
- cálculos de centavos, alternativas, cancelamentos e pagamentos;
- estrutura e conteúdo real do arquivo Excel;
- cadastro de administrador, fornecedor e item pelo navegador;
- comparação de duas cotações, contratação e pagamento;
- exportação com filtros ativos;
- acesso restrito, origem das solicitações e conflito de edições;
- persistência em outra sessão, interface móvel e saída da conta.

Relatórios e capturas ficam nos artefatos da execução do GitHub Actions.

## Estrutura técnica

Next.js e React; PostgreSQL via `pg`; ExcelJS; testes com Node.js e Playwright.

A instalação possui **um administrador**, que pode entrar em vários dispositivos. A senha usa scrypt. Sessões aleatórias são armazenadas pelo hash no banco e enviadas em cookie HttpOnly, SameSite=Lax e Secure em HTTPS. Operações de escrita verificam a origem; tentativas de acesso são limitadas no banco.

O planejamento fica em JSONB, atualizado em transação com bloqueio de linha e revisão otimista. Se outra aba ou dispositivo salvar primeiro, o sistema avisa, atualiza os dados e pede que você confira antes de tentar novamente. Isso evita sobrescrita silenciosa.

Tabelas: `formaturas_users`, `formaturas_sessions`, `formaturas_attempts` e `formaturas_workspace`. O cadastro inicial é idempotente. Os dados de trabalho não dependem do armazenamento local do navegador.

O deploy de produção e as variáveis são configurados nas suas contas da Vercel e do Neon.
