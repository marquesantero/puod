# Implementação do Sistema de Clientes e Grupos no PUOD

## Visão Geral

Este documento descreve o plano para implementar a nova hierarquia de Clientes e Grupos no sistema PUOD, onde:

- **Clientes** representam organizações com informações gerais (basic info, contact, address, details)
- **Grupos** são criados automaticamente ao criar um cliente e contêm autenticação/integrações
- **Empresas** (Profiles) são membros de grupos e herdam informações do cliente

## Arquitetura de Dados

### 1. Novas Entidades e Relacionamentos

#### Cliente (Client)
- Informações gerais do cliente (basic info, contact, address, details)
- Um cliente pode ter múltiplos grupos de negócios
- Relacionamento: 1 para N com BusinessGroup

#### Grupo de Negócios (BusinessGroup)
- Criado automaticamente ao criar cliente (com nome definido no casdastro do cliente no campo obrigatório: default_group_name)
- Contém autenticação/integrações
- Relacionamento: 1 para N com Profile (empresas)
- Relacionamento: N para 1 com Client

#### Empresa (Profile - atual)
- Agora representa uma empresa dentro de um grupo
- Herda informações do cliente mas pode ter dados individuais
- Relacionamento: N para 1 com BusinessGroup

### 2. Modificações Necessárias

#### 2.1. Modificações no Modelo de Dados

**Cliente (Client)** - já existe e está completo
- Campos: nome, slug, tax_id, website, email, phone, address, city, state, country, postal_code, description, industry, employee_count, founded_date, logo_url

**BusinessGroup** - já existe e precisa de atualizações
- Adicionar campo `default_group` para identificar o grupo principal
- Mover autenticação e segurança para o nível de grupo
- Adicionar relacionamento com Client

**Profile (Empresa)** - modelo atual
- Remover campos de informações gerais (basic info, contact, address, details)
- Manter campos específicos da empresa
- Adicionar relacionamento com BusinessGroup

### 3. Implementação Passo a Passo

#### Fase 1: Modelagem de Dados e Migrações

**Passo 1.1: Atualizar modelos existentes**

```csharp
// Atualizar BusinessGroup.cs
public class BusinessGroup : IAuditableEntity, ISoftDelete
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [Column("client_id")]  // Novo campo
    public Guid ClientId { get; set; }

    [Required]
    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [Column("default_group")]  // Novo campo
    public bool DefaultGroup { get; set; } = false;

    // ... outros campos existentes

    public Client? Client { get; set; }  // Novo relacionamento
    public List<Profile> Profiles { get; set; } = new();

    // Segurança movida para o nível de grupo
    public List<AuthProfile> AuthProfiles { get; set; } = new();
    public List<Role> Roles { get; set; } = new();
    public List<Group> UserGroups { get; set; } = new();
}
```

**Passo 1.2: Criar migrações para atualizar o banco de dados**

- Adicionar coluna `client_id` à tabela `business_groups`
- Adicionar coluna `default_group` à tabela `business_groups`
- Remover campos de informações gerais da tabela `profiles`

#### Fase 2: Lógica de Negócio

**Passo 2.1: Criar Cliente**

1. Criar Cliente com informações gerais
2. Criar automaticamente um BusinessGroup com o mesmo nome
3. Marcar como `default_group = true`
4. Criar usuário admin do cliente (local) com acesso apenas ao cliente

**Passo 2.2: Criar Grupo**

1. Permitir criar grupos adicionais para um cliente
2. Associar ao cliente específico
3. Mover autenticação/integrações para o grupo

**Passo 2.3: Criar Empresa (Profile)**

1. Associar a um grupo existente
2. Definir se herdará informações do cliente ou terá dados individuais
3. Implementar preview de herança de informações

#### Fase 3: API Controllers

**Passo 3.1: Novo ClientController**

```csharp
[ApiController]
[Route("api/clients")]
[Authorize]
public class ClientController : ControllerBase
{
    [HttpPost]
    [Authorize(Policy = "SystemAdmin")]
    public async Task<ActionResult<ClientDetailResponse>> Create([FromBody] ClientCreateRequest request, CancellationToken ct)
    {
        // 1. Criar cliente
        // 2. Criar grupo padrão automaticamente
        // 3. Criar usuário admin local do cliente
    }

    [HttpGet]
    public async Task<ActionResult<List<ClientListResponse>>> GetAll(CancellationToken ct)
    {
        // Apenas SystemAdmins e ClientAdmins podem ver clientes
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ClientDetailResponse>> GetById(Guid id, CancellationToken ct)
    {
        // Detalhes do cliente com grupos e empresas
    }
}
```

**Passo 3.2: Atualizar CompanyController**

- Modificar para trabalhar com empresas dentro de grupos
- Implementar herança de informações do cliente
- Permitir configuração individual/ herdada

**Passo 3.3: Atualizar CompanyGroupsController**

- Modificar para refletir o novo conceito de BusinessGroup
- Associar grupos a clientes
- Implementar herança de autenticação/integrações

#### Fase 4: Interface do Usuário

**Passo 4.1: Novas telas**

1. Tela de gerenciamento de clientes (SystemAdmin)
2. Tela de gerenciamento de grupos por cliente (ClientAdmin)
3. Tela de criação/edição de empresas com opção de herança

**Passo 4.2: Atualizar gerenciamento de usuários**

- Implementar checkboxes para selecionar empresas nas quais aplicar roles
- Apenas mostrar empresas das quais o usuário é admin

#### Fase 5: Segurança e Autorização

**Passo 5.1: Novas roles**

- `client_admin`: Acesso total a um cliente específico
- Atualizar hierarquia de roles para refletir a nova estrutura

**Passo 5.2: Atualizar políticas de acesso**

