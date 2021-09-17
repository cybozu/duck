# Example for `build` and `serve` with Google Cloud Provider

## How to setup GCP account

See https://faastjs.org/docs/google-cloud and https://cloud.google.com/docs/authentication/getting-started.

1. Create a project
2. Create a google service account
3. Assign Owner permissions for the service account
4. Set an environment variable `GOOGLE_APPLICATION_CREDENTIALS`
5. Enable following APIs
   - Cloud functions API
   - Cloud Billing API
   - Cloud Build API

## How to build

```console
$ npm install
$ npm run build
```

## How to serve

```console
$ npm install
$ npm start
```

and open `http://localhost:1337/chunks.html`, `/page1.html` or `/page2.html` in your browser.
