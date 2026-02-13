# OAuth 2.0 Connect

## Authorize

To start the authorization flow you need to redirect the user to the authorization URL:

```
https://polar.sh/oauth2/authorize?
  response_type=code
  &client_id=CLIENT_ID
  &redirect_uri=https%3A%2F%2Fexample.com%2Fcallback
  &scope=openid%20email
```

### Parameters

* `response_type=code` (required) - Indicates that you want to use the authorization code flow.
* `client_id` (required) - The Client ID you got when creating the OAuth 2.0 client.
* `redirect_uri` (required) - The URL where the user will be redirected after granting access. Must be declared when creating the OAuth2 client.
* `scope` (required) - A space-separated list of scopes. Must be part of the scopes declared when creating the OAuth2 client.

If they allow it and select an organization, they'll be redirected to your `redirect_uri` with a `code` parameter in the query string.

To skip the organization selection and get a user-scoped token instead, add `sub_type=user` to the authorization URL.

## Exchange Code Token

Once you have the authorization code, exchange it for an access token via a `POST` request to the token endpoint:

```bash
curl -X POST https://api.polar.sh/v1/oauth2/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=authorization_code&code=AUTHORIZATION_CODE&client_id=CLIENT_ID&client_secret=CLIENT_SECRET&redirect_uri=https://example.com/callback'
```

Response:

```json
{
  "token_type": "Bearer",
  "access_token": "polar_at_XXX",
  "expires_in": 864000,
  "refresh_token": "polar_rt_XXX",
  "scope": "openid email",
  "id_token": "ID_TOKEN"
}
```

* `access_token` - Make authenticated API requests on behalf of the user.
* `refresh_token` - Long-lived token to get new access tokens when the current one expires.
* `id_token` - Signed JWT token containing information about the user (OpenID Connect spec).

## Organization vs User Access Tokens

By default, Polar OAuth2 flow generates **organization-level** access tokens. These tokens are tied to a specific organization rather than a user.

To request a **user-scoped** access token instead, add the parameter `sub_type=user` to the authorization URL.

## Public Clients

Public clients are clients where the Client Secret can't be kept safe (SPA, mobile applications). If the client is configured as a Public Client, the request to the token endpoint won't require the `client_secret` parameter. However, the [PKCE](https://oauth.net/2/pkce/) method will be required.

## Make Authenticated Requests

```bash
curl -X GET https://api.polar.sh/v1/oauth2/userinfo \
  -H 'Authorization: Bearer polar_at_XXX'
```
