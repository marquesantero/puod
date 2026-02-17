# Plano de Correções de Arquitetura — PUOD

## Ordem de Execução (menor risco → maior risco)

---

## 1. Proteger Hangfire Dashboard (5 min — risco mínimo)

**Arquivo:** `src/Services/Reporting/Puod.Services.Reporting/Program.cs`

**Mudança:** Restringir dashboard apenas a ambiente Development. Em produção, desabilitar completamente.

```csharp
// ANTES:
app.UseHangfireDashboard("/hangfire", new DashboardOptions
{
    Authorization = new[] { new HangfireAuthorizationFilter() }
});

// DEPOIS:
if (app.Environment.IsDevelopment())
{
    app.UseHangfireDashboard("/hangfire", new DashboardOptions
    {
        Authorization = new[] { new HangfireAuthorizationFilter() }
    });
}
```

**Verificação:** `docker compose build reporting-service`

---

## 2. Resiliência no HttpClient Studio→Integration (15 min — risco baixo)

**Arquivos:**
- `src/Services/Studio/Puod.Services.Studio/Puod.Services.Studio.csproj` — add pacote
- `src/Services/Studio/Puod.Services.Studio/Program.cs` — registrar named client
- `src/Services/Studio/Puod.Services.Studio/Services/StudioIntegrationClient.cs` — usar named client

### Passo 2a: Adicionar pacote no .csproj
```xml
<PackageReference Include="Microsoft.Extensions.Http.Resilience" Version="9.0.0" />
```

### Passo 2b: Registrar named HttpClient com resiliência no Program.cs
```csharp
// ANTES:
builder.Services.AddHttpClient();

// DEPOIS:
builder.Services.AddHttpClient("IntegrationService", client =>
{
    var integrationUrl = builder.Configuration.GetValue<string>("IntegrationServiceUrl");
    if (!string.IsNullOrWhiteSpace(integrationUrl))
        client.BaseAddress = new Uri(integrationUrl);
})
.AddStandardResilienceHandler();
```

Isso adiciona automaticamente:
- Retry com exponential backoff (até 3 tentativas)
- Timeout de 30 segundos por tentativa
- Circuit breaker (abre após 5 falhas consecutivas)
- Timeout total de 2 minutos

### Passo 2c: Refatorar StudioIntegrationClient para usar named client
- Trocar `IHttpClientFactory` + `CreateClient()` genérico
- Para `HttpClient` injetado diretamente (via typed/named client)
- Remover configuração manual de BaseAddress (já vem do registro)
- Manter lógica de Bearer token e medição de tempo

**Verificação:** `docker compose build studio-service`

---

## 3. Ativar Redis como Distributed Cache (30 min — risco médio)

O Redis já roda no docker-compose e todos os serviços já recebem a ConnectionString.
Vamos ativar nos 2 serviços que mais se beneficiam: **Integration** e **Studio**.

### Passo 3a: Integration Service — cache de metadados

**Arquivos:**
- `src/Services/Integration/Puod.Services.Integration/Puod.Services.Integration.csproj` — add pacote
- `src/Services/Integration/Puod.Services.Integration/Program.cs` — registrar Redis cache
- `src/Services/Integration/Puod.Services.Integration/Services/IntegrationService.cs` — cachear ListDatabases e ListTables

**Pacote:** `Microsoft.Extensions.Caching.StackExchangeRedis` (versão 8.x para net8.0)

**Endpoints cacheados:**
- `ListDatabases(id)` → TTL 15 min (metadados mudam raramente)
- `ListTables(id, database)` → TTL 15 min (idem)
- **NÃO** cachear `ExecuteQuery` (queries dinâmicas, dados frescos)

**Invalidação:** Ao deletar/atualizar uma integration, invalidar cache por integrationId.

### Passo 3b: Studio Service — cache de listagens

**Arquivos:**
- `src/Services/Studio/Puod.Services.Studio/Puod.Services.Studio.csproj` — add pacote
- `src/Services/Studio/Puod.Services.Studio/Program.cs` — registrar Redis cache
- `src/Services/Studio/Puod.Services.Studio/Services/StudioCardService.cs` — cachear listagens
- `src/Services/Studio/Puod.Services.Studio/Services/StudioDashboardService.cs` — cachear listagens

**Pacote:** `Microsoft.Extensions.Caching.StackExchangeRedis` (versão 9.x para net9.0)

**Endpoints cacheados:**
- `ListCards(scope, clientId, profileId)` → TTL 2 min
- `ListDashboards(scope, clientId, profileId)` → TTL 2 min

**Invalidação:** Nos mutations (create/update/delete/clone), remover as chaves de cache correspondentes.

**Verificação:** `docker compose build integration-service studio-service`

---

## 4. Versionamento de API (45 min — risco alto, muitos arquivos)

Maior mudança — afeta TODOS os serviços, Gateway e Frontend.

### Passo 4a: Backend — instalar e configurar Asp.Versioning

**Para cada serviço (User, Integration, Studio, Reporting):**

1. Adicionar pacotes ao `.csproj`:
   - `Asp.Versioning.Mvc`
   - `Asp.Versioning.Mvc.ApiExplorer`
   (versão 8.x para net8.0, 9.x para net9.0)

2. No `Program.cs` de cada serviço, adicionar:
   ```csharp
   builder.Services.AddApiVersioning(options =>
   {
       options.DefaultApiVersion = new ApiVersion(1, 0);
       options.AssumeDefaultVersionWhenUnspecified = true;
       options.ReportApiVersions = true;
       options.ApiVersionReader = new UrlSegmentApiVersionReader();
   })
   .AddApiExplorer(options =>
   {
       options.GroupNameFormat = "'v'VVV";
       options.SubstituteApiVersionInUrl = true;
   });
   ```

3. Em TODOS os Controllers, alterar Route:
   - `[Route("api/auth")]` → `[Route("api/v{version:apiVersion}/auth")]`
   - `[Route("api/[controller]")]` → `[Route("api/v{version:apiVersion}/[controller]")]`
   - `[Route("api/studio/cards")]` → `[Route("api/v{version:apiVersion}/studio/cards")]`
   - etc.

4. Adicionar `[ApiVersion("1.0")]` em todos os Controllers.

### Passo 4b: Gateway YARP — atualizar rotas

No `appsettings.json` do Gateway, cada rota precisa incluir `v{**}`:
- `/api/auth/{**catch-all}` → `/api/v{version}/auth/{**catch-all}` (ou `/api/{version:regex(v\\d+)}/auth/{**catch-all}`)

**Abordagem prática com YARP:** usar prefix matching `api/v{version}/...`
Como YARP não suporta constraints regex, usamos catch-all:
- `/api/{**catch-all}` por cluster, prefixando o path por serviço.

### Passo 4c: Frontend — atualizar base URL

No `api-client.ts`:
```typescript
// ANTES:
baseURL: import.meta.env.VITE_API_BASE_URL || '/api',

// DEPOIS:
baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
```

E em `authProfileApi.ts` que tem baseURL hardcoded.

**Verificação:**
- `docker compose build` (todos os serviços)
- `cd src/Frontend && npx tsc --noEmit && npx vite build`

---

## Resumo de Impacto

| Item | Arquivos | Risco | Tempo |
|------|----------|-------|-------|
| Hangfire | 1 | Mínimo | 5 min |
| Resiliência | 3 | Baixo | 15 min |
| Redis Cache | ~8 | Médio | 30 min |
| API Versioning | ~25+ | Alto | 45 min |