- Modificar políticas para considerar a hierarquia Cliente → Grupo → Empresa
- Implementar verificação de acesso baseada na nova estrutura

## Mapeamento dos Recursos Atuais para a Nova Estrutura

### Clientes Especiais (Migração)

**Cliente Platform (inalterável)**
- ID: [será determinado na migração]
- Grupo padrão: "Puod" (criado automaticamente)
- Não pode ser alterado

**Cliente White Cube (normal, alterável)**
- ID: [será determinado na migração]
- Grupo padrão: "Think IT" (criado automaticamente)
- Pode ser alterado normalmente

### Migração de Dados

1. Migrar empresas existentes (Profiles) para a nova estrutura
2. Associar empresas ao grupo apropriado
3. Mover autenticação/integrações para o nível de grupo
4. Manter histórico e relacionamentos existentes

## Implementação Técnica

### 1. Modelos Atualizados

#### Client.cs (já implementado)
```csharp
[Table("clients")]
public class Client : IAuditableEntity, ISoftDelete
{
    // Campos de informações gerais
    [Column("tax_id")] public string? TaxId { get; set; }
    [Column("website")] public string? Website { get; set; }
    [Column("email")] public string? Email { get; set; }
    [Column("phone")] public string? Phone { get; set; }
    [Column("address")] public string? Address { get; set; }
    [Column("city")] public string? City { get; set; }
    [Column("state")] public string? State { get; set; }
    [Column("country")] public string? Country { get; set; }
    [Column("postal_code")] public string? PostalCode { get; set; }
    [Column("description")] public string? Description { get; set; }
    [Column("industry")] public string? Industry { get; set; }
    [Column("employee_count")] public int? EmployeeCount { get; set; }
    [Column("founded_date")] public DateTime? FoundedDate { get; set; }
    [Column("logo_url")] public string? LogoUrl { get; set; }

    // Relacionamentos
    public List<BusinessGroup> BusinessGroups { get; set; } = new();
}
```

#### BusinessGroup.cs (atualizado)
```csharp
[Table("business_groups")]
public class BusinessGroup : IAuditableEntity, ISoftDelete
{
    [Column("client_id")]
    public Guid ClientId { get; set; }

    [Column("default_group")]
    public bool DefaultGroup { get; set; } = false;

    // Segurança e autenticação no nível de grupo
    public List<AuthProfile> AuthProfiles { get; set; } = new();
    public List<Role> Roles { get; set; } = new();
    public List<Group> UserGroups { get; set; } = new();

    // Relacionamentos
    public Client? Client { get; set; }
    public List<Profile> Profiles { get; set; } = new();
}
```

#### Profile.cs (atualizado)
```csharp
[Table("profiles")]
public class Profile : IAuditableEntity, ISoftDelete
{
    [Column("business_group_id")]  // Novo campo
    public Guid BusinessGroupId { get; set; }

    // Remover campos de informações gerais
    // Manter campos específicos da empresa

    // Relacionamentos
    public BusinessGroup? BusinessGroup { get; set; }
    public List<User> Users { get; set; } = new();
    public List<UserTenantRole> UserTenantRoles { get; set; } = new();
    public List<CompanyGroupMembership> GroupMemberships { get; set; } = new();
}
```

### 2. Novos DTOs

#### ClientCreateRequest
```csharp
public class ClientCreateRequest
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string AdminEmail { get; set; } = string.Empty;
    public string AdminPassword { get; set; } = string.Empty;

    // Campos de informações gerais
    public string? TaxId { get; set; }
    public string? Website { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
    public string? PostalCode { get; set; }
    public string? Description { get; set; }
    public string? Industry { get; set; }
    public int? EmployeeCount { get; set; }
    public DateTime? FoundedDate { get; set; }
    public string? LogoUrl { get; set; }
}
```

#### CompanyCreateRequest (atualizado)
```csharp
public class CompanyCreateRequest
{
    public string Name { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public Guid BusinessGroupId { get; set; } // Novo campo
    public bool InheritFromClient { get; set; } = true; // Novo campo

    // Campos específicos da empresa (não herdados do cliente)
    public SubscriptionTier Tier { get; set; } = SubscriptionTier.Free;
    public string? LogoUrl { get; set; }
    // Outros campos específicos...
}
```

### 3. Serviços

#### ClientService
- Criar cliente e grupo padrão automaticamente
- Criar usuário admin local do cliente
- Gerenciar grupos do cliente

#### CompanyService (atualizado)
- Criar empresas associadas a grupos
- Implementar lógica de herança de informações
- Permitir configuração individual/ herdada

## Considerações de Implementação

### 1. Segurança
- O usuário admin do cliente terá acesso apenas às informações do cliente
- Será responsável por gerenciar grupos e empresas dentro do cliente
- Implementar políticas de autorização baseadas na nova hierarquia

### 2. Interface do Usuário
- Implementar pré-visualização de herança de informações
- Permitir fácil alternância entre configuração herdada/individual
- Atualizar painel de gerenciamento de usuários com checkboxes de empresas

### 3. Migração de Dados
- Planejar cuidadosamente a migração dos dados existentes
- Manter integridade dos relacionamentos
- Preservar histórico de auditoria

## Cronograma de Implementação

### Semana 1: Modelagem e Migrações
- Atualizar modelos de dados
- Criar e aplicar migrações
- Testar estrutura de banco de dados

### Semana 2: Lógica de Negócio
- Implementar ClientService
- Atualizar CompanyService
- Implementar lógica de herança

### Semana 3: API Controllers
- Criar ClientController
- Atualizar CompanyController
- Atualizar CompanyGroupsController

### Semana 4: Interface e Testes
- Implementar novas telas
- Atualizar gerenciamento de usuários
- Testes de integração e migração
