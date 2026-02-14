# Plano de Migração de Dados para Nova Hierarquia Cliente-Grupo-Empresa

## Visão Geral

Este documento descreve o plano de migração para transformar a estrutura atual de empresas (Profiles) para a nova hierarquia Cliente → Grupo → Empresa.

## Situação Atual

### Entidades Existentes
- **Profile** (empresas atuais): Contém informações gerais e específicas
- **CompanyGroup**: Estrutura de grupos já existente (usada como base para BusinessGroup)
- **AuthProfile**: Configurações de autenticação associadas a perfis

## Objetivo da Migração

Transformar a estrutura:
- **Antes**: Profile (contendo informações gerais + específicas)
- **Depois**: Client → BusinessGroup → Profile (apenas informações específicas)

## Mapeamento de Dados

### Clientes Especiais (Fixos)

#### Cliente Platform (inalterável)
- **Origem**: Empresa existente com nome "Platform"
- **Ação**: Criar Cliente com informações da empresa existente
- **Grupo Padrão**: Criar automaticamente grupo "Puod"
- **Status**: Não pode ser alterado após migração

#### Cliente White Cube (alterável)
- **Origem**: Empresa existente com nome "White Cube"
- **Ação**: Criar Cliente com informações da empresa existente
- **Grupo Padrão**: Criar automaticamente grupo "Think IT"
- **Status**: Pode ser alterado normalmente após migração

### Demais Empresas
- **Origem**: Todas as outras empresas (Profiles) existentes
- **Ação**: Associar a grupos apropriados ou criar novos grupos conforme regras de negócio

## Estratégia de Migração

### Fase 1: Preparação

#### 1.1. Identificação dos Clientes Especiais
```sql
-- Identificar empresas especiais
SELECT id, name, slug, email, address, city, state, country, description 
FROM profiles 
WHERE name IN ('Platform', 'White Cube') AND is_deleted = false;
```

#### 1.2. Backup dos Dados
- Fazer backup completo do banco de dados antes da migração
- Documentar relacionamentos atuais

### Fase 2: Criação da Estrutura de Clientes

#### 2.1. Criar Clientes Especiais
```csharp
// Criar Clientes para Platform e White Cube
var platformClient = new Client
{
    Name = "Platform",
    Slug = "platform",
    Email = platformProfile.Email,
    Address = platformProfile.Address,
    City = platformProfile.City,
    State = platformProfile.State,
    Country = platformProfile.Country,
    Description = platformProfile.Description,
    // ... outros campos de informações gerais
    IsActive = true
};

var whiteCubeClient = new Client
{
    Name = "White Cube",
    Slug = "white-cube",
    Email = whiteCubeProfile.Email,
    Address = whiteCubeProfile.Address,
    City = whiteCubeProfile.City,
    State = whiteCubeProfile.State,
    Country = whiteCubeProfile.Country,
    Description = whiteCubeProfile.Description,
    // ... outros campos de informações gerais
    IsActive = true
};
```

#### 2.2. Criar Grupos Padrão
```csharp
// Grupo "Puod" para Platform
var platformGroup = new BusinessGroup
{
    Name = "Puod",
    ClientId = platformClient.Id,
    DefaultGroup = true,
    IsActive = true
};

// Grupo "Think IT" para White Cube
var whiteCubeGroup = new BusinessGroup
{
    Name = "Think IT",
    ClientId = whiteCubeClient.Id,
    DefaultGroup = true,
    IsActive = true
};
```

### Fase 3: Migração das Empresas

#### 3.1. Associar Empresas Especiais aos Seus Grupos
```csharp
// Atualizar empresas especiais para apontar para seus grupos
platformProfile.BusinessGroupId = platformGroup.Id;
whiteCubeProfile.BusinessGroupId = whiteCubeGroup.Id;

// Remover campos de informações gerais da empresa
// Manter apenas campos específicos da empresa
```

#### 3.2. Processar Demais Empresas
- Criar grupos apropriados para outras empresas
- Estabelecer regras de agrupamento (por exemplo, por similaridade de nome, domínio, etc.)

### Fase 4: Migração de Autenticação e Integrações

#### 4.1. Mover Autenticação para o Nível de Grupo
```csharp
// Mover AuthProfiles do nível de Profile para o nível de BusinessGroup
var platformAuthProfiles = authProfiles.Where(ap => ap.ProfileId == platformProfile.Id);
foreach (var authProfile in platformAuthProfiles)
{
    authProfile.BusinessGroupId = platformGroup.Id;
    authProfile.OwnerType = OwnerType.Group; // ou atualizar conforme necessário
}
```

