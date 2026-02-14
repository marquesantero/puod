# Documento de Infraestrutura - P.U.O.D. (Plataforma Unificada de Observabilidade e Dados)

## Visão Geral

O P.U.O.D. (Plataforma Unificada de Observabilidade e Dados) é uma plataforma moderna de microsserviços projetada para integração, monitoramento e análise de dados de múltiplas fontes de Business Intelligence (BI) e pipelines de dados. A arquitetura é baseada em .NET 8/9 com componentes React para frontend, implementando práticas de engenharia moderna e segurança robusta. A plataforma adota uma hierarquia de Clientes-Grupos-Empresas para permitir uma gestão mais eficiente e centralizada de múltiplas organizações com estruturas corporativas complexas.

## Arquitetura de Microsserviços

### 1. Gateway API (puod-gateway)
- **Função**: Ponto de entrada único para todas as requisições da API
- **Tecnologia**: ASP.NET Core com YARP (Reverse Proxy)
- **Responsabilidades**:
  - Autenticação e autorização JWT
  - Roteamento de requisições para microsserviços
  - Implementação de políticas de segurança
  - Balanceamento de carga básico

### 2. Microsserviços de Backend

#### 2.1. User Service (puod-user-service)
- **Função**: Gerenciamento de autenticação, autorização e hierarquia de Clientes-Grupos-Empresas
- **Tecnologia**: ASP.NET Core com Entity Framework Core
- **Responsabilidades**:
  - Autenticação JWT
  - Gerenciamento da hierarquia: Clientes → Grupos de Negócios → Empresas (Profiles)
  - Controle de acesso baseado em roles (RBAC) com suporte a múltiplos níveis hierárquicos
  - Configuração inicial do banco de dados via wizard
  - Suporte a múltiplos provedores de banco de dados (PostgreSQL, SQL Server, MySQL)
  - Criação automática de grupo padrão ao criar cliente
  - Gestão de herança de autenticação e integrações entre grupos e empresas
  - Gerenciamento de Client Admin com acesso total ao cliente e seus grupos/empresas
  - Controle de herança de informações do cliente para empresas (individual ou herdado)

#### 2.2. Integration Service (puod-integration-service)
- **Função**: Conectividade com fontes de dados e BI
- **Tecnologia**: ASP.NET Core com PostgreSQL/TimescaleDB
- **Responsabilidades**:
  - Conectores para Airflow, Azure Data Factory, Databricks, Synapse
  - Autenticação via cookies de navegador ou credenciais
  - Monitoramento agendado de pipelines
  - Extração de métricas de execução
  - Gerenciamento de integrações no nível de grupo (BusinessGroup) ou empresa (Profile)
  - Configuração de herança de integrações entre grupos e empresas
  - Suporte a múltiplos níveis de propriedade (grupo ou empresa específica)

#### 2.3. Monitoring Service (puod-monitoring-service)
- **Função**: Processamento e armazenamento de métricas
- **Tecnologia**: ASP.NET Core Worker Services com TimescaleDB
- **Responsabilidades**:
  - Processamento assíncrono de métricas
  - Armazenamento otimizado de séries temporais
  - Agregação de dados para análise
  - Processamento contínuo via background workers
  - Monitoramento consolidado por grupo de empresas
  - Visualização de métricas em diferentes níveis hierárquicos (cliente, grupo, empresa)

#### 2.4. Reporting Service (puod-reporting-service)
- **Função**: Geração de relatórios e dashboards
- **Tecnologia**: ASP.NET Core com Hangfire
- **Responsabilidades**:
  - Geração assíncrona de relatórios
  - Processamento em background via Hangfire
  - Exportação para múltiplos formatos (Excel, JSON, etc.)
  - Dashboard de administração do Hangfire
  - Relatórios consolidados por grupo de empresas
  - Suporte a diferentes níveis de visibilidade (cliente, grupo, empresa)

### 3. Frontend (puod-frontend)
- **Função**: Interface de usuário moderna e responsiva
- **Tecnologia**: React 19 + TypeScript + Tailwind CSS
- **Responsabilidades**:
  - Interface de usuário rica e interativa com suporte a hierarquia de Clientes-Grupos-Empresas
  - Suporte a dark mode
  - Internacionalização (i18n) para EN/PT-BR
  - Componentes reutilizáveis com shadcn/ui
  - Gerenciamento de estado com React Query
  - Navegação hierárquica (Cliente → Grupo → Empresa)
  - Interface de configuração de herança de informações e integrações
  - Painel de administração de Client Admin com visão consolidada

