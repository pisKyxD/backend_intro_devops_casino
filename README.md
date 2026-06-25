# casino-backend

Backend del **Casino Online** — Experiencia 2 de la asignatura
**Introducción a Herramientas DevOps (ISY1101)**.

API REST en Node.js + Express con PostgreSQL como base de datos.

> **Este repositorio NO incluye `Dockerfile`, `docker-compose.yml`
> ni workflows de GitHub Actions.** Esos artefactos forman parte del
> entregable de la **Evaluación Parcial 2** y deben construirlos los
> estudiantes (frontend + backend + base de datos contenerizados,
> publicados en un registry y desplegados en EC2).

---

## Stack# casino-backend

Backend del **Casino Online VidalCasino** — Experiencia 2 de la asignatura
**Introducción a Herramientas DevOps (ISY1101)** — DuocUC 2026.

API REST en Node.js + Express con PostgreSQL como base de datos.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js 20 (`node:20-alpine`) |
| Framework | Express 4 |
| Base de datos | PostgreSQL 16 (`postgres:16-alpine`) |
| Auth | JWT + bcryptjs |
| Cliente BD | `pg` (node-postgres) |
| Contenedor | Docker (multi-stage build) |

---

## Estructura del proyecto

```
casino-backend/
├── src/
│   ├── server.js                ← bootstrap Express + rutas
│   ├── db/
│   │   ├── pool.js              ← Pool de pg + esperarBD()
│   │   └── seed.js              ← usuarios demo (idempotente, ON CONFLICT DO NOTHING)
│   ├── middleware/
│   │   └── auth.js              ← JWT firmar / requiereAuth
│   ├── routes/
│   │   ├── auth.js              ← /api/auth/login | register
│   │   ├── users.js             ← /api/usuarios/me, depositar
│   │   ├── games.js             ← /api/juegos/{slots,roulette,blackjack}
│   │   └── transactions.js      ← /api/transacciones (historial)
│   └── games/
│       ├── slots.js
│       ├── roulette.js
│       └── blackjack.js
├── db/
│   └── init.sql                 ← esquema DDL (montado en /docker-entrypoint-initdb.d/)
├── Dockerfile                   ← multi-stage build (EP2)
├── .github/
│   └── workflows/
│       └── deploy-backend.yml   ← pipeline CI/CD (EP2)
├── .dockerignore
├── package.json
├── .env.example
└── .gitignore
```

---

## Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `3000` | Puerto HTTP del servidor |
| `JWT_SECRET` | `cambiame` | Secreto de firma JWT — **cambiar en producción** |
| `JWT_EXPIRES_IN` | `8h` | Vigencia del token |
| `DB_HOST` | `localhost` | Host de Postgres (`db` en docker-compose) |
| `DB_PORT` | `5432` | Puerto Postgres |
| `DB_USER` | `casino` | Usuario Postgres |
| `DB_PASSWORD` | `casino` | Password Postgres |
| `DB_NAME` | `casino_db` | Base de datos |
| `CORS_ORIGIN` | `*` | Lista CSV de orígenes permitidos |

> **Nunca** commitear `.env` ni credenciales reales. Usar `.env.example` como referencia y pasar los valores reales como GitHub Secrets o variables de entorno en `docker-compose.yml`.

---

## Endpoints

### Autenticación

| Método | Ruta | Body | Descripción |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | `{ username, email, password }` | Registro |
| `POST` | `/api/auth/login` | `{ username, password }` | Login — retorna JWT |

### Usuario autenticado (`Authorization: Bearer <token>`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/usuarios/me` | Datos del usuario y saldo |
| `POST` | `/api/usuarios/me/depositar` | `{ monto }` — recarga saldo demo |
| `GET` | `/api/transacciones?limit=50` | Historial del usuario |

