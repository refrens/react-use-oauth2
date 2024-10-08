# @refrens/react-use-oauth2

> 💎 A custom React hook that makes OAuth2 authorization simple. Both for **Implicit Grant** and **Authorization Code** flows.
> A fork of https://github.com/tasoskakour/react-use-oauth2 which uses Broadcast Channel API instead of Window.opener Post Message for communicating details between OAuth popup window and the opener window.

## Features

-   Usage with both `Implicit` and `Authorization Code` grant flows.
-   Seamlessly **exchanges code for token** via your backend API URL, for authorization code grant flows.
-   Works with **Popup** authorization.
-   Provides data and loading/error states via a hook.
-   **Persists data** to localStorage and automatically syncs auth state between tabs and/or browser windows.

## Install

_Requires `react@18.0.0` or higher_

```console
yarn add @refrens/react-use-oauth2
```

or

```console
npm i @refrens/react-use-oauth2
```

## Usage example

_For authorization code flow:_

```js
import { OAuth2Popup, useOAuth2 } from '@refrens/react-use-oauth2';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const Home = () => {
	const { data, loading, error, getAuth, logout } = useOAuth2({
		authorizeUrl: 'https://example.com/auth',
		clientId: 'YOUR_CLIENT_ID',
		redirectUri: `${document.location.origin}/callback`,
		scope: 'YOUR_SCOPES',
		responseType: 'code',
		exchangeCodeForTokenQuery: {
			url: 'https://your-backend/token',
			method: 'POST',
		},
		onSuccess: (payload) => console.log('Success', payload),
		onError: (error_) => console.log('Error', error_),
	});

	const isLoggedIn = Boolean(data?.access_token); // or whatever...

	if (error) {
		return <div>Error</div>;
	}

	if (loading) {
		return <div>Loading...</div>;
	}

	if (isLoggedIn) {
		return (
			<div>
				<pre>{JSON.stringify(data)}</pre>
				<button onClick={logout}>Logout</button>
			</div>
		);
	}

	return (
		<button style={{ margin: '24px' }} type="button" onClick={() => getAuth()}>
			Login
		</button>
	);
};

const App = () => {
	return (
		<BrowserRouter>
			<Routes>
				<Route element={<OAuthPopup />} path="/callback" />
				<Route element={<Home />} path="/" />
			</Routes>
		</BrowserRouter>
	);
};
```

##### Example with `exchangeCodeForTokenQueryFn`

You can also use `exchangeCodeForTokenQueryFn` if you want full control over your query to your backend, e.g if you must send your data as form-urlencoded:

```js

    const { ... } = useOAuth2({
      // ...
      // Instead of exchangeCodeForTokenQuery (e.g sending form-urlencoded or similar)...
      exchangeCodeForTokenQueryFn: async (callbackParameters) => {
        const formBody = [];
        for (const key in callbackParameters) {
          formBody.push(
            `${encodeURIComponent(key)}=${encodeURIComponent(callbackParameters[key])}`
          );
        }
        const response = await fetch(`YOUR_BACKEND_URL`, {
          method: 'POST',
          body: formBody.join('&'),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          },
        });
        if (!response.ok) throw new Error('Failed');
        const tokenData = await response.json();
        return tokenData;
      },.
      // ...
    })

```

### What is the purpose of `exchangeCodeForTokenQuery` for Authorization Code flows?

Generally when we're working with authorization code flows, we need to _immediately_ **exchange** the retrieved _code_ with an actual _access token_, after a successful authorization. Most of the times this is needed for back-end apps, but there are many use cases this is useful for front-end apps as well.

In order for the flow to be accomplished, the 3rd party provider we're authorizing against (e.g Google, Facebook etc), will provide an API call (e.g for Google is `https://oauth2.googleapis.com/token`) that we need to hit in order to exchange the code for an access token. However, this call requires the `client_secret` of your 3rd party app as a parameter to work - a secret that you cannot expose to your front-end app.

That's why you need to proxy this call to your back-end and with `exchangeCodeForTokenQuery` object you can provide the schematics of your call e.g `url`, `method` etc. The request parameters that will get passed along as **query parameters** are `{ code, client_id, grant_type, redirect_uri, state }`. By default this will be a **POST** request but you can change it with the `method` property.

