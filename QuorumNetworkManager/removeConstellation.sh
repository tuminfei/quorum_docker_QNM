#!/bin/bash
# Removing legacy (v0.0.1) constellation-enclave-keygen
CONSTELLATION_ENCLAVE_BIN_PATH="$(which constellation-enclave-keygen)"
[ -e $CONSTELLATION_ENCLAVE_BIN_PATH ] && rm -f $CONSTELLATION_ENCLAVE_BIN_PATH
# Remove constellation-node binaries
CONSTELLATION_BIN_PATH="$(which constellation-node)"
[ -e $CONSTELLATION_BIN_PATH ] && rm -f $CONSTELLATION_BIN_PATH
# Remove constellation from bashrc
CONSTELLATION_BIN_DIR="$(dirname $CONSTELLATION_BIN_PATH)"
REMOVE_FROM_BASHRC="/PATH=\\\$PATH:$(echo $CONSTELLATION_BIN_DIR | sed -e 's/\\/\\\\/g; s/\//\\\//g; s/&/\\\&/g')/d"
sed -i $REMOVE_FROM_BASHRC ~/.bashrc
echo "Removed constellation binaries and bashrc entries. Left directory $CONSTELLATION_BIN_DIR for manual deletion"