### Juegos

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/juegos` | Catálogo (slots, roulette, blackjack) |
| `POST` | `/api/juegos/slots/jugar` | `{ apuesta }` → `{ resultado, saldo }` |
| `POST` | `/api/juegos/roulette/jugar` | `{ apuestas:[{tipo,valor,monto}] }` → `{ resultado, saldo }` |
| `POST` | `/api/juegos/blackjack/iniciar` | `{ apuesta }` → `{ sesionId, jugador, banca, ... }` |
| `POST` | `/api/juegos/blackjack/accion` | `{ sesionId, accion: pedir/plantarse/doblar }` |

### Salud

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Estado del servidor + BD (`{ status: "ok" }` o `503`) |
| `GET` | `/` | Mensaje de bienvenida |

---

## Usuarios demo (sembrados al arrancar)

| username | password | rol | saldo inicial |
|----------|----------|-----|---------------|
| `demo` | `demo1234` | jugador | $5.000 |
| `jugador1` | `demo1234` | jugador | $1.000 |
| `admin` | `admin1234` | admin | $99.999 |

El seed es **idempotente** (`ON CONFLICT DO NOTHING`) — se puede ejecutar en cada reinicio del contenedor sin riesgo de duplicar datos.

---

## Correr en local (sin Docker)

Requisitos: Node 20 y un Postgres accesible.

```bash
cp .env.example .env     # ajustar credenciales
npm install
npm start
# API disponible en http://localhost:3000
```

---

## Build de producción

```bash
# Verificar que el servidor arranca correctamente
NODE_ENV=production node src/server.js
```

---

## Docker

### Dockerfile (multi-stage)

Dos etapas: la primera instala dependencias, la segunda copia solo lo necesario y corre con usuario no root.

```dockerfile
# ── Etapa 1: builder ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Etapa 2: runtime ────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node src/ ./src/
COPY --chown=node:node package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "src/server.js"]
```

> **Puntos clave:**
> - `npm ci --omit=dev` en el builder: instala solo dependencias de producción, sin `devDependencies`.
> - `USER node`: la imagen `node:20-alpine` ya tiene el usuario `node` (uid 1000). No se necesita crear uno nuevo.
> - `HEALTHCHECK` apunta a `/health` que consulta la BD y responde `{ status: "ok" }` o `503`.
> - El servidor escucha en `0.0.0.0` (todas las interfaces), no en `localhost`, para que el host EC2 y otros contenedores puedan acceder.

### Verificar usuario no root

```bash
docker exec <container_id> whoami
# debe responder: node  (no root)
```

### .dockerignore

```
node_modules
.git
.github
.env
*.md
```

---

## Docker Compose (stack completo local)

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: casino
      POSTGRES_PASSWORD: casino123
      POSTGRES_DB: casino_db
    volumes:
      - pg-data:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U casino -d casino_db"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - casino-net

  casino-backend:
    build: .
    environment:
      PORT: 3000
      DB_HOST: db
      DB_PORT: 5432
      DB_USER: casino
      DB_PASSWORD: casino123
      DB_NAME: casino_db
      JWT_SECRET: supersecreto_cambiar_en_prod
      JWT_EXPIRES_IN: 8h
      CORS_ORIGIN: "*"
    depends_on:
      db:
        condition: service_healthy
    networks:
      - casino-net

  casino-frontend:
    build: ../casino-frontend
    environment:
      - BACKEND_HOST=casino-backend
    ports:
      - "80:8080"
    depends_on:
      - casino-backend
    networks:
      - casino-net

volumes:
  pg-data:

networks:
  casino-net:
```

> **Puntos importantes:**
> - `db/init.sql` se monta en `/docker-entrypoint-initdb.d/` — Postgres lo ejecuta **solo si el volumen está vacío** (primer arranque). Todas las sentencias DDL usan `IF NOT EXISTS` para ser idempotentes.
> - `depends_on: condition: service_healthy` + `healthcheck` en `db` con `pg_isready` garantiza que el backend no arranque hasta que Postgres esté listo. Esto complementa a `esperarBD()` en el código.
> - El backend **no expone puertos** al host — solo es accesible desde dentro de la red Docker `casino-net`. Igual que en producción con la subred privada.
> - **Named volume `pg-data`**: los datos sobreviven a `docker rm`. Usar bind mount solo en desarrollo si se necesita inspeccionar los archivos directamente.

