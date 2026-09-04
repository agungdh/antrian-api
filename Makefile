MINIO_USER ?= admin
MINIO_PASSWORD ?= admin123
MINIO_ENDPOINT ?= http://127.0.0.1:9000
MINIO_ALIAS ?= local
BUCKET ?= antrian

.PHONY: help init-minio

help:
	@echo "Available targets:"
	@echo "  init-minio  - Init MinIO bucket '$(BUCKET)' (idempotent)"

init-minio:
	docker compose exec -T minio mcli alias set $(MINIO_ALIAS) $(MINIO_ENDPOINT) $(MINIO_USER) $(MINIO_PASSWORD)
	docker compose exec -T minio mcli mb --ignore-existing $(MINIO_ALIAS)/$(BUCKET)
	docker compose exec -T minio mcli ls $(MINIO_ALIAS)/
