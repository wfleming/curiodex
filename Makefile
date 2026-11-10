.PHONY: setup
setup:
	docker compose build
	docker compose run --rm app npm install
	docker compose run --rm app npm run db:migrate

.PHONY: up
up:
	docker compose up --force-recreate -d

.PHONY: prod-image
prod-image:
	docker build --target prod -t curiodex .
