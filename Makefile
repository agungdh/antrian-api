MINIO_USER ?= admin
MINIO_PASSWORD ?= admin123
MINIO_ENDPOINT ?= http://127.0.0.1:9000
MINIO_ALIAS ?= local
BUCKET ?= antrian

.PHONY: help init-minio recreate-postgres db-migrate

help:
	@echo "Available targets:"
	@echo "  init-minio        - Init MinIO bucket '$(BUCKET)' (idempotent)"
	@echo "  recreate-postgres - Stop postgres, hapus volume, start lagi (DATA HILANG)"
	@echo "  db-migrate        - Apply drizzle migrations ke postgres"

init-minio:
	docker compose exec -T minio mcli alias set $(MINIO_ALIAS) $(MINIO_ENDPOINT) $(MINIO_USER) $(MINIO_PASSWORD)
	docker compose exec -T minio mcli mb --ignore-existing $(MINIO_ALIAS)/$(BUCKET)
	docker compose exec -T minio mcli ls $(MINIO_ALIAS)/

recreate-postgres:
	docker compose stop postgres
	docker compose rm -f postgres
	VOLUME=$$(docker volume ls -q | grep '_postgres_data$$' || true); \
	if [ -n "$$VOLUME" ]; then docker volume rm -f $$VOLUME; fi
	docker compose up -d postgres
	@echo "Postgres recreated. Jangan lupa: make db-migrate"

db-migrate:
	bunx drizzle-kit migrate
