# Example for `build` and `serve` with Google Cloud Provider

## How to setup GCP account

See https://faastjs.org/docs/google-cloud and https://cloud.google.com/docs/authentication/getting-started.

1. Create a project
2. Enable following APIs
   - Cloud functions API
   - Cloud Billing API
   - Cloud Build API
3. Create a google service account
4. Assign Owner permissions for the service account
5. Set an environment variable `GOOGLE_APPLICATION_CREDENTIALS`

If you want to set strict permissions for the service account instead of Owner permissions, assign the following roles:

- Cloud Functions Admin
- Pub/Sub Editor
- Billing Account Usage Commitment Recommender Viewer

To allow the service account to impersonate App Engine default service account (`PROJECT-ID@appspot.gserviceaccount.com`), grant Service Account User role on the service account.
See https://cloud.google.com/iam/docs/impersonating-service-accounts#impersonate-sa-level.

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