You can read more about "Exchanging authorization code for refresh and access tokens" in [Google OAuth2 documentation](https://developers.google.com/identity/protocols/oauth2/web-server#exchange-authorization-code).

### What's the alternative option `exchangeCodeForTokenQueryFn`?

There could be certain cases where `exchangeCodeForTokenQuery` is not enough and you want full control over how you send the request to your backend. For example you may want to send it as a urlencoded form. With this property you can define your callback function which takes `callbackParameters: object` as a parameter (which includes whatever returned from OAuth2 callback e.g `code, scope, state` etc) and must return a promise with a valid object which will contain all the token data state e.g `access_token, expires_in` etc.

### What's the case with Implicit Grant flows?

With an implicit grant flow things are much simpler as the 3rd-party provider immediately returns the `access_token` to the callback request so there's no need to make any action after that. Just set `responseType=token` to use this flow.

### Data persistence

After a successful authorization, data will get persisted to **localStorage** and the state will automatically sync to all tabs/pages of the browser. The storage key the data will be written to will be: `{responseType}-{authorizeUrl}-{clientId}-{scope}`.

If you want to re-trigger the authorization flow just call `getAuth()` function again.

**Note**: In case localStorage is throwing an error (e.g user has disabled it) then you can use the `isPersistent` property which - for this case - will be false. Useful if you want to notify the user that the data is only stored in-memory.

## API

-   `function useOAuth2(options): {data, loading, error, getAuth}`

This is the hook that makes this package to work. `Options` is an object that contains the properties below

-   `authorizeUrl` (string): The 3rd party authorization URL (e.g https://accounts.google.com/o/oauth2/v2/auth).
-   `clientId` (string): The OAuth2 client id of your application.
-   `redirectUri` (string): Determines where the 3rd party API server redirects the user after the user completes the authorization flow. In our [example](#usage-example) the Popup is rendered on that redirectUri.
-   `scope` (string - _optional_): A list of scopes depending on your application needs.
-   `responseType` (string): Can be either **code** for _code authorization grant_ or **token** for _implicit grant_.
-   `extraQueryParameters` (object - _optional_): An object of extra parameters that you'd like to pass to the query part of the authorizeUrl, e.g {audience: "xyz"}.
-   `exchangeCodeForTokenQuery` (object): This property is only required when using _code authorization grant_ flow (responseType = code). It's properties are:
    -   `url` (string - _required_) It specifies the API URL of your server that will get called immediately after the user completes the authorization flow. Read more [here](#what-is-the-purpose-of-exchangecodefortokenserverurl-for-authorization-code-flows).
    -   `method` (string - _required_): Specifies the HTTP method that will be used for the code-for-token exchange to your server. Defaults to **POST**
    -   `headers` (object - _optional_): An object of extra parameters that will be used for the code-for-token exchange to your server.
-   `exchangeCodeForTokenQueryFn` function(callbackParameters) => Promise\<Object\>: **Instead of using** `exchangeCodeForTokenQuery` to describe the query, you can take full control and provide query function yourself. `callbackParameters` will contain everything returned from the OAUth2 callback e.g `code, state` etc. You must return a promise with a valid object that will represent your final state - data of the auth procedure.
-   **onSuccess** (function): Called after a complete successful authorization flow.
-   **onError** (function): Called when an error occurs.

**Returns**:

-   `data` (object): Consists of the retrieved auth data and generally will have the shape of `{access_token, token_type, expires_in}` (check [Typescript](#typescript) usage for providing custom shape). If you're using `responseType: code` and `exchangeCodeForTokenQueryFn` this object will contain whatever you returnn from your query function.
-   `loading` (boolean): Is set to true while the authorization is taking place.
-   `error` (string): Is set when an error occurs.
-   `getAuth` (function): Call this function to trigger the authorization flow.
-   `logout` (function): Call this function to logout and clear all authorization data.
-   `isPersistent` (boolean): Property that returns false if localStorage is throwing an error and the data is stored only in-memory. Useful if you want to notify the user.

---

-   `function OAuthPopup(props)`

This is the component that will be rendered as a window Popup for as long as the authorization is taking place. You need to render this in a place where it does not disrupt the user flow. An ideal place is inside a `Route` component of `react-router-dom` as seen in the [usage example](#usage-example).

Props consists of:

-   `Component` (ReactElement - _optional_): You can optionally set a custom component to be rendered inside the Popup. By default it just displays a "Loading..." message.

### Typescript

The `useOAuth2` function identity is:

```
const useOAuth2: <TData = AuthTokenPayload>(props: Oauth2Props<TData>) => {
    data: State<AuthTokenPayload>;
    loading: boolean;
    error: null;
    getAuth: () => () => void;
}
```

That means that generally the data will have the shape of `AuthTokenPayload` which consists of:

```
token_type: string;
expires_in: number;
access_token: string;
scope: string;
refresh_token: string;
```

And that also means that you can set the data type by using the hook like this:

```
type MyCustomShapeData = {
  ...
}

const {data, ...} = useOAuth2<MyCustomShapeData>({...});
```

### Migrating to v2.0.0 (2024-03-05)

Please follow the steps below to migrate to `v2.0.0`:

-   **DEPRECATED properties**: `exchangeCodeForTokenServerURL`, `exchangeCodeForTokenMethod`, `exchangeCodeForTokenHeaders`
-   **INTRODUCED NEW PROPERTY**: `exchangeCodeForTokenQuery`
    -   `exchangeCodeForTokenQuery` just combines all the above deprecated properties, e.g you can use it like: `exchangeCodeForTokenQuery: { url:"...", method:"POST", headers:{} }`

### Tests

You can run tests by calling

```console
npm test
```

It will start a react-app (:3000) and back-end server (:3001) and then it will run the tests with jest & puppeteer.
