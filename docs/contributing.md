# Contributing

## Setup

```bash
git clone https://github.com/OneStepAt4time/asteria.git
cd asteria
npm install
npm run build
```

## Development

```bash
npm test              # Run tests
npm run test:watch    # Watch mode
npm run lint          # Lint with Biome
npm run format        # Format with Biome
```

## Code Style

- Biome for linting and formatting
- TypeScript strict mode
- Single quotes, trailing commas, no semicolons
- 2-space indentation, 100 char line width

## Adding Comet Versions

1. Run `asteria snapshot` to capture current DOM
2. Create selector set in `src/selectors/v{version}.ts`
3. Register in `src/selectors/index.ts`
4. Add tests in `tests/integration/`

## Commit Messages

Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`
