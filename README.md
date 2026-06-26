# casino-backend

Backend del **Casino Online** — Experiencia 2 de la asignatura
**Introducción a Herramientas DevOps (ISY1101)**.

API REST en Node.js + Express con PostgreSQL como base de datos.

---

## Stack

- Node.js 20 (recomendado correr sobre `node:20-alpine`)
- Express 4
- PostgreSQL 16 (recomendado `postgres:16-alpine` con volumen nombrado)
- JWT para autenticación, bcryptjs para hashes
- `pg` como cliente de Postgres

---

## Variables de entorno

| Variable        | Default       | Descripción                                   |
|-----------------|---------------|-----------------------------------------------|
| `PORT`          | `3000`        | Puerto HTTP del servidor                      |
| `JWT_SECRET`    | `cambiame`    | Secreto de firma JWT (cambiar en producción)  |
| `DB_HOST`       | `localhost`   | Host de Postgres                              |
| `DB_PORT`       | `5432`        | Puerto Postgres                               |
| `DB_USER`       | `casino`      | Usuario Postgres                              |
| `DB_PASSWORD`   | `casino`      | Password Postgres                             |
| `DB_NAME`       | `casino_db`   | Base de datos                                 |
| `CORS_ORIGIN`   | `*`           | Lista CSV de orígenes permitidos              |

---

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Registro |
| POST | `/api/auth/login` | Login — devuelve JWT |
| GET | `/api/usuarios/me` | Perfil del usuario |
| POST | `/api/usuarios/me/depositar` | Recarga saldo |
| GET | `/api/juegos` | Catálogo de juegos |
| POST | `/api/juegos/slots/jugar` | Jugar slots |
| POST | `/api/juegos/roulette/jugar` | Jugar ruleta |
| POST | `/api/juegos/blackjack/iniciar` | Iniciar blackjack |
| POST | `/api/juegos/blackjack/accion` | Acción blackjack |
| GET | `/api/transacciones` | Historial |
| GET | `/health` | Estado del servidor + BD |
| GET | `/livez` | Liveness probe (Kubernetes) |
| GET | `/readyz` | Readiness probe — verifica BD (200/503) |

---

## Usuarios demo

| username | password | rol | saldo |
|----------|----------|-----|-------|
| `demo` | `demo1234` | jugador | $5.000 |
| `jugador1` | `demo1234` | jugador | $1.000 |
| `admin` | `admin1234` | admin | $99.999 |

---

## Correr en local

```bash
cp .env.example .env
npm install
npm start
```


---

## Implementación EKS (EP3)

### Sondas de salud implementadas
- `GET /livez` — liveness probe (no depende de BD, responde siempre 200)
- `GET /readyz` — readiness probe (verifica BD con SELECT 1, responde 200/503)

### Manifiestos Kubernetes
- `k8s/postgres.yaml` — Deployment + Service de PostgreSQL (imagen casino-db con init.sql embebido)
- `k8s/backend.yaml` — Deployment + Service del backend (replicas: 2, ClusterIP)
- `k8s/hpa.yaml` — HPA (min 2, max 6 réplicas, target 50% CPU)

### CI/CD
Pipeline en `.github/workflows/deploy-backend.yml` — trigger: push a rama `deploy`.
Pasos: checkout → configure-aws-credentials → ecr-login → docker build+push (latest + SHA + vX.Y.Z) → eks update-kubeconfig → kubectl apply → kubectl set image → rollout status.

### Secrets GitHub requeridos
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_REGION`, `AWS_ACCOUNT_ID`, `EKS_CLUSTER`

### Comandos útiles

```bash
# Ver logs del backend
kubectl logs deployment/casino-backend

# Verificar sondas
kubectl port-forward deployment/casino-backend 3000:3000
curl http://localhost:3000/livez
curl http://localhost:3000/readyz

# Reiniciar deployment
kubectl rollout restart deployment casino-backend
```