## Infraestrutura de Dados

### 1. PostgreSQL com TimescaleDB
- **Função**: Banco de dados principal para persistência de dados
- **Características**:
  - Suporte a hiper tabelas para séries temporais
  - Alta performance para consultas analíticas
  - Suporte a dados de tempo real
  - Replicação e backup configuráveis
  - Estruturação de dados para suportar hierarquia de Clientes-Grupos-Empresas
  - Tabelas específicas para: clients, business_groups, profiles (empresas)
  - Relacionamentos hierárquicos entre entidades

### 2. Redis
- **Função**: Cache distribuído e sessões
- **Características**:
  - Cache de consultas pré-calculadas
  - Armazenamento de sessões de autenticação
  - Persistência de dados configurável
  - Alta disponibilidade
  - Cache de configurações hierárquicas (cliente/grupo/empresa)

### 3. RabbitMQ
- **Função**: Mensageria para comunicação assíncrona
- **Características**:
  - Filas para processamento assíncrono
  - Exchanges para diferentes tipos de eventos
  - Garantia de entrega de mensagens
  - Interface de administração web
  - Suporte a eventos hierárquicos (cliente, grupo, empresa)

## Segurança e Autenticação

### 1. Autenticação JWT
- **Implementação**: Tokens JWT com assinatura HMAC SHA256
- **Validação**: Tempo de vida, emissor, audiência e chave de assinatura
- **Armazenamento**: Tokens em cookies seguros ou cabeçalho Authorization
- **Escopo**: Tokens podem ter escopo por cliente, grupo ou empresa

### 2. Controle de Acesso (RBAC)
- **Roles**: system_admin, client_admin, owner, admin, editor, viewer
- **Políticas**: Controle baseado em claims e roles com suporte a múltiplos níveis hierárquicos
- **Multi-tenancy**: Isolamento de dados por BusinessGroup (grupo de negócios)
- **Herança de Permissões**: Permissões podem ser aplicadas a grupos e herdadas pelas empresas
- **Acesso Granular**: Controle de acesso em diferentes níveis (cliente, grupo, empresa)

### 3. Segurança de Dados
- **Isolamento**: Schema-based multi-tenancy no nível de BusinessGroup
- **Auditoria**: Logs completos de acesso e operações com rastreamento hierárquico
- **Criptografia**: Dados em trânsito (TLS) e em repouso (configurável)
- **Controle de Herança**: Mecanismos para controlar o que é herdado entre cliente/grupo/empresa

## Orquestração e Deploy

### 1. Docker Compose
- **Infraestrutura como Código**: Configuração declarativa de todos os serviços
- **Rede Isolada**: Rede Docker dedicada para comunicação interna
- **Volumes Persistentes**: Dados mantidos entre reinicializações
- **Health Checks**: Verificação de saúde dos serviços antes de liberar tráfego
- **Configuração Hierárquica**: Suporte a múltiplos ambientes com diferentes estruturas de cliente/grupo/empresa

### 2. Configuração de Ambientes
- **Variáveis de Ambiente**: Gerenciamento de configurações por ambiente
- **Secrets Management**: Valores sensíveis protegidos via variáveis de ambiente
- **Configuração Centralizada**: AppSettings para configurações de aplicação
- **Configuração Hierárquica**: Suporte a configurações específicas por cliente/grupo/empresa

## Monitoramento e Observabilidade

### 1. Health Checks
- **Endpoints**: Cada serviço expõe endpoint de health check
- **Status**: Monitoramento de disponibilidade e integridade
- **Integração**: Compatível com ferramentas de orquestração
- **Visão Hierárquica**: Health checks podem ser visualizados por cliente/grupo/empresa

### 2. Logs e Métricas
- **Estruturação**: Logs em formato estruturado (JSON) com informações hierárquicas
- **Centralização**: Configuração para envio a sistemas de log centralizados
- **Métricas**: Coleta de métricas de desempenho e utilização com rastreamento hierárquico
- **Agrupamento**: Capacidade de agrupar e consolidar métricas por cliente/grupo/empresa

## Desenvolvimento e CI/CD

