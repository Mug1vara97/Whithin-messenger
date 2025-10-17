#!/bin/bash

echo "=== Checking Docker containers ==="
docker ps | grep whithin-messenger

echo ""
echo "=== Checking database tables ==="
docker exec whithin-messenger-db-1 psql -U postgres -d whithin_db -c "\dt"

echo ""
echo "=== Checking migrations history ==="
docker exec whithin-messenger-db-1 psql -U postgres -d whithin_db -c "SELECT * FROM \"__EFMigrationsHistory\" ORDER BY \"MigrationId\";"

echo ""
echo "=== Backend logs (last 50 lines) ==="
docker logs whithin-messenger-backend-1 --tail 50

echo ""
echo "=== Manual migration (if needed) ==="
echo "Run: docker exec -it whithin-messenger-backend-1 dotnet ef database update"