#### 4.2. Mover Integrações para o Nível de Grupo
```csharp
// Mover Integrações do nível de Profile para o nível de BusinessGroup
var platformIntegrations = integrations.Where(i => i.ProfileId == platformProfile.Id);
foreach (var integration in platformIntegrations)
{
    integration.BusinessGroupId = platformGroup.Id;
    integration.OwnerType = OwnerType.Group;
}
```

### Fase 5: Atualização de Relacionamentos

#### 5.1. Atualizar UserTenantRoles
- Atualizar relacionamentos de usuário para apontar para o novo Profile (mesmo ID, mas com nova estrutura)
- Manter permissões e roles existentes

#### 5.2. Atualizar Outros Relacionamentos
- Auditing
- RefreshTokens
- Outros relacionamentos que apontam para Profiles

## Scripts de Migração

### Script 1: Criação de Clientes e Grupos Padrão
```sql
-- Inserir clientes especiais
INSERT INTO clients (id, name, slug, email, address, city, state, country, description, is_active, created_at)
SELECT 
    gen_random_uuid(), 
    name, 
    slug, 
    email, 
    address, 
    city, 
    state, 
    country, 
    description, 
    is_active, 
    created_at
FROM profiles 
WHERE name IN ('Platform', 'White Cube') AND is_deleted = false;

-- Obter os IDs dos clientes criados
WITH platform_client AS (
    SELECT id FROM clients WHERE name = 'Platform'
),
whitecube_client AS (
    SELECT id FROM clients WHERE name = 'White Cube'
)

-- Criar grupos padrão
INSERT INTO business_groups (id, client_id, name, default_group, is_active, created_at)
SELECT 
    gen_random_uuid(),
    (SELECT id FROM platform_client),
    'Puod',
    true,
    true,
    NOW()
WHERE EXISTS (SELECT 1 FROM platform_client);

INSERT INTO business_groups (id, client_id, name, default_group, is_active, created_at)
SELECT 
    gen_random_uuid(),
    (SELECT id FROM whitecube_client),
    'Think IT',
    true,
    true,
    NOW()
WHERE EXISTS (SELECT 1 FROM whitecube_client);
```

### Script 2: Atualizar Profiles com BusinessGroupId
```sql
-- Atualizar Platform Profile com BusinessGroupId
UPDATE profiles 
SET business_group_id = (
    SELECT id FROM business_groups 
    WHERE name = 'Puod' AND default_group = true
)
WHERE name = 'Platform';

-- Atualizar White Cube Profile com BusinessGroupId
UPDATE profiles 
SET business_group_id = (
    SELECT id FROM business_groups 
    WHERE name = 'Think IT' AND default_group = true
)
WHERE name = 'White Cube';
```

### Script 3: Mover Autenticação para Nível de Grupo
```sql
-- Atualizar AuthProfiles para apontar para BusinessGroup em vez de Profile
UPDATE auth_profiles 
SET business_group_id = p.business_group_id
FROM profiles p
WHERE auth_profiles.profile_id = p.id 
  AND p.name IN ('Platform', 'White Cube');
```

## Considerações de Segurança

### 1. Usuários Admin dos Clientes
- Criar usuários admin locais para os clientes Platform e White Cube
- Atribuir permissões apropriadas para gerenciar seus clientes

### 2. Preservação de Permissões
- Manter todas as permissões e roles existentes
- Garantir continuidade de acesso para usuários atuais

## Validadores e Testes

### 1. Validação da Migração
- Verificar integridade dos relacionamentos
- Confirmar que todos os dados foram migrados corretamente
- Validar que nenhuma empresa foi perdida

### 2. Testes de Funcionalidade
- Testar acesso às empresas após migração
- Verificar funcionamento de autenticação
- Validar integrações existentes

## Rollback Plan

### Em Caso de Problemas
1. Restaurar backup do banco de dados
2. Reverter alterações na aplicação
3. Documentar problemas encontrados para correção futura

## Cronograma de Migração

### Dia 1: Preparação
- Backup completo do banco de dados
- Testar scripts de migração em ambiente de desenvolvimento
- Preparar scripts de validação

### Dia 2: Execução da Migração
- Executar scripts de migração em ambiente de teste
- Validar resultados
- Repetir para ambiente de produção com supervisão

### Dia 3: Validação e Testes
- Validar integridade dos dados
- Testar funcionalidades críticas
- Verificar acesso e permissões

## Recursos Necessários

- Cópia de backup do banco de dados
- Ambiente de testes para validação
- Equipe técnica disponível para monitoramento
- Plano de comunicação para usuários afetados