```bash
# Levantar el stack completo
docker compose up --build

# Verificar que el backend responde
curl http://localhost/api/health      # a través del reverse proxy de Nginx
curl http://localhost:3000/health     # directo (solo en local, en prod no está expuesto)

# Verificar persistencia de datos
docker compose rm -f db
docker compose up -d db
# El historial y saldos deben seguir ahí
```

---

## CI/CD — GitHub Actions

### Ramas

| Rama | Propósito |
|------|-----------|
| `main` | Referencia estable. No se hace push directo. |
| `dev` | Trabajo diario. Todos los commits van aquí. |
| `deploy` | Gatilla el pipeline. Solo se hace merge desde `dev`. |

**Flujo esperado:**
```
dev (commits) → merge a deploy → push dispara Actions → build → push registry → deploy en EC2
```

### Workflow `.github/workflows/deploy-backend.yml`

```yaml
name: Deploy Backend

on:
  push:
    branches:
      - deploy

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout código
        uses: actions/checkout@v4

      - name: Login a Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Build y push imagen
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ secrets.DOCKERHUB_USERNAME }}/casino-backend:latest
            ${{ secrets.DOCKERHUB_USERNAME }}/casino-backend:${{ github.sha }}

      - name: Deploy en EC2
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.EC2_BACK_HOST }}
          username: ec2-user
          key: ${{ secrets.EC2_SSH_KEY_BACK }}
          script: |
            docker pull ${{ secrets.DOCKERHUB_USERNAME }}/casino-backend:latest
            docker stop casino-backend || true
            docker rm casino-backend || true
            docker run -d \
              --name casino-backend \
              --network casino-net \
              -e PORT=3000 \
              -e DB_HOST=casino-db \
              -e DB_PORT=5432 \
              -e DB_USER=${{ secrets.DB_USER }} \
              -e DB_PASSWORD=${{ secrets.DB_PASSWORD }} \
              -e DB_NAME=casino_db \
              -e JWT_SECRET=${{ secrets.JWT_SECRET }} \
              -e CORS_ORIGIN="http://${{ secrets.EC2_FRONT_HOST }}" \
              ${{ secrets.DOCKERHUB_USERNAME }}/casino-backend:latest
```

### GitHub Secrets requeridos

| Secret | Descripción |
|--------|-------------|
| `DOCKERHUB_USERNAME` | Usuario de Docker Hub |
| `DOCKERHUB_TOKEN` | Token de acceso de Docker Hub |
| `EC2_BACK_HOST` | IP privada de `ec2-back` (`10.0.2.237`) — acceso por tunnel desde front |
| `EC2_SSH_KEY_BACK` | Clave privada SSH para `ec2-back` |
| `DB_USER` | Usuario de Postgres |
| `DB_PASSWORD` | Password de Postgres |
| `JWT_SECRET` | Secreto JWT de producción |
| `EC2_FRONT_HOST` | IP pública del frontend — para configurar `CORS_ORIGIN` |

> Las credenciales de AWS Academy expiran cada ~4 horas. Actualizar los secrets en cada sesión si es necesario.

---

## Despliegue en AWS EC2

### Infraestructura

| Recurso | Valor |
|---------|-------|
| VPC | `vidal-casino-vpc` — `10.0.0.0/16` |
| Subred pública | `10.0.1.0/24` — `ec2-front` |
| Subred privada | `10.0.2.0/24` — `ec2-back` |
| `ec2-back` | `t3.micro` — Amazon Linux — IP privada `10.0.2.237` — **sin IP pública** |
| Security Group backend | `sg-back`: IN `3000` desde `sg-front` · IN `22` desde `sg-front` |

> **`ec2-back` no debe tener IP pública asignada.** Si la tiene, el aislamiento de la subred privada queda roto y se descuentan puntos en IE6 e IE7.

### Pasos de despliegue manual en ec2-back (primera vez)

Acceder a `ec2-back` desde `ec2-front` (el SG solo permite SSH desde `sg-front`):

