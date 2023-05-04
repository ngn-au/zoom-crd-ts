#!/bin/bash
/usr/bin/forever start -c ts-node --sourceDir /opt/zoom-crd-ts -a --workingDir /opt/zoom-crd-ts -o /opt/zoom-crd-ts/logs/console.log -l /opt/zoom-crd-ts/logs/forever.log -e /opt/zoom-crd-ts/logs/error.log main.ts
