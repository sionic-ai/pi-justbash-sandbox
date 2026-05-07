#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const marker = "__jb_utf8_fix";
const utf8Guard =
  'var __jb_utf8_fix=(s)=>{if(!s)return s;var h=false;for(var i=0;i<s.length;i++){var c=s.charCodeAt(i);if(c>0xff)return s;if(c>0x7f)h=true}if(!h)return s;var b=new Uint8Array(s.length);for(var i=0;i<s.length;i++)b[i]=s.charCodeAt(i);try{return new TextDecoder("utf-8",{fatal:true}).decode(b)}catch(e){return s}};';

function resolveJustBashRoot() {
  const entrypoint = require.resolve("just-bash", {
    paths: [process.cwd()],
  });
  let current = path.dirname(entrypoint);
  while (current !== path.dirname(current)) {
    const packageJson = path.join(current, "package.json");
    if (existsSync(packageJson)) {
      const content = readFileSync(packageJson, "utf8");
      if (content.includes('"name": "just-bash"')) return current;
    }
    current = path.dirname(current);
  }
  throw new Error(`Unable to locate just-bash package root from ${entrypoint}`);
}

function findJqChunk(justBashRoot) {
  const chunksDir = path.join(justBashRoot, "dist", "bin", "chunks");
  if (!existsSync(chunksDir)) {
    throw new Error(`just-bash chunks directory not found: ${chunksDir}`);
  }

  for (const entry of readdirSync(chunksDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
    const filePath = path.join(chunksDir, entry.name);
    const content = readFileSync(filePath, "utf8");
    if (content.includes('usage:"jq [OPTIONS] FILTER [FILE]"')) {
      return filePath;
    }
  }
  throw new Error(`Unable to locate just-bash jq chunk under ${chunksDir}`);
}

function applyUtf8Patch(filePath) {
  const content = readFileSync(filePath, "utf8");
  if (content.includes(marker)) return;

  const functionIndex = content.indexOf("function ");
  if (functionIndex < 0) {
    throw new Error(`Unable to locate insertion point in ${filePath}`);
  }

  let patched = `${content.slice(0, functionIndex)}${utf8Guard}${content.slice(functionIndex)}`;
  let replacements = 0;
  patched = patched.replace(/content:([A-Za-z_$][\w$]*\.stdin)/g, (_match, input) => {
    replacements += 1;
    return `content:${marker}(${input})`;
  });
  patched = patched.replace(/content:([A-Za-z_$][\w$]*\.content)/g, (_match, input) => {
    replacements += 1;
    return `content:${marker}(${input})`;
  });

  if (replacements < 2) {
    throw new Error(`Unable to patch jq input decoding in ${filePath}`);
  }

  writeFileSync(filePath, patched);
}

applyUtf8Patch(findJqChunk(resolveJustBashRoot()));
