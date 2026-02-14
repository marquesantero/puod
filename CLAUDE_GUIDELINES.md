# PUOD - Diretrizes de Desenvolvimento para Claude

## Premissas Fundamentais

### 1. Gerenciamento de Banco de Dados
- **NUNCA fazer mudanças diretas no banco de dados via SQL**
- **SEMPRE usar Entity Framework Migrations** para alterações de schema
- **SEMPRE gerar migrations para TODOS os provedores suportados**:
  - Postgres: `src/Services/User/Puod.Services.User.Migrations.Postgres`
  - SqlServer: `src/Services/User/Puod.Services.User.Migrations.SqlServer`
  - MySql: `src/Services/User/Puod.Services.User.Migrations.MySql`
- Processo correto:
  1. Modificar os modelos em `Puod.Services.User.Data/Models/`
  2. Criar migration Postgres: `dotnet ef migrations add <NomeDaMigration> --project ../Puod.Services.User.Migrations.Postgres`
  3. Criar migration SqlServer: `dotnet ef migrations add <NomeDaMigration> --project ../Puod.Services.User.Migrations.SqlServer`
  4. Criar migration MySql: `dotnet ef migrations add <NomeDaMigration> --project ../Puod.Services.User.Migrations.MySql`
  5. Aplicar migration: `dotnet ef database update`
  6. Verificar migrations em cada pasta de projeto.

### 2. Internacionalização (i18n)
- **NUNCA usar textos hardcoded em componentes React**
- **SEMPRE usar o sistema i18n** com a função `t()` do contexto `useI18n`
- Adicionar traduções em: `src/Frontend/src/i18n/messages.ts`
- Suportar **inglês (en)** e **português brasileiro (pt-BR)**
- Exceção: Textos que são universais entre idiomas (ex: URLs, códigos técnicos)

### 3. Suporte a Temas (Dark Mode)
- **SEMPRE implementar suporte a dark mode** em todos os componentes visuais
- **SEMPRE usar Tailwind CSS variants** `dark:` para cores, backgrounds, borders, etc.
- Testar componentes em ambos os temas (light e dark)
- Garantir contraste adequado em ambos os temas
- Exemplo: `className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"`

### 4. Implementação Real
- **NUNCA criar código com dados mockados**
- **SEMPRE implementar funcionalidades reais** conectadas ao backend
- Usar dados de exemplo apenas em documentação/comentários, nunca em código funcional
- Integração backend-frontend deve ser completa e funcional

### 5. Build e Deploy
- **NÃO executar builds automaticamente**
- Builds e deploys são responsabilidade do desenvolvedor humano
- Fornecer instruções quando mudanças exigirem rebuild
- Não tentar reiniciar serviços automaticamente

## Arquitetura do Projeto

### Backend (.NET 8/9)
- **Microserviços**: User Service, Data Service, etc.
- **Banco de dados**: PostgreSQL com TimescaleDB
- **Cache**: Redis
- **Mensageria**: RabbitMQ
- **Multi-tenancy**: Schema-based isolation

### Frontend (React + TypeScript)
- **Framework**: React 18 com TypeScript
- **UI**: Tailwind CSS + shadcn/ui
- **Roteamento**: React Router
- **API Client**: Axios
- **Suporte**: Dark mode obrigatório

### Padrões de Código

#### Backend (.NET)
```csharp
// ✅ CORRETO - Usar migrations
public class Profile
{
    [Column("new_field")]
    public string? NewField { get; set; }
}
// Depois: dotnet ef migrations add AddNewField

// ❌ ERRADO - SQL direto
// ALTER TABLE profiles ADD COLUMN new_field TEXT;
```

#### Frontend (React)
```tsx
// ✅ CORRETO - Usar i18n
const { t } = useI18n();
<h1>{t("companiesTitle")}</h1>

// ❌ ERRADO - Hardcoded
<h1>Companies</h1>
```

```tsx
// ✅ CORRETO - Dados reais da API
const [companies, setCompanies] = useState<Company[]>([]);
const data = await getCompanies();
setCompanies(data);

// ❌ ERRADO - Mock data
const companies = [
  { id: 1, name: "Test Company" }
];
```

## Estrutura de Diretórios

```
puod/
├── src/
│   ├── Frontend/                    # React application
│   │   ├── src/
│   │   │   ├── components/         # UI components
│   │   │   ├── pages/              # Page components
│   │   │   ├── lib/                # API clients
│   │   │   ├── i18n/               # Translations
│   │   │   └── contexts/           # React contexts
│   ├── Services/
│   │   └── User/
│   │       ├── Puod.Services.User/              # Main service
│   │       ├── Puod.Services.User.Data/         # Models & DbContext
│   │       └── Puod.Services.User.Migrations.*/ # EF Migrations
├── INFRAESTRUTURA_PUOD.md          # Infrastructure docs
├── NEGOCIO_PUOD.md                 # Business docs
└── CLAUDE_GUIDELINES.md            # Este arquivo
```

## Checklist para Novas Features

- [ ] Modelos do backend atualizados em `Models/`
- [ ] DTOs criados em `DTOs/`
- [ ] Controller implementado com endpoints REST
- [ ] Migration criada e documentada
- [ ] API client TypeScript criado em `lib/`
- [ ] Componente React implementado
- [ ] Traduções adicionadas em `messages.ts` (EN + PT-BR)
- [ ] Dark mode suportado (Tailwind `dark:` variants)
- [ ] Validação de formulários implementada
- [ ] Error handling implementado
- [ ] Loading states implementados

## Comandos Importantes

### Backend
```bash
# Criar migration
cd src/Services/User/Puod.Services.User
dotnet ef migrations add <NomeDaMigration>

# Aplicar migration
dotnet ef database update

# Reverter migration
dotnet ef database update <MigrationAnterior>

# Remover última migration (se não aplicada)
dotnet ef migrations remove
```

### Frontend
```bash
cd src/Frontend

# Desenvolvimento
npm run dev

# Build
npm run build

# Type check
npm run type-check
```

### Docker
```bash
# Subir infraestrutura (Postgres, Redis, RabbitMQ)
docker-compose up -d

# Ver logs
docker logs puod-postgres
docker logs puod-redis
docker logs puod-rabbitmq

# Parar serviços
docker-compose down
```

## Autenticação

- **Bootstrap Admin**: `puod_admin` / `passwd_admin` (sempre disponível)
- **Roles**: `system_admin`, `user`, `owner`, `admin`, `editor`, `viewer`
- **Políticas**: `SystemAdmin` (requer role `system_admin`)
- JWT tokens para autenticação de API

## Multi-tenancy

- Cada empresa (Profile) tem seu próprio schema no PostgreSQL
- Schema naming: `tenant_{slug}`
- UserTenantRole relaciona usuários com empresas e roles
- Slug gerado automaticamente a partir do nome da empresa

## Contato e Suporte

Para dúvidas sobre o projeto PUOD, consultar:
- `INFRAESTRUTURA_PUOD.md` - Detalhes técnicos de infraestrutura
- `NEGOCIO_PUOD.md` - Regras de negócio e requisitos
- Este arquivo - Diretrizes de desenvolvimento

---

**Última atualização**: 2025-12-22
**Versão**: 1.0
