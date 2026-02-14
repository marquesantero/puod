# Script para iniciar P.U.O.D. localmente para testes
# Uso: .\start-local.ps1

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  P.U.O.D. - Setup Local" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se Docker está rodando
Write-Host "[1/7] Verificando Docker..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
    Write-Host "✓ Docker está rodando" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker não está rodando. Inicie o Docker Desktop e tente novamente." -ForegroundColor Red
    exit 1
}

# Subir infraestrutura
Write-Host ""
Write-Host "[2/7] Iniciando infraestrutura (PostgreSQL, RabbitMQ, Redis)..." -ForegroundColor Yellow
docker-compose up -d postgres rabbitmq redis

# Aguardar health checks
Write-Host ""
Write-Host "[3/7] Aguardando serviços ficarem saudáveis..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0

while ($attempt -lt $maxAttempts) {
    $postgresHealth = docker inspect --format='{{.State.Health.Status}}' puod-postgres 2>$null
    $rabbitmqHealth = docker inspect --format='{{.State.Health.Status}}' puod-rabbitmq 2>$null
    $redisHealth = docker inspect --format='{{.State.Health.Status}}' puod-redis 2>$null

    if ($postgresHealth -eq "healthy" -and $rabbitmqHealth -eq "healthy" -and $redisHealth -eq "healthy") {
        Write-Host "✓ Todos os serviços estão saudáveis" -ForegroundColor Green
        break
    }

    $attempt++
    Write-Host "  Tentativa $attempt/$maxAttempts - Aguardando..." -NoNewline
    Start-Sleep -Seconds 2
    Write-Host "`r" -NoNewline
}

if ($attempt -eq $maxAttempts) {
    Write-Host "✗ Timeout aguardando serviços. Verifique os logs com: docker-compose logs" -ForegroundColor Red
    exit 1
}

# Rodar migrations
Write-Host ""
Write-Host "[4/7] Executando migrations do banco de dados..." -ForegroundColor Yellow

Write-Host "  - Integration Service..." -NoNewline
Push-Location "src\Services\Integration\Puod.Services.Integration"
dotnet tool run dotnet-ef database update --no-build 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host " ✓" -ForegroundColor Green
} else {
    Write-Host " ✗ (pode já estar atualizado)" -ForegroundColor Yellow
}
Pop-Location

Write-Host "  - Monitoring Service..." -NoNewline
Push-Location "src\Services\Monitoring"
dotnet tool run dotnet-ef database update --no-build 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host " ✓" -ForegroundColor Green
} else {
    Write-Host " ✗ (pode já estar atualizado)" -ForegroundColor Yellow
}
Pop-Location

Write-Host "  - Studio Service..." -NoNewline
Push-Location "src\Services\Studio\Puod.Services.Studio"
dotnet tool run dotnet-ef database update --no-build 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host " V" -ForegroundColor Green
} else {
    Write-Host " ? (pode já estar atualizado)" -ForegroundColor Yellow
}
Pop-Location

# Informações de acesso
Write-Host ""
Write-Host "[5/7] Serviços disponíveis:" -ForegroundColor Yellow
Write-Host "  • PostgreSQL:    localhost:5432" -ForegroundColor Cyan
Write-Host "    - User: puod_user" -ForegroundColor Gray
Write-Host "    - Password: puod_dev_password_2024" -ForegroundColor Gray
Write-Host ""
Write-Host "  • RabbitMQ:      localhost:5672" -ForegroundColor Cyan
Write-Host "    - Management UI: http://localhost:15672" -ForegroundColor Gray
Write-Host "    - User: puod_user" -ForegroundColor Gray
Write-Host "    - Password: puod_rabbit_pass" -ForegroundColor Gray
Write-Host ""
Write-Host "  • Redis:         localhost:6379" -ForegroundColor Cyan
Write-Host "    - Password: puod_redis_pass" -ForegroundColor Gray
Write-Host ""

# Instruções finais
Write-Host "[6/7] Próximos passos:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Abra um novo terminal e execute:" -ForegroundColor White
Write-Host "     cd src\Services\Integration\Puod.Services.Integration" -ForegroundColor Cyan
Write-Host "     dotnet run" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2. Abra outro terminal e execute:" -ForegroundColor White
Write-Host "     cd src\Services\Monitoring" -ForegroundColor Cyan
Write-Host "     dotnet run" -ForegroundColor Cyan
Write-Host ""
Write-Host "  3. Abra outro terminal e execute:" -ForegroundColor White
Write-Host "     cd src\Services\Studio\Puod.Services.Studio" -ForegroundColor Cyan
Write-Host "     dotnet run" -ForegroundColor Cyan
Write-Host ""
Write-Host "  4. Aguarde até ver 'Now listening on: http://localhost:5002', 'http://localhost:5003' e 'http://localhost:5064'" -ForegroundColor White
Write-Host ""
Write-Host "  5. Teste a API:" -ForegroundColor White
Write-Host "     curl http://localhost:5002/swagger" -ForegroundColor Cyan
Write-Host "     curl http://localhost:5003/swagger" -ForegroundColor Cyan
Write-Host "     curl http://localhost:5064/swagger" -ForegroundColor Cyan
Write-Host ""
Write-Host "  6. Consulte GETTING_STARTED.md para criar integrações e testar" -ForegroundColor White
Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Setup concluído!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para parar os serviços: docker-compose stop" -ForegroundColor Gray
Write-Host ""

