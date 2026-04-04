# Comet Compatibility

## Supported Versions

| Chrome Version | Selector Set | Status |
|---------------|-------------|--------|
| 145 | v145 | Supported |

## Adding New Versions

1. Create `src/selectors/v{version}.ts` with the selector set
2. Add to the registry in `src/selectors/index.ts`
3. Test with `asteria snapshot` to verify selectors
4. Add to this table