```bash
# Desde ec2-front, saltar a ec2-back
ssh -i clave.pem ec2-user@10.0.2.237

# Instalar Docker
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo usermod -aG docker ec2-user

# Instalar Git
sudo yum install -y git

# Crear red Docker para comunicación entre contenedores
docker network create casino-net

# Levantar PostgreSQL con volumen persistente
docker run -d \
  --name casino-db \
  --network casino-net \
  -e POSTGRES_USER=casino \
  -e POSTGRES_PASSWORD=casino123 \
  -e POSTGRES_DB=casino_db \
  -v pg-data:/var/lib/postgresql/data \
  -v $(pwd)/db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro \
  postgres:16-alpine

# Levantar el backend
docker run -d \
  --name casino-backend \
  --network casino-net \
  -e PORT=3000 \
  -e DB_HOST=casino-db \
  -e DB_USER=casino \
  -e DB_PASSWORD=casino123 \
  -e DB_NAME=casino_db \
  -e JWT_SECRET=supersecreto \
  <usuario>/casino-backend:latest

# Verificar
curl http://localhost:3000/health
# debe responder: { "status": "ok" }
```

---

## Conceptos DevOps clave del código

### 1. Configuración por variables de entorno (12-factor App)
Toda la configuración sensible o que cambia entre ambientes viene de variables de entorno, nunca hardcodeada. En Docker se inyectan con `-e`, en `docker-compose.yml` con `environment:` y en producción con GitHub Secrets.

### 2. Endpoint `/health` y Docker HEALTHCHECK
`GET /health` consulta la BD y responde `{ status: "ok" }` o `503`. Docker lo usa en el `HEALTHCHECK` del `Dockerfile`; también se puede usar como health check en el servicio de `docker-compose` con `condition: service_healthy`.

### 3. Binding a `0.0.0.0`
El servidor escucha en `0.0.0.0` (todas las interfaces). Dentro de un contenedor, `localhost` solo aceptaría conexiones del mismo contenedor. `0.0.0.0` permite que el host EC2 y otros contenedores en la misma red Docker puedan acceder.

### 4. Reintentos de conexión a la BD (`esperarBD`)
Cuando `docker compose up` levanta varios servicios a la vez, el backend puede arrancar antes de que Postgres esté listo. `esperarBD()` reintenta hasta 30 veces con 2 segundos de espera. La solución definitiva es combinar esto con `depends_on: condition: service_healthy` y un `healthcheck` en el servicio `db` usando `pg_isready`.

### 5. Inicialización del esquema (`db/init.sql`)
Postgres ejecuta los archivos `.sql` en `/docker-entrypoint-initdb.d/` **solo si el volumen está vacío** (primer arranque). En reinicios posteriores el script no se vuelve a ejecutar. Por eso todas las sentencias DDL usan `IF NOT EXISTS`.

### 6. Seed idempotente
`seed.js` inserta usuarios demo al arrancar el backend usando `ON CONFLICT DO NOTHING`, por lo que es seguro ejecutarlo en cada reinicio sin riesgo de duplicar datos ni fallar.

### 7. Pool de conexiones
`pg.Pool` mantiene hasta 10 conexiones abiertas simultáneamente. En producción este valor debe ajustarse según el tamaño de la instancia Postgres y la cantidad de réplicas del contenedor.

---

## Checklist de validación antes de entregar

**1. Local — con `docker compose up`**
```bash
curl http://localhost/api/health
# 200 OK con { "status": "ok" }
```

**2. Verificar que el backend NO es alcanzable directamente desde Internet**
```bash
# Desde tu computador — debe fallar
curl --max-time 5 http://<IP_PUBLICA_CUALQUIERA>:3000/health
# timeout o connection refused → correcto
# Si responde → ec2-back tiene IP pública o el SG tiene 0.0.0.0/0 → pierden IE6 e IE7
```

**3. Security Group del backend — configuración correcta**

| Campo | Valor correcto | Valor incorrecto |
|-------|---------------|-----------------|
| Type | Custom TCP | — |
| Port | 3000 | — |
| Source | `sg-front` (referencia al SG) | `0.0.0.0/0` o IP pública del frontend |

> Si se pone la IP pública del frontend como source, está **mal** — el tráfico va por red interna VPC y sale con la IP **privada** de ec2-front, no con la pública.

**4. Persistencia**
```bash
# Hacer una transacción en el casino
# Reiniciar el contenedor de la BD
docker compose restart db
# Volver al historial — la transacción debe seguir ahí
```

