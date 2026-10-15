'use strict';

const fs = require('node:fs');
const path = require('node:path');

// build-adapter resolves tsc via typescript/package.json#bin.tsc.
// The TypeScript 6 compatibility package only ships tsc6; the 7.0 compiler is @typescript/native.
const packageJsonPath = require.resolve('typescript/package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const declaredTsc = packageJson.bin?.tsc;
const declaredTscPath = declaredTsc && path.join(path.dirname(packageJsonPath), declaredTsc);

if (declaredTscPath && fs.existsSync(declaredTscPath)) {
    process.exit(0);
}

const nativePackageJsonPath = require.resolve('@typescript/native/package.json');
const nativeTsc = path.join(path.dirname(nativePackageJsonPath), 'bin', 'tsc');
packageJson.bin = {
    ...packageJson.bin,
    tsc: path.relative(path.dirname(packageJsonPath), nativeTsc),
};

fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