### 1. Práticas de Desenvolvimento
- **Migrations**: Entity Framework Migrations para todos os provedores
- **Internacionalização**: Sistema i18n com suporte a múltiplos idiomas
- **Dark Mode**: Suporte obrigatório em todos os componentes visuais
- **Dados Reais**: Nenhum dado mockado em implementações funcionais
- **Desenvolvimento Hierárquico**: Práticas que suportam a estrutura de cliente/grupo/empresa

### 2. Ferramentas de Desenvolvimento
- **IDEs Suportadas**: Visual Studio, Visual Studio Code
- **TypeScript**: Tipagem estática no frontend
- **ESLint**: Análise estática de código
- **Tailwind CSS**: Estilização responsiva e consistente
- **Ferramentas de Hierarquia**: Componentes e bibliotecas que suportam a estrutura hierárquica

## Componentes Técnicos

### 1. Frontend Components
- **React 19**: Nova arquitetura com melhor performance
- **TypeScript**: Tipagem estática completa
- **Tailwind CSS**: Estilização utility-first
- **shadcn/ui**: Componentes acessíveis e customizáveis
- **React Router**: Navegação declarativa com suporte a rotas hierárquicas
- **React Query**: Gerenciamento de estado assíncrono
- **Componentes Hierárquicos**: Componentes específicos para navegação e gerenciamento da hierarquia

### 2. Backend Components
- **ASP.NET Core**: Framework web de alta performance
- **Entity Framework Core**: ORM com suporte a múltiplos provedores e mapeamento hierárquico
- **Hangfire**: Processamento em background
- **YARP**: Proxy reverso de alta performance
- **MediatR**: Padrão CQRS e Mediator
- **Componentes de Hierarquia**: Serviços e componentes específicos para gerenciar a estrutura de cliente/grupo/empresa

## Escalabilidade e Performance

### 1. Horizontal Scaling
- **Stateless Services**: Microsserviços sem estado para fácil escalabilidade
- **Cache Distribuído**: Redis para cache compartilhado
- **Balanceamento de Carga**: Suporte a múltiplas instâncias
- **Escalabilidade Hierárquica**: Capacidade de escalar diferentes níveis da hierarquia de forma independente

### 2. Otimizações de Performance
- **Caching Inteligente**: Cache de consultas e resultados com TTL e suporte a hierarquia
- **Processamento Assíncrono**: Tarefas pesadas em background
- **Conexões Pooling**: Gerenciamento eficiente de conexões de banco de dados
- **Consulta Otimizada**: Uso de índices e consultas eficientes com suporte a estrutura hierárquica
- **Consolidação de Dados**: Otimizações para consultas consolidadas por grupo de empresas

## Recuperação de Desastres

### 1. Backup e Restauração
- **PostgreSQL**: Backups regulares configuráveis com suporte a estrutura hierárquica
- **Redis**: Persistência RDB e AOF
- **Procedimentos**: Scripts e procedimentos documentados para restauração hierárquica
- **Recuperação Granular**: Capacidade de restaurar dados específicos por cliente/grupo/empresa

### 2. Alta Disponibilidade
- **Replicação**: Configuração de réplicas para serviços críticos
- **Monitoramento**: Detecção automática de falhas em diferentes níveis hierárquicos
- **Recuperação**: Procedimentos automatizados de recuperação com suporte a hierarquia

## Conclusão

A arquitetura do PUOD é projetada para ser escalável, segura e mantível, seguindo as melhores práticas de engenharia de software moderna. A nova hierarquia de Clientes-Grupos-Empresas permite uma gestão mais eficiente e centralizada de múltiplas organizações com estruturas corporativas complexas. A separação clara de responsabilidades entre microsserviços, o uso de tecnologias maduras e comunitariamente suportadas, e a implementação de padrões de segurança robustos garantem uma plataforma confiável para integração e observabilidade de dados.

A estrutura hierárquica oferece:
- **Centralização de Gestão**: Um administrador pode gerenciar múltiplas empresas de forma unificada
- **Compartilhamento Inteligente**: Integrações e configurações podem ser compartilhadas entre empresas do mesmo grupo
- **Governança Corporativa**: Controle e auditoria apropriados para organizações com múltiplas entidades
- **Flexibilidade**: Permite tanto configurações herdadas quanto específicas por empresa