**5. Usuario no root**
```bash
docker exec casino-backend whoami
# → node
```

**6. Pipeline end-to-end**
Push mínimo a `dev` → merge a `deploy` → GitHub Actions en verde → cambio visible sin tocar la EC2.

---

## Troubleshooting

| Problema | Causa probable | Solución |
|----------|----------------|----------|
| Backend arranca antes que Postgres | `depends_on` sin `condition: service_healthy` | Agregar `healthcheck` a `db` con `pg_isready` y `condition: service_healthy` en `depends_on` |
| `502 Bad Gateway` desde Nginx | Backend caído o `BACKEND_HOST` incorrecto | Verificar que el contenedor del backend esté corriendo y la IP privada sea correcta |
| `ECONNREFUSED` al conectar a BD | `DB_HOST` incorrecto o Postgres no listo | Verificar que `DB_HOST=db` en compose o el nombre del contenedor en EC2 |
| Datos de BD se pierden al reiniciar | Sin named volume | Verificar que `pg-data` esté en `volumes:` del compose |
| `init.sql` no se ejecuta | Volumen ya existía de una sesión anterior | `docker compose down -v` para borrar el volumen y reiniciar desde cero |
| Backend accesible desde Internet | EC2 tiene IP pública o SG con `0.0.0.0/0` | Quitar IP pública de ec2-back, poner `Source: sg-front` en el SG |
| Contenedor corre como root | `USER node` faltante en Dockerfile | Agregar `USER node` antes del `CMD` |
| Pipeline falla en step deploy | Secret SSH vencido (AWS Academy ~4h) | Actualizar secrets en GitHub |
| `init.sql` ejecutado parcialmente | Error en DDL sin `IF NOT EXISTS` | Revisar que todas las sentencias usen `IF NOT EXISTS` |

---

## Comandos útiles

```bash
# Ver logs del backend en tiempo real
docker logs -f casino-backend

# Entrar al contenedor
docker exec -it casino-backend sh

# Confirmar usuario no root
docker exec casino-backend whoami
# → node

# Consultar directamente la BD desde el contenedor de Postgres
docker exec -it casino-db psql -U casino -d casino_db
# \dt              → listar tablas
# SELECT * FROM usuarios;
# SELECT * FROM transacciones ORDER BY created_at DESC LIMIT 10;

# Verificar health del backend
curl http://localhost:3000/health

# Verificar el reverse proxy desde ec2-front
curl http://localhost/api/health

# Reconstruir sin caché
docker compose build --no-cache casino-backend

# Bajar todo y limpiar volúmenes (¡borra datos de BD!)
docker compose down -v

# Ver imágenes publicadas
docker images | grep casino-backend
```

---

## Notas de arquitectura

- **CSR y reverse proxy:** el frontend Angular es Client-Side Rendering. Las llamadas `/api/` salen desde el navegador del jugador, no desde AWS. Por eso el backend no puede ser llamado directamente — Nginx en `ec2-front` hace de intermediario, reenviando `/api/` al backend por la red interna de la VPC. Ver README del frontend para el detalle completo.
- **Multi-stage build:** la imagen final no contiene `devDependencies` ni código fuente innecesario. Solo `node_modules` de producción y el código en `src/`.
- **`--omit=dev` en npm ci:** instala solo las dependencias necesarias para producción, reduciendo el tamaño de la imagen.
- **CORS_ORIGIN:** en producción configurar con la IP o dominio del frontend, no `*`. Esto limita qué orígenes pueden consumir la API.

---

## Repositorio del frontend

[`casino-frontend`](../casino-frontend)

---

## Dependencias principales

| Paquete | Versión | Para qué se usa |
|---------|---------|-----------------|
| `express` | ^4.x | Framework HTTP |
| `pg` | ^8.x | Cliente PostgreSQL |
| `jsonwebtoken` | ^9.x | Firma y verificación JWT |
| `bcryptjs` | ^2.x | Hash de contraseñas |
| `dotenv` | ^16.x | Carga de `.env` en desarrollo |
| `cors` | ^2.x | Middleware CORS |


