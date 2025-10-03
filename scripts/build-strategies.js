#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const strategiesDir = path.resolve(__dirname, '..', 'strategies');

function compileStrategy(tsFile) {
  const source = fs.readFileSync(tsFile, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
    },
    fileName: tsFile,
  });
  const jsFile = tsFile.replace(/\.ts$/, '.js');
  fs.writeFileSync(jsFile, outputText, 'utf8');
  console.log(`Compiled ${path.basename(tsFile)} -> ${path.basename(jsFile)}`);
}

function run() {
  if (!fs.existsSync(strategiesDir)) {
    console.error('Strategies directory not found:', strategiesDir);
    process.exit(1);
  }
  const entries = fs.readdirSync(strategiesDir);
  let compiled = 0;
  for (const entry of entries) {
    if (entry.endsWith('.strategy.ts')) {
      const filePath = path.join(strategiesDir, entry);
      compileStrategy(filePath);
      compiled += 1;
    }
  }
  if (compiled === 0) {
    console.warn('No .strategy.ts files found to compile.');
  }
}

run();
