#!/bin/bash
# Script para iniciar P.U.O.D. localmente para testes
# Uso: ./start-local.sh

set -e

# Cores
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

echo -e "${CYAN}================================${NC}"
echo -e "${CYAN}  P.U.O.D. - Setup Local${NC}"
echo -e "${CYAN}================================${NC}"
echo ""

# Verificar se Docker está rodando
echo -e "${YELLOW}[1/7] Verificando Docker...${NC}"
if ! docker ps &> /dev/null; then
    echo -e "${RED}✗ Docker não está rodando. Inicie o Docker Desktop e tente novamente.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker está rodando${NC}"

# Subir infraestrutura
echo ""
echo -e "${YELLOW}[2/7] Iniciando infraestrutura (PostgreSQL, RabbitMQ, Redis)...${NC}"
docker-compose up -d postgres rabbitmq redis

# Aguardar health checks
echo ""
echo -e "${YELLOW}[3/7] Aguardando serviços ficarem saudáveis...${NC}"
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    postgres_health=$(docker inspect --format='{{.State.Health.Status}}' puod-postgres 2>/dev/null || echo "starting")
    rabbitmq_health=$(docker inspect --format='{{.State.Health.Status}}' puod-rabbitmq 2>/dev/null || echo "starting")
    redis_health=$(docker inspect --format='{{.State.Health.Status}}' puod-redis 2>/dev/null || echo "starting")

    if [ "$postgres_health" = "healthy" ] && [ "$rabbitmq_health" = "healthy" ] && [ "$redis_health" = "healthy" ]; then
        echo -e "${GREEN}✓ Todos os serviços estão saudáveis${NC}"
        break
    fi

    attempt=$((attempt + 1))
    echo -ne "  Tentativa $attempt/$max_attempts - Aguardando...\r"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "${RED}✗ Timeout aguardando serviços. Verifique os logs com: docker-compose logs${NC}"
    exit 1
fi

# Rodar migrations
echo ""
echo -e "${YELLOW}[4/7] Executando migrations do banco de dados...${NC}"

echo -ne "  - Integration Service..."
cd src/Services/Integration/Puod.Services.Integration
if dotnet tool run dotnet-ef database update --no-build &> /dev/null; then
    echo -e " ${GREEN}✓${NC}"
else
    echo -e " ${YELLOW}✗ (pode já estar atualizado)${NC}"
fi
cd ../../../..

echo -ne "  - Monitoring Service..."
cd src/Services/Monitoring
if dotnet tool run dotnet-ef database update --no-build &> /dev/null; then
    echo -e " ${GREEN}✓${NC}"
else
    echo -e " ${YELLOW}✗ (pode já estar atualizado)${NC}"
fi
cd ../../..

echo -ne "  - Studio Service..."
cd src/Services/Studio/Puod.Services.Studio
if dotnet tool run dotnet-ef database update --no-build &> /dev/null; then
    echo -e " ${GREEN}V${NC}"
else
    echo -e " ${YELLOW}? (pode já estar atualizado)${NC}"
fi
cd ../../../..

# Informações de acesso
echo ""
echo -e "${YELLOW}[5/7] Serviços disponíveis:${NC}"
echo -e "  ${CYAN}• PostgreSQL:    localhost:5432${NC}"
echo -e "    ${GRAY}- User: puod_user${NC}"
echo -e "    ${GRAY}- Password: puod_dev_password_2024${NC}"
echo ""
echo -e "  ${CYAN}• RabbitMQ:      localhost:5672${NC}"
echo -e "    ${GRAY}- Management UI: http://localhost:15672${NC}"
echo -e "    ${GRAY}- User: puod_user${NC}"
echo -e "    ${GRAY}- Password: puod_rabbit_pass${NC}"
echo ""
echo -e "  ${CYAN}• Redis:         localhost:6379${NC}"
echo -e "    ${GRAY}- Password: puod_redis_pass${NC}"
echo ""

# Instruções finais
echo -e "${YELLOW}[6/7] Próximos passos:${NC}"
echo ""
echo -e "  ${WHITE}1. Abra um novo terminal e execute:${NC}"
echo -e "     ${CYAN}cd src/Services/Integration/Puod.Services.Integration${NC}"
echo -e "     ${CYAN}dotnet run${NC}"
echo ""
echo -e "  ${WHITE}2. Abra outro terminal e execute:${NC}"
echo -e "     ${CYAN}cd src/Services/Monitoring${NC}"
echo -e "     ${CYAN}dotnet run${NC}"
echo ""
echo -e "  ${WHITE}3. Abra outro terminal e execute:${NC}"
echo -e "     ${CYAN}cd src/Services/Studio/Puod.Services.Studio${NC}"
echo -e "     ${CYAN}dotnet run${NC}"
echo ""
echo -e "  ${WHITE}4. Aguarde até ver 'Now listening on: http://localhost:5002', 'http://localhost:5003' e 'http://localhost:5064'${NC}"
echo ""
echo -e "  ${WHITE}5. Teste a API:${NC}"
echo -e "     ${CYAN}curl http://localhost:5002/swagger${NC}"
echo -e "     ${CYAN}curl http://localhost:5003/swagger${NC}"
echo -e "     ${CYAN}curl http://localhost:5064/swagger${NC}"
echo ""
echo -e "  ${WHITE}6. Consulte GETTING_STARTED.md para criar integrações e testar${NC}"
echo ""
echo -e "${CYAN}================================${NC}"
echo -e "${GREEN}  Setup concluído!${NC}"
echo -e "${CYAN}================================${NC}"
echo ""
echo -e "${GRAY}Para parar os serviços: docker-compose stop${NC}"
echo ""