- Node.js 20 (recomendado correr sobre `node:20-alpine`)
- Express 4
- PostgreSQL 16 (recomendado `postgres:16-alpine` con volumen nombrado)
- JWT para autenticación, bcryptjs para hashes
- `pg` como cliente de Postgres

---

## Estructura

```
casino-backend/
├── src/
│   ├── server.js                ← bootstrap Express + rutas
│   ├── db/
│   │   ├── pool.js              ← Pool de pg + esperarBD()
│   │   └── seed.js              ← usuarios demo (idempotente)
│   ├── middleware/
│   │   └── auth.js              ← JWT firmar / requiereAuth
│   ├── routes/
│   │   ├── auth.js              ← /api/auth/login | register
│   │   ├── users.js             ← /api/usuarios/me, depositar
│   │   ├── games.js             ← /api/juegos/{slots,roulette,blackjack}
│   │   └── transactions.js      ← /api/transacciones (historial)
│   └── games/
│       ├── slots.js
│       ├── roulette.js
│       └── blackjack.js
├── db/
│   └── init.sql                 ← esquema (lo monta Postgres en /docker-entrypoint-initdb.d)
├── package.json
├── .gitignore
└── .env.example
```

---

## Variables de entorno

| Variable        | Default       | Descripción                                   |
|-----------------|---------------|-----------------------------------------------|
| `PORT`          | `3000`        | Puerto HTTP del servidor                      |
| `JWT_SECRET`    | `cambiame`    | Secreto de firma JWT (cambiar en producción)  |
| `JWT_EXPIRES_IN`| `8h`          | Vigencia del token                            |
| `DB_HOST`       | `localhost`   | Host de Postgres (`db` en docker-compose)     |
| `DB_PORT`       | `5432`        | Puerto Postgres                               |
| `DB_USER`       | `casino`      | Usuario Postgres                              |
| `DB_PASSWORD`   | `casino`      | Password Postgres                             |
| `DB_NAME`       | `casino_db`   | Base de datos                                 |
| `CORS_ORIGIN`   | `*`           | Lista CSV de orígenes permitidos              |

---

## Endpoints

### Autenticación

| Método | Ruta                  | Descripción                              |
|--------|-----------------------|------------------------------------------|
| POST   | `/api/auth/register`  | Registro `{ username, email, password }` |
| POST   | `/api/auth/login`     | Login `{ username, password }`           |

### Usuario autenticado (header `Authorization: Bearer <token>`)

| Método | Ruta                                  | Descripción                       |
|--------|---------------------------------------|-----------------------------------|
| GET    | `/api/usuarios/me`                    | Datos del usuario y saldo         |
| POST   | `/api/usuarios/me/depositar`          | `{ monto }` — recarga saldo demo  |
| GET    | `/api/transacciones?limit=50`         | Historial del usuario             |

### Juegos

| Método | Ruta                              | Descripción                                                    |
|--------|-----------------------------------|----------------------------------------------------------------|
| GET    | `/api/juegos`                     | Catálogo (slots, roulette, blackjack)                          |
| POST   | `/api/juegos/slots/jugar`         | `{ apuesta }` → `{ resultado, saldo }`                         |
| POST   | `/api/juegos/roulette/jugar`      | `{ apuestas:[{tipo,valor,monto}] }` → `{ resultado, saldo }`  |
| POST   | `/api/juegos/blackjack/iniciar`   | `{ apuesta }` → `{ sesionId, jugador, banca, ... }`            |
| POST   | `/api/juegos/blackjack/accion`    | `{ sesionId, accion: pedir/plantarse/doblar }`                 |

### Salud

| Método | Ruta       | Descripción                  |
|--------|------------|------------------------------|
| GET    | `/health`  | Estado del servidor + BD     |
| GET    | `/`        | Mensaje de bienvenida        |

---

## Usuarios demo (sembrados al arrancar)

| username   | password    | rol      | saldo inicial |
|------------|-------------|----------|---------------|
| `demo`     | `demo1234`  | jugador  | $5.000        |
| `jugador1` | `demo1234`  | jugador  | $1.000        |
| `admin`    | `admin1234` | admin    | $99.999       |

---

## Cómo correr en local (sin Docker)

Requisitos: Node 20 y un Postgres accesible.

