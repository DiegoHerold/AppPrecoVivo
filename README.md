# Fluxo de Compras

Aplicação web mobile-first para registrar compras reais e explicar a diferença entre desembolso, consumo estimado e estoque. O projeto não cria compras fictícias: uma conta nova começa vazia e todo item exibido vem do PostgreSQL.


## Stack

- Next.js 16 com App Router e TypeScript
- React 19, Tailwind CSS 4 e React Hook Form
- PostgreSQL 18, Prisma 7 e Zod
- PWA instalável com manifesto, ícones, service worker e página offline
- Autenticação própria com senha em hash, sessão persistida no banco e cookie HTTP-only
- Perfil editável, troca de senha e preferências persistidas por usuário
- Câmera real via getUserMedia, com escolha frontal/traseira e alternativa por arquivo

## Executar localmente

1. Crie um banco PostgreSQL chamado `fluxo_compras`.
2. Copie `.env.example` para `.env` e ajuste `DATABASE_URL` e `SESSION_SECRET`.
3. Instale, migre e inicialize o plano de categorias:

```bash
npm install
npm run db:migrate
npm run db:seed
```

4. Inicie aceitando conexões da rede local:

```bash
npm run dev:lan
```

No celular conectado ao mesmo Wi-Fi, abra `http://IP-DO-COMPUTADOR:5174`. Nesta máquina, o endereço atual é `http://192.168.1.35:5174`. O IP pode mudar ao reconectar no Wi-Fi; use `ipconfig` para conferir o endereço IPv4 atual.

O seed cria somente uma conta local de desenvolvimento e seu plano de categorias. Ele não cria compras, produtos, preços ou análises falsas. Cadastros de usuários também recebem seu próprio plano de categorias automaticamente.

## Entradas de compra

- Cadastro manual: persiste compra e itens imediatamente.
- Texto colado: aceita linhas no formato `produto | quantidade | unidade | preço unitário | categoria | comportamento`.
- Chave, URL ou foto: a foto é lida no navegador, que envia somente o texto do QR Code para validação, consulta oficial e prevenção de duplicidade. Quando a leitura falha, permite tentar outra foto, digitar a chave ou cadastrar manualmente sem criar uma compra vazia.
- O banco registra somente a URL/chave extraída. A imagem não é persistida nem na intranet nem na Vercel.

`/api/uploads` existe apenas como fallback de leitura para navegadores que não conseguirem decodificar a imagem. O cliente reduz a foto antes do envio; a API limita o payload, usa exclusivamente o diretório temporário do sistema (`/tmp` na Vercel) e apaga o arquivo no fim da mesma requisição. Uploads antigos continuam acessíveis somente em instalações locais, sem dependência de `storage` no fluxo atual.

## Plano de contas e relatórios

Em Produtos → Plano de contas, cada usuário pode criar, renomear, mover, colorir, desativar e excluir classificações vazias em qualquer profundidade. Classificações com produtos, subníveis ou histórico devem ser desativadas para preservar os vínculos.

O relatório de fluxo usa a mesma árvore. A trilha começa em Tudo e permite navegar por cada nível; cartões, gráfico de seis meses, consumo, estoque, composição e produtos são recalculados para a classificação escolhida e todos os seus descendentes.

## Câmera

O navegador só libera a câmera em contexto seguro. O acesso pelo IP em `http://192.168.1.35:5174` abre o app no celular, mas alguns navegadores bloquearão `getUserMedia` por não ser HTTPS. Nesse caso, use “Escolher foto”; em ambiente publicado, use HTTPS para liberar a câmera ao vivo.

## Verificação

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

As regras de normalização, similaridade, comportamento, duração, consumo mensal, fluxo e detecção de desvios ficam em `src/lib/domain.ts`, fora dos componentes visuais.
