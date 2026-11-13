# Installation and usage

## Installation

```bash
npm install @escalated-dev/plugin-runtime
```

This package is installed alongside any SDK plugins you want to use. The host framework's bridge spawns it automatically — you do not need to run it manually.

## Usage

The runtime is started by the framework bridge (e.g., `escalated-laravel`, `escalated-rails`, `escalated-django`). You typically do not invoke it directly. The bridge spawns it as:

```bash
node node_modules/@escalated-dev/plugin-runtime/dist/index.js
```
