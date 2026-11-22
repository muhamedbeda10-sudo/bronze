#!/bin/sh
# Container entry: apply the database migrations, then serve.
set -e
npx prisma migrate deploy
exec npx next start -p "${PORT:-3000}"
