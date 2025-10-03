.PHONY: help up down logs clean build deploy restart health status

# Default target
help:
	@echo "Available targets:"
	@echo "  up       - Start all services"
	@echo "  down     - Stop all services"
	@echo "  logs     - Show logs from all services"
	@echo "  restart  - Restart all services"
	@echo "  build    - Build all services"
	@echo "  clean    - Remove containers and volumes"
	@echo "  deploy   - Deploy to production (up + health check)"
	@echo "  health   - Check health of all services"
	@echo "  status   - Show status of all services"

# Start all services
up:
	docker compose up -d
	@echo "Services starting... Run 'make health' to check status."

# Stop all services
down:
	docker compose down

# Show logs
logs:
	docker compose logs -f

# Restart all services
restart:
	docker compose restart

# Build all services
build:
	docker compose build --no-cache

# Remove containers and volumes (destructive!)
clean:
	docker compose down -v --remove-orphans
	docker system prune -f

# Deploy with health checks
deploy: up health

# Check health of all services
health:
	@echo "Checking service health..."
	@sleep 5
	@docker compose ps
	@echo ""
	@echo "Testing health endpoints..."
	@docker compose exec -T nginx curl -f -s http://localhost/health && echo "✓ nginx health OK" || echo "✗ nginx health FAILED"
	@docker compose exec -T dashboard curl -f -s http://localhost:3000/api/health && echo "✓ dashboard health OK" || echo "✗ dashboard health FAILED"
	@docker compose exec -T ml-service curl -f -s http://localhost:8000/health && echo "✓ ml-service health OK" || echo "✗ ml-service health FAILED"
	@docker compose exec -T algo curl -f -s http://localhost:8001/health && echo "✓ algo health OK" || echo "✗ algo health FAILED"
	@docker compose exec -T broker-bridge curl -f -s http://localhost:8002/health && echo "✓ broker-bridge health OK" || echo "✗ broker-bridge health FAILED"
	@docker compose exec -T blotter curl -f -s http://localhost:8003/health && echo "✓ blotter health OK" || echo "✗ blotter health FAILED"
	@echo ""
	@echo "Reconnect test (<3s target)..."
	@timeout 3 bash -c 'curl -f -s http://localhost/api/dev/sse >/dev/null' && echo "✓ SSE reconnect <3s OK" || echo "✗ SSE reconnect FAILED (timeout or error)"

# Show status of all services
status:
	docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
