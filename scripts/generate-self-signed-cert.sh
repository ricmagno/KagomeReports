#!/bin/bash

# Configuration
CERT_NAME="Historian Reports Self-Signed"
ORGANIZATION="Kagome Reports"
CERT_DIR="./build-secrets"
P12_FILE="${CERT_DIR}/self-signed.p12"
P12_PASSWORD="password" # User can change this later

# Create directory if it doesn't exist
mkdir -p "$CERT_DIR"

# Ensure build-secrets is in .gitignore
if ! grep -q "build-secrets" .gitignore; then
  echo "build-secrets" >> .gitignore
  echo "Added build-secrets to .gitignore"
fi

echo "Generating self-signed certificate..."

# 1. Generate a private key
openssl genrsa -out "${CERT_DIR}/self-signed.key" 2048

# 2. Generate a certificate signing request (CSR)
openssl req -new -key "${CERT_DIR}/self-signed.key" -out "${CERT_DIR}/self-signed.csr" -subj "/CN=${CERT_NAME}/O=${ORGANIZATION}/C=AU"

# 3. Generate the self-signed certificate
openssl x509 -req -days 365 -in "${CERT_DIR}/self-signed.csr" -signkey "${CERT_DIR}/self-signed.key" -out "${CERT_DIR}/self-signed.crt"

# 4. Package into .p12 format
# We add -legacy to ensure compatibility with macOS's 'security' tool which 
# sometimes fails to import OpenSSL 3.0+ default PBKDF2 encrypted files.
openssl pkcs12 -export -legacy -out "$P12_FILE" -inkey "${CERT_DIR}/self-signed.key" -in "${CERT_DIR}/self-signed.crt" -password "pass:${P12_PASSWORD}"

echo "--------------------------------------------------"
echo "Success! Certificate generated at: $P12_FILE"
echo "--------------------------------------------------"
echo "To build the app with this certificate, run:"
echo ""
echo "export CSC_LINK=\"$P12_FILE\""
echo "export CSC_KEY_PASSWORD=\"$P12_PASSWORD\""
echo "npm run electron:build:mac"
echo "--------------------------------------------------"
