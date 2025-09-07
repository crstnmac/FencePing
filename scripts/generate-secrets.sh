#!/bin/bash

# Generate production secrets for Geofence application
# This script generates secure random passwords and keys

set -e

echo "🔐 Generating production secrets for Geofence..."

# Check if .env.prod exists
if [ -f .env.prod ]; then
    echo "⚠️  .env.prod already exists. Creating backup..."
    cp .env.prod .env.prod.backup.$(date +%Y%m%d_%H%M%S)
fi

# Copy template
cp .env.prod.template .env.prod

# Generate random passwords and keys (URL-safe, no special characters)
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
EMQX_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
JWT_SECRET=$(openssl rand -base64 64 | tr -d "=+/\n" | cut -c1-50)

echo "🔑 Generated secure passwords..."

# Replace placeholders in .env.prod (using different delimiter to avoid conflicts)
sed -i.bak "s|your_secure_postgres_password_here|${POSTGRES_PASSWORD}|g" .env.prod
sed -i.bak "s|your_secure_redis_password_here|${REDIS_PASSWORD}|g" .env.prod
sed -i.bak "s|your_secure_emqx_password_here|${EMQX_PASSWORD}|g" .env.prod
sed -i.bak "s|your_jwt_secret_here|${JWT_SECRET}|g" .env.prod

# Clean up backup file
rm .env.prod.bak

echo "✅ Generated .env.prod with secure passwords"
echo ""
echo "📋 Next steps:"
echo "1. Edit .env.prod and fill in the remaining configuration values:"
echo "   - CORS_ORIGIN (your production domain)"
echo "   - NEXT_PUBLIC_API_URL (your production API URL)"
echo "   - Integration secrets (Slack, Google, Notion, Twilio)"
echo ""
echo "2. Never commit .env.prod to version control"
echo "3. Use proper secrets management in production"
echo ""
echo "🚀 To start production deployment:"
echo "   docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d"