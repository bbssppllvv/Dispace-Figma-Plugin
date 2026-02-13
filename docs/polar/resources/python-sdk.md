# Python SDK

Fully type-hinted, supports both synchronous and asynchronous usage via [HTTPX](https://www.python-httpx.org/). Schemas validated by [Pydantic](https://docs.pydantic.dev/latest/).

## Installation

```bash
pip install polar-sdk
```

## Quickstart

```python
# Synchronous Example
from polar_sdk import Polar

s = Polar(
    access_token="<YOUR_BEARER_TOKEN_HERE>",
)

res = s.users.benefits.list()

if res is not None:
    while True:
        # handle items
        res = res.Next()
        if res is None:
            break
```

[Read more](https://github.com/polarsource/polar-python)

## Sandbox Environment

Configure the SDK to hit the sandbox environment:

```python
s = Polar(
    server="sandbox",
    access_token="<YOUR_BEARER_TOKEN_HERE>",
)
```
