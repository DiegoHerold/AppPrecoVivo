# Motor Inteligente de Inferência de Consumo (sem IA)

Camadas de cálculo estatístico que estimam **consumo** e **estoque** a partir do
histórico de compras. Não usa IA, LLM nem API externa — apenas regras e
estatística determinística. Está preparado para, no futuro, receber uma camada
de IA **apenas como explicação**, sem alterar o motor de cálculo.

## Princípio central

A próxima compra **não** marca o dia exato em que o produto acabou. Toda saída é
uma **estimativa com nível de confiança**, e **reposição** (compra registrada)
nunca é tratada como **consumo** (uso estimado ao longo do tempo).

## Arquitetura

```
src/
  domain/
    types/           # ConfidenceLevel, TrendDirection, StockStatus, InferenceEventType, SeriesStats
    value-objects/   # Quantity (conversão de unidade), datas
    entities/        # PurchaseRecord, ProductInput, InferenceEvent, ProductInference...
  engine/            # TODA a regra estatística vive aqui (funções puras)
    statistics/      # média, mediana, desvio, média móvel, intervalos, sazonalidade, tendência linear
    confidence/      # classifica confiança (muito_baixa..alta, instavel) + textos honestos
    consumption/     # consumo diário/mensal, tendência, frequência (recalculado a cada compra)
    inventory/       # estoque estimado acumulado, decremento diário, dias restantes, status
    trends/          # eventos por compra (antecipada, tardia, possível falta, grande volume...)
    index.ts         # inferProduct(): compõe tudo numa ProductInference (PURO, data injetável)
  repositories/      # leem do Prisma e mapeiam para o domínio (sem regra de negócio)
  services/          # report.service (dashboards), invoice-import, product-normalization
  presentation/      # consome DTOs prontos; NUNCA contém regra de negócio
```

## Garantias do modelo

- **Soma ao estoque:** toda compra soma à quantidade estimada (3kg + 5kg = 8kg).
  Nova compra **nunca zera** o estoque.
- **Decremento diário:** entre compras o estoque cai conforme o consumo estimado.
- **Reconstrução pura:** o estoque é recalculado a partir do histórico imutável
  (`reconstructStock`) — nada é sobrescrito.
- **Consumo ≠ reposição:** o consumo diário exclui a última compra (ainda em
  estoque), evitando confundir o que foi reposto com o que foi usado.
- **Pouca informação → baixa confiança:** funciona com poucos dados, mas degrada
  a confiança em vez de inventar certezas.
- **Eventos derivados:** compra antecipada/tardia, possível período sem produto,
  grande volume e tendências são calculados, nunca persistidos sobre o histórico.

## Uso

```ts
import { buildProductDashboard, buildGeneralDashboard } from '@/services/report.service'

const produto = await buildProductDashboard(userId, productId) // dashboard do produto
const geral = await buildGeneralDashboard(userId)              // dashboard geral
```

API: `GET /api/inference` (geral) e `GET /api/inference?productId=...` (produto).

## Testes

```
npm test   # 33 testes cobrindo statistics, confidence, consumption, inventory,
           # conversão de unidade e composição do motor (inferProduct)
```

A data "agora" é sempre **injetada** (`asOf`), tornando o motor 100% determinístico
e testável.
