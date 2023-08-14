### Setting up env

For development

```
cp .env.example .env.development
npm dev # to start server
```

For production

```
cp .env.example .env.production
npm prod # to start server
```

For staging

```
cp .env.example .env.staging
npm stage # to start server
```

### Linting

Lint code with

```
yarn lint
```

Fix lint errors with (Note: some lint errors may need to be resolved manually)

```
yarn lint:fix
```
