# Publishing to npm

This document describes how to publish this package to npm.

## Prerequisites

1. npm account with publish permissions for `@mkusaka` scope
2. Logged in to npm: `npm login`

## Publishing Steps

1. **Ensure all tests pass**
   ```bash
   pnpm test
   pnpm typecheck
   pnpm lint
   ```

2. **Build the project**
   ```bash
   pnpm build
   ```

3. **Update version**
   ```bash
   # For patch release (0.0.1 -> 0.0.2)
   npm version patch

   # For minor release (0.0.1 -> 0.1.0)
   npm version minor

   # For major release (0.0.1 -> 1.0.0)
   npm version major
   ```

4. **Publish to npm**
   ```bash
   npm publish --access public
   ```

5. **Push changes and tags**
   ```bash
   git push origin main --follow-tags
   ```

## First-time Publishing

For the first publish, ensure the package.json has:
- `"name": "@mkusaka/wtm"`
- `"publishConfig": { "access": "public" }` (for scoped packages)

## Verify Installation

After publishing, verify the package can be installed:

```bash
npm install -g @mkusaka/wtm
wtm --version
```

## Version Strategy

- **Patch**: Bug fixes and minor updates (0.0.x)
- **Minor**: New features, backwards compatible (0.x.0)
- **Major**: Breaking changes (x.0.0)

## Files Included in Package

The following files are included when publishing:
- `dist/` - Compiled JavaScript files
- `package.json`
- `README.md`
- `LICENSE` (if exists)

Files excluded:
- Source TypeScript files (`src/`)
- Test files (`test/`)
- Configuration files (`.eslintrc.json`, `tsconfig.json`, etc.)
- Development dependencies