```bash
cp .env.example .env          # ajustar credenciales
npm install                   # genera node_modules (y package-lock.json local, no se commitea)
npm start
# API disponible en http://localhost:3000
```

---

## Conceptos DevOps clave del código

Los siguientes puntos son relevantes para la contenerización y despliegue en EC2.
Busca los comentarios en el código fuente para mayor detalle.

### 1. Configuración por variables de entorno (12-factor App)
Toda la configuración sensible o que cambia entre ambientes (host de la BD,
contraseña, JWT_SECRET, puerto) viene de variables de entorno, nunca
hardcodeada. En Docker se inyectan con `-e`, en `docker-compose.yml` con la
sección `environment:`, y en EC2 se pueden usar secretos de AWS.

### 2. Endpoint `/health` y Docker HEALTHCHECK
`GET /health` consulta la BD y responde `{ status: "ok" }` o `503`.
Docker lo usa en el `HEALTHCHECK` del `Dockerfile`; los Load Balancers de AWS
lo usan para enrutar tráfico solo hacia instancias/contenedores sanos.
Deben configurar este endpoint como HEALTHCHECK en el Dockerfile del backend
y como health check en el servicio de docker-compose.

### 3. Binding a `0.0.0.0`
El servidor escucha en `0.0.0.0` (todas las interfaces), no en `localhost`.
Dentro de un contenedor, `localhost` solo aceptaría conexiones originadas
dentro del mismo contenedor; `0.0.0.0` permite que el host (EC2) y otros
contenedores puedan acceder.

### 4. Reintentos de conexión a la BD (`esperarBD`)
Cuando `docker-compose up` levanta varios servicios a la vez, el backend
puede arrancar antes de que Postgres esté listo. `esperarBD()` reintenta
hasta 30 veces con 2 s de espera. La solución definitiva es combinar esto
con `depends_on: condition: service_healthy` y un `healthcheck` en el
servicio `db` usando `pg_isready`.

### 5. Inicialización del esquema (`db/init.sql`)
Postgres ejecuta los archivos `.sql` en `/docker-entrypoint-initdb.d/`
**solo si el volumen está vacío** (primer arranque). En reinicios
posteriores el script no se vuelve a ejecutar. Por eso todas las
sentencias DDL usan `IF NOT EXISTS`. Deben montar este archivo en el
contenedor de la BD usando la sección `volumes:` del docker-compose.yml.

### 6. Seed idempotente
`seed.js` inserta usuarios demo al arrancar el backend usando
`ON CONFLICT DO NOTHING`, por lo que es seguro ejecutarlo en cada
reinicio del contenedor sin riesgo de duplicar datos ni fallar.

### 7. Pool de conexiones
`pg.Pool` mantiene hasta 10 conexiones abiertas simultáneamente.
En producción este valor debe ajustarse según la instancia RDS/Postgres
y la cantidad de réplicas del contenedor.

---

## Cómo lo van a contenerizar (EP2)

El docente espera que ustedes:

1. Construyan un **Dockerfile multi-stage** (`builder` con `npm install`,
   `runtime` `node:20-alpine` con usuario no root).
2. Definan en el `docker-compose.yml` los servicios `db`, `backend`
   (y agreguen el `frontend`) con:
   - `pg_data` como **named volume** para `/var/lib/postgresql/data`.
   - `./casino-backend/db/init.sql` montado en `/docker-entrypoint-initdb.d/`
     (recuerden: solo se ejecuta si el volumen está vacío).
   - `depends_on` con `condition: service_healthy` y un `healthcheck`
     en `db` (`pg_isready`).
   - Variables de entorno **inyectadas por compose**, sin hard-codear.
3. Configuren workflows en `.github/workflows/` que hagan
   `build → push (ECR) → deploy` en EC2 al hacer push a la rama
   correspondiente (en el **Ejercicio 2.5** se usa `main`; en la
   **EP2** la pauta oficial pide la rama `deploy`).

Lean la pauta oficial (`EP2_Instrucciones y Pauta_Encargo_Estudiante.pdf`)
para los criterios completos.

---

## Repositorio del frontend

[`casino-frontend`](../casino-frontend)
