#!/usr/bin/env bash
set -euo pipefail

################################################################################
# CA Cert
################################################################################
mkdir -p ./demoCA/newcerts
rm -f demoCA/index.txt
touch demoCA/index.txt
echo "01" > demoCA/serial

prefix="ca"
openssl genrsa -out ${prefix}-key.pem
openssl req -new -key ${prefix}-key.pem -out ${prefix}-csr.pem \
	-config <(echo "
		[ req ]
		prompt = no
		distinguished_name = req_distinguished_name
		string_mask = utf8only
		utf8 = yes
		x509_extensions	= v3_ca

		[ req_distinguished_name ]
		C = US
		ST = CA
		L = San Francisco
		O = Synadia
		OU = nats.io
		CN = localhost ${prefix}

		[ v3_ca ]
		subjectKeyIdentifier=hash
		authorityKeyIdentifier=keyid:always,issuer
		basicConstraints = critical,CA:true
	")
openssl ca -batch -keyfile ${prefix}-key.pem -selfsign -notext \
	-config <(echo "
		[ ca ]
		default_ca = ca_default

		[ ca_default ]
		dir = ./demoCA
		database = ./demoCA/index.txt
		new_certs_dir = ./demoCA/newcerts
		serial = ./demoCA/serial
		default_md = default
		policy = policy_anything
		x509_extensions	= v3_ca
		default_md = sha256

		default_enddate = 20291014135726Z
		copy_extensions = copy

		[ policy_anything ]
		countryName = optional
		stateOrProvinceName = optional
		localityName = optional
		organizationName = optional
		organizationalUnitName = optional
		commonName = supplied
		emailAddress = optional

		[ v3_ca ]
		subjectKeyIdentifier=hash
		authorityKeyIdentifier=keyid:always,issuer
		basicConstraints = critical,CA:true
	") \
	-out ${prefix}-cert.pem -infiles ${prefix}-csr.pem

################################################################################
# Leaf Certs
################################################################################
leafs=( client server )
for prefix in "${leafs[@]}"; do
	openssl genrsa -out ${prefix}-key.pem
	openssl req -new -key ${prefix}-key.pem -out ${prefix}-csr.pem \
		-config <(echo "
			[ req ]
			prompt = no
			distinguished_name = req_distinguished_name
			req_extensions = v3_req
			string_mask = utf8only
			utf8 = yes

			[ req_distinguished_name ]
			C = US
			ST = CA
			L = San Francisco
			O = Synadia
			OU = nats.io
			CN = localhost ${prefix}

			[ v3_req ]
			subjectAltName = @alt_names

			[ alt_names ]
			IP.1 = 127.0.0.1
			IP.2 = 0:0:0:0:0:0:0:1
			DNS.1 = localhost
			DNS.2 = ${prefix}.localhost
		")
	openssl ca -batch -keyfile ca-key.pem -cert ca-cert.pem -notext \
		-config <(echo "
			[ ca ]
			default_ca = ca_default

			[ ca_default ]
			dir = ./demoCA
			database = ./demoCA/index.txt
			new_certs_dir = ./demoCA/newcerts
			serial = ./demoCA/serial
			default_md = default
			policy = policy_anything
			x509_extensions	= ext_ca
			default_md = sha256

			default_enddate = 20291014135726Z
			copy_extensions = copy

			[ policy_anything ]
			countryName = optional
			stateOrProvinceName = optional
			localityName = optional
			organizationName = optional
			organizationalUnitName = optional
			commonName = supplied
			emailAddress = optional

			[ ext_ca ]
			basicConstraints = CA:FALSE
			keyUsage = nonRepudiation, digitalSignature, keyEncipherment
			extendedKeyUsage = serverAuth, clientAuth
		") \
		-out ${prefix}-cert.pem -infiles ${prefix}-csr.pem
done

rm *-csr.pem
rm -rf ./demoCA

################################################################################
# Keystore and Truststore
################################################################################

password="password"
entities=( ca client server )
for entity in "${entities[@]}"; do
	openssl pkcs12 -export -out ${entity}.pfx -inkey ${entity}-key.pem \
	-in ${entity}-cert.pem -password "pass:${password}"

	keytool -importkeystore -srckeystore ${entity}.pfx -srcstoretype pkcs12 \
		-srcalias 1 -srcstorepass ${password} -destkeystore keystore.jks \
		-deststoretype jks -deststorepass ${password} -destalias ${entity}
done
cp keystore.jks truststore.jks

rm *.pfx
