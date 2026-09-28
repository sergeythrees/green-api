# GREEN-API MAX v3 — API contracts (extracted from official docs)

Source pages (all fetched 2026-09-29, HTTP 200):

- <https://green-api.com/v3/docs/request-format/>
- <https://green-api.com/v3/docs/api/receiving/technology-http-api/ReceiveNotification/>
- <https://green-api.com/v3/docs/api/receiving/technology-http-api/DeleteNotification/>
- <https://green-api.com/v3/docs/api/receiving/notifications-format/incoming-message/Webhook-IncomingMessageReceived/>
- <https://green-api.com/v3/docs/api/receiving/notifications-format/incoming-message/TextMessage/>
- <https://green-api.com/v3/docs/api/chat-id/>
- <https://green-api.com/v3/docs/api/sending/SendMessage/>
- <https://green-api.com/v3/docs/api/account/GetStateInstance/>
- <https://green-api.com/v3/docs/api/account/SetSettings/>
- <https://green-api.com/v3/docs/api/service/CheckAccount/>

Everything below is quoted or paraphrased from those pages. Items the docs do not state are collected in `## Open questions` and marked `UNCONFIRMED`. Nothing here is invented.

---

## Request format (all methods)

### Endpoint

The docs give a URL *template*, not a fixed host. Two accepted forms:

- Without version prefix (preferred, unified across WhatsApp/Telegram/MAX):
  `{{apiUrl}}/waInstance{{idInstance}}/sendMessage/{{apiTokenInstance}}`
- With the `/v3/` prefix, kept for backward compatibility:
  `{{apiUrl}}/v3/waInstance{{idInstance}}/sendMessage/{{apiTokenInstance}}`

The address is built from: host `apiUrl` / `mediaUrl`, the optional version segment `/v3/`, the instance number `idInstance`, the method `method`, and the access key `apiTokenInstance`. These values are taken from the personal cabinet (<https://console.green-api.com>) per the "Перед началом работы" section.

The only concrete host the page shows (worked example) is:

`https://3100.api.green-api.com/waInstance3000000001/SendMessage/bde035edae3fc00bc116bd112297908d8145e5ba8decc5d884`

So `apiUrl` = `https://<cluster>.api.green-api.com`; `3100` is the cluster from the example, not stated as a universal value.

### Request body

Methods accept `GET`, `POST` or `DELETE` (the page: "необходимо выполнить GET, POST или DELETE запрос"). No JSON example is given for the request format itself.

### Response

Not applicable (this page describes request construction only).

### Notes

- Standard headers for most requests: `Content-Type: application/json` (the docs list no other required header; the token travels in the URL path).
- The `v3` prefix is an optional parameter; both forms are documented as valid.
- Method name casing is inconsistent in the docs: the template uses `sendMessage`, the worked example URL uses `SendMessage`. The docs do not state whether the path is case-sensitive — `UNCONFIRMED`.
- Cluster numbers seen on the site (news titles): 3100, 3500, 3502 — not part of this contract.

---

## ReceiveNotification

### Endpoint

`GET {{apiUrl}}/waInstance{{idInstance}}/receiveNotification/{{apiTokenInstance}}?receiveTimeout={{seconds}}`

### Request body

None — this is a GET with only the `receiveTimeout` URL query parameter. The docs' Python sample sends `payload = {}` with no headers.

| Parameter | Type | Required | Meaning |
| --- | --- | --- | --- |
| `receiveTimeout` | integer | no | Notification wait timeout, accepts **5 to 60 seconds** (default 5 seconds) |

### Response

Exact example from the docs ("Пример тела ответа"):

```json
{
  "receiptId": 1234567,
  "body": {
    "typeWebhook": "incomingMessageReceived",
    "instanceData": {
      "idInstance": 310000001,
      "wid": "79991234567@c.us",
      "typeInstance": "v3"
    },
    "timestamp": 1763115112,
    "idMessage": "126543123451133331119",
    "senderData": {
      "chatId": "10000000",
      "chatName": "Ходабрыш Пробешёлов",
      "chatType": "user",
      "sender": "10000000",
      "senderName": "Ходабрыш Пробешёлов",
      "senderType": "user",
      "senderContactName": "Ходабрыш Пробешёлов",
      "senderPhoneNumber": 79876543210
    },
    "messageData": {
      "typeMessage": "textMessage",
      "textMessageData": {
        "textMessage": "Привет от Green-API!"
      }
    }
  }
}
```

Response fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `receiptId` | integer | Delivery id, used to delete the notification with DeleteNotification |
| `body` | object | The incoming notification, per the incoming-notifications format |

### Notes

- The method waits **5 seconds** for a notification; on timeout it "завершается с пустым ответом" (completes with an empty response). The exact literal empty body is not shown — `UNCONFIRMED`.
- After receiving and processing a notification you **must** delete it via DeleteNotification; only then is it considered accepted and irreversibly removed. The next ReceiveNotification call then returns the next notification in arrival order.
- Notifications are stored in the queue for **24 hours** and returned **FIFO**.
- Per-method rate limits apply (see the ratelimiter page).
- Errors (HTTP 400):
  - `Parameter idInstance not an integer` — idInstance missing or non-numeric.
  - `Parameter apiTokenInstance not define` — apiTokenInstance missing.
  - `Message cannot be received because custom webhook url is set. Go to cabinet, clear webhook url for instance: ХХХХХХХХХХ and wait for about 1 minute for another attempt` — `webhookUrl` is not empty; clear it and wait ~1 minute before polling.
- General errors: see the "Стандартные ошибки" page.

---

## DeleteNotification

### Endpoint

`DELETE {{apiUrl}}/waInstance{{idInstance}}/deleteNotification/{{apiTokenInstance}}/{{receiptId}}`

The docs explicitly warn: "Обратите внимание, что метод использует запрос вида `DELETE`".

### Request body

None — `receiptId` is a path segment, not a JSON body. Python sample: `url = "{{apiUrl}}/waInstance{{idInstance}}/deleteNotification/{{apiTokenInstance}}/1234567"`, `payload = {}`.

| Parameter | Type | Required | Meaning |
| --- | --- | --- | --- |
| `receiptId` | integer | **yes** | Delivery id of the incoming notification, obtained from ReceiveNotification |

### Response

Exact example from the docs:

```json
{
  "result": true,
  "reason": ""
}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `result` | boolean | `true` — notification successfully removed from the queue; `false` — not removed (already deleted earlier, or `receiptId` does not match a value previously returned by ReceiveNotification) |
| `reason` | string | Reason the method failed |

### Notes

- Queue storage is **24 hours**, delivery order is **FIFO** (same note as ReceiveNotification).
- Per-method rate limits apply.
- Errors:
  - 400 `Parameter idInstance not an integer`
  - 400 `Parameter receiptId must be a Number!`
  - 400 `Parameter apiTokenInstance not define`
  - 400 `Message cannot be received because custom webhook url is set. Go to cabinet, clear webhook url for instance: ХХХХХХХХХХ and wait for about 1 minute for another attempt`
  - 500 `Internal Server Error` / `Cannot read properties of undefined (reading 'findUnAckedMessage')` — the message to delete was not found.
- Code samples use `receiptId` 1234567 (Python/cURL) and 12345 (VBA).

---

## Notification: `incomingMessageReceived` (full envelope)

### Endpoint

Not an endpoint — this is the payload delivered inside `body` of ReceiveNotification (or posted to `webhookUrl`).

### Request body

Not applicable. Envelope fields:

| Parameter | Type | Meaning |
| --- | --- | --- |
| `typeWebhook` | string | Notification type; for this one the value is `incomingMessageReceived` |
| `instanceData` | object | Instance data |
| `timestamp` | integer | Event time in UNIX format |
| `idMessage` | string | Incoming message id |
| `senderData` | object | Data about the sender of the message or file |
| `messageData` | object | Data about the received message or file |

`instanceData` fields:

| Parameter | Type | Meaning |
| --- | --- | --- |
| `idInstance` | integer | Instance id. uint64, 10 digits |
| `wid` | string | Account id |
| `typeInstance` | string | Messenger type for the instance: `v3` for MAX, `whatsapp` for WhatsApp |

`senderData` fields:

| Parameter | Type | Meaning |
| --- | --- | --- |
| `chatId` | string | Chat id in which the message/file was received |
| `chatName` | string | Chat name |
| `chatType` | string | Chat type: `user`, `group`, `channel`, `bot` |
| `sender` | string | Sender id |
| `senderName` | string | Sender name |
| `senderType` | string | Sender type: `user`, `group`, `channel`, `bot` |
| `senderContactName` | string | Sender name from the phone book contacts |
| `senderPhoneNumber` | integer | Sender phone number; `0` if the phone number is hidden or the contact is a group |

`messageData` has different fields depending on `messageData.typeMessage`.

### Response

Exact example — personal chat ("Пример тела уведомления из личного чата"):

```json
{
  "typeWebhook": "incomingMessageReceived",
  "instanceData": {
    "idInstance": 3100000000,
    "wid": "79991234567@c.us",
    "typeInstance": "v3"
  },
  "timestamp": 1763115112,
  "idMessage": "1763115112345",
  "senderData": {
    "chatId": "10000000",
    "chatName": "Ходабрыш Пробешёлов",
    "chatType": "user",
    "sender": "10000000",
    "senderName": "Ходабрыш Пробешёлов",
    "senderType": "user",
    "senderContactName": "Ходабрыш Пробешёлов",
    "senderPhoneNumber": 79876543210
  },
  "messageData": {
    "typeMessage": "textMessage",
    "textMessageData": {
      "textMessage": "Я использую GREEN-API для отправки этого сообщения!"
    }
  }
}
```

Exact example — group chat ("Пример тела уведомления из группового чата"):

```json
{
  "typeWebhook": "incomingMessageReceived",
  "instanceData": {
    "idInstance": 3100000000,
    "wid": "79991234567@c.us",
    "typeInstance": "v3"
  },
  "timestamp": 1763115112,
  "idMessage": "1763115112345",
  "senderData": {
    "chatId": "-69876543210123",
    "chatName": "Название группы",
    "chatType": "group",
    "sender": "10000000",
    "senderName": "Ходабрыш",
    "senderType": "user",
    "senderContactName": "",
    "senderPhoneNumber": 0
  },
  "messageData": {
    "typeMessage": "textMessage",
    "textMessageData": {
      "textMessage": "Я использую GREEN-API для отправки этого сообщения!"
    }
  }
}
```

### Notes

- In a group chat `sender` is the individual user (numeric id) while `chatId` is the negative group id; `senderPhoneNumber` is `0` and `senderContactName` is empty in the group example.
- The instance account id `wid` is itself in phone format `79991234567@c.us`.
- All incoming notification types are enumerated on the "Типы входящих уведомлений" page; this envelope is the common prefix for all `incomingMessageReceived` variants.

---

## Notification: `textMessageData` (incoming text message)

### Endpoint

Not an endpoint — `messageData` shape for incoming text messages. Two conditions must hold: `typeWebhook` = `incomingMessageReceived` and `messageData.typeMessage` = `textMessage`.

### Request body

`messageData` fields:

| Parameter | Type | Meaning |
| --- | --- | --- |
| `typeMessage` | string | Message type; here `textMessage` |
| `textMessageData` | object | Text message data object |
| `quotedMessage` | object | Quoted message data; present only if the message itself is a quote |

`textMessageData` fields:

| Parameter | Type | Meaning |
| --- | --- | --- |
| `textMessage` | string | The text message |
| `isForwarded` | boolean | Whether the message is forwarded, `true`/`false` |
| `forwardingScore` | integer | Number of times the message was forwarded |

`quotedMessage` fields:

| Parameter | Type | Meaning |
| --- | --- | --- |
| `stanzaId` | string | id of the quoted message |
| `participant` | string | id of the quoted message's sender |

### Response

Exact example — personal chat:

```json
{
  "typeWebhook": "incomingMessageReceived",
  "instanceData": {
    "idInstance": 3100000000,
    "wid": "79991234567@c.us",
    "typeInstance": "v3"
  },
  "timestamp": 1763115112,
  "idMessage": "1763115112345",
  "senderData": {
    "chatId": "10000000",
    "chatName": "Ходабрыш Пробешёлов",
    "chatType": "user",
    "sender": "10000000",
    "senderName": "Ходабрыш Пробешёлов",
    "senderType": "user",
    "senderContactName": "Ходабрыш Пробешёлов",
    "senderPhoneNumber": 79876543210
  },
  "messageData": {
    "typeMessage": "textMessage",
    "textMessageData": {
      "textMessage": "Я использую GREEN-API для отправки этого сообщения!"
    }
  }
}
```

Exact example — group chat:

```json
{
  "typeWebhook": "incomingMessageReceived",
  "instanceData": {
    "idInstance": 3100000000,
    "wid": "79991234567@c.us",
    "typeInstance": "v3"
  },
  "timestamp": 1763115112,
  "idMessage": "1763115112345",
  "senderData": {
    "chatId": "-69876543210123",
    "chatName": "Название группы",
    "chatType": "group",
    "sender": "10000000",
    "senderName": "Ходабрыш",
    "senderType": "user",
    "senderContactName": "",
    "senderPhoneNumber": 0
  },
  "messageData": {
    "typeMessage": "textMessage",
    "textMessageData": {
      "textMessage": "Я использую GREEN-API для отправки этого сообщения!",
      "forwardingScore": 0,
      "isForwarded": false
    }
  }
}
```

### Notes

- To receive these notifications you must enable one of (docs: "Настройка инстанса"):
  1. In the personal cabinet, enable `Получать уведомления о входящих сообщениях и файлах`;
  2. Via SetSettings, enable `incomingWebhook`.
- In the first example `textMessageData` contains only `textMessage`; the fields `isForwarded` and `forwardingScore` appear in the group example. Whether they are always present is not stated — see Open questions.

---

## chatId (MAX chat identifier)

### Endpoint

Not an endpoint — reference page for the `chatId` value used by SendMessage/CheckAccount and returned in webhooks.

### Request body

Not applicable. Rules from the page:

| Form | Example | Meaning |
| --- | --- | --- |
| Individual chat id | `"chatId": "10000000"` | Numeric user identifier (string), positive |
| Group chat id | `"chatId": "-10000000000000"` | Negative (leading `-`), group chats |
| Phone form (legacy/compat) | `"chatId": "79991234567@c.us"` (RF), `"chatId": "375291234567@c.us"` (RB) | Allowed only for RF and RB numbers, country codes `7` and `375` |

### Response

Exact examples from the docs:

```json
{
  "chatId": "10000002",
  "name": "Вася Петров",
  "contactName": "Вася Петров",
  "type": "user"
}
```

(contact from GetContacts)

```json
{
  "exist": true,
  "chatId": "10000000"
}
```

(response of CheckAccount, as quoted on the chat-id page)

### Notes

- The id is a **string** for backward compatibility; the docs recommend converting it to a number for more compact DB storage.
- The number can be positive (individual chats) or negative (group chats). Maximum length for group chats is **16 characters**. "Длина идентификатора чата может увеличиться со временем." (the length may grow over time).
- How to obtain a chatId: (1) from incoming notifications / message journals — the docs say it is in `"senderData": "sender"`; (2) GetContacts — field `"chatId"`; (3) CheckAccount — field `"chatId"`.
- **Recommended flow**: send by `chatId`. If the chatId is unknown, first call CheckAccount, take the returned `chatId`, then send to that `chatId`.
- Sending by phone number (`phoneNumber@c.us`) is supported **only for backward compatibility** with previous interface versions, and only for RF/RB codes `7` and `375`.
- Gotcha: when sending by phone number, the server assigns its own chatId and reports it in the incoming notification's `chatId`. Therefore sending by phone number is only usable when you do not need to process incoming messages and statuses; otherwise resolve the chatId with CheckAccount first.

---

## SendMessage

### Endpoint

`POST {{apiUrl}}/waInstance{{idInstance}}/sendMessage/{{apiTokenInstance}}`

### Request body

Exact examples from the docs ("Пример тела запроса"):

Personal chat:

```json
{
  "chatId": "10000000",
  "message": "Я использую GREEN-API для отправки этого сообщения!"
}
```

By phone number:

```json
{
  "chatId": "79991234567@c.us",
  "message": "Я использую GREEN-API для отправки этого сообщения!"
}
```

Group chat:

```json
{
  "chatId": "-10000000000000",
  "message": "Я использую GREEN-API для отправки этого сообщения!"
}
```

With quoting:

```json
{
  "chatId": "10000000",
  "message": "I use Green-API to send this message to you!",
  "quotedMessageId": "1763115112345"
}
```

| Parameter | Type | Required | Meaning |
| --- | --- | --- | --- |
| `chatId` | string | **yes** | Chat identifier |
| `message` | string | **yes** | Message text. Emoji supported. Maximum length 4000 characters. Must use UTF-8 without BOM |
| `typingTime` | integer | no | Duration of the "typing" notification shown in the chat, 1000 to 20000 ms (1 to 20 s) |
| `quotedMessageId` | string | no | Id of the message to quote. Quoting is only possible **from the same chat** you are sending to; to send from another chat use ForwardMessages |

### Response

Exact example from the docs:

```json
{
  "idMessage": "1763115112345"
}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `idMessage` | string | Id of the sent message |

### Notes

- Before sending you must obtain the chat id from your system, or use CheckAccount. The message is added to the send queue; it is stored in the queue for up to 24 hours and is sent immediately after the instance authorizes. Send rate is governed by `delaySendMessagesMilliseconds`.
- Quoting prerequisites: for quoting **incoming** messages, enable `Получать уведомления о входящих сообщениях и файлах`; for quoting **outgoing** messages sent from the phone, enable `Получать уведомления о сообщениях, отправленных с телефона`. If the message is not known to the system (not in the log via getMessage), it cannot be quoted.
- Errors:
  - 400 `Bad Request` / `Validation failed`
  - 400 `Validation failed.` / `Details: 'message' length must be less than or equal to 4000 characters long`
  - 403 `Your account is suspended` — temporary restrictions (partial send ban); sending is only possible to numbers that have your number in their contacts. The end time is in GetAccountSettings `suspendedUntil`.
  - 500 `request entity too large` — JSON longer than 100 KB.
- Silent-failure gotchas (docs call them out explicitly):
  - Sending to a service chat (e.g. "Сервисные уведомления") returns HTTP 200 and an idMessage, **but the message is not sent**; you get an `outgoingMessageStatus` webhook with `"status": "failed"`.
  - An incorrect `quotedMessageId` also returns 200 and an idMessage, **but the message is not delivered**.

---

## GetStateInstance

### Endpoint

`GET {{apiUrl}}/waInstance{{idInstance}}/getStateInstance/{{apiTokenInstance}}`

### Request body

None — GET with no parameters; the Python sample sends `payload = {}` and no headers.

| Parameter | Type | Required | Meaning |
| --- | --- | --- | --- |
| — | — | — | No parameters |

### Response

Exact example from the docs:

```json
{
  "stateInstance": "authorized"
}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `stateInstance` | string | Instance state. One of: `notAuthorized` (instance not authorized); `authorized`; `blocked` (the MAX account is blocked — after reboot/logout the instance moves to `notAuthorized`); `starting` (instance starting / service mode — may take up to 5 minutes to become `authorized`); `suspended` (temporary account restrictions, partial send ban — end time in GetAccountSettings `suspendedUntil`); `pendingPassword` (2FA password must be sent via SendAuthorizationPassword) |

### Notes

- With `suspended`, sending is only possible to numbers saved in contacts; sending to a number not saved in contacts yields error **403** `Your account is suspended`.
- Documented error table entry: HTTP **200** if the instance stays in `starting` for more than 5 minutes; the docs advise (1) reboot the instance via the reboot method and (2) contact support.
- Per-method rate limits apply.

---

## SetSettings

### Endpoint

`POST {{apiUrl}}/waInstance{{idInstance}}/setSettings/{{apiTokenInstance}}`

### Request body

Exact general example from the docs ("Пример тела запроса общий"):

```json
{
  "webhookUrl": "",
  "webhookUrlToken": "",
  "delaySendMessagesMilliseconds": 0,
  "markIncomingMessagesReaded": "no",
  "markIncomingMessagesReadedOnReply": "no",
  "outgoingWebhook": "no",
  "outgoingMessageWebhook": "no",
  "outgoingAPIMessageWebhook": "no",
  "stateWebhook": "yes",
  "incomingWebhook": "no",
  "editedMessageWebhook": "no",
  "deletedMessageWebhook": "no",
  "pollMessageWebhook": "no",
  "downloadUrlJpeg": "no"
}
```

The cURL sample body is:

```json
{
  "delaySendMessagesMilliseconds": 15000
}
```

| Parameter | Type | Required | Meaning |
| --- | --- | --- | --- |
| `webhookUrl` | string | no | URL to send notifications to. To disable receiving notifications, pass an empty string. When receiving notifications via the HTTP API technology, this field must be empty |
| `webhookUrlToken` | string | no | Authorization header for sending notifications; pass an empty string if not needed |
| `delaySendMessagesMilliseconds` | integer | no | Send interval in ms. Min 500 ms, max 600000 ms (10 min). Recommended not more than 300000 ms (5 min) |
| `markIncomingMessagesReaded` | string | no | Mark incoming messages as read: `yes`/`no`. Ignored if `markIncomingMessagesReadedOnReply` is `yes` |
| `markIncomingMessagesReadedOnReply` | string | no | Mark incoming messages as read when sending a message via API: `yes`/`no`. If `yes`, `markIncomingMessagesReaded` is ignored |
| `outgoingWebhook` | string | no | Receive notifications about statuses of sent messages: `yes`/`no` |
| `outgoingMessageWebhook` | string | no | Receive notifications about messages sent from phone, web and desktop versions: `yes`/`no` |
| `outgoingAPIMessageWebhook` | string | no | Receive notifications about messages sent via API: `yes`/`no`. When sending to a non-existent MAX account, no notification arrives |
| `stateWebhook` | string | no | Receive notifications about instance authorization state changes: `yes`/`no` |
| `incomingWebhook` | string | no | Receive notifications about incoming messages and files: `yes`/`no` |
| `editedMessageWebhook` | string | no | Receive notifications about edited messages: `yes`/`no` |
| `deletedMessageWebhook` | string | no | Receive notifications about deleted messages: `yes`/`no` |
| `pollMessageWebhook` | string | no | Receive notifications about polls: `yes`/`no` |
| `downloadUrlJpeg` | string | no | Receive a jpeg link for `imageMessage, stickerMessage` messages: `yes`/`no` |

Parameters may be supplied selectively; **at least one** parameter must be present.

### Response

Exact example from the docs:

```json
{
  "saveSettings": true
}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `saveSettings` | boolean | Flag that the settings were saved |

### Notes

- Calling this method **restarts the instance**. Settings are applied **within 5 minutes** after the call.
- Per-method rate limits apply.
- To get delivery/read status notifications for messages sent from the phone, both `outgoingMessageWebhook` and `outgoingWebhook` must be enabled.
- The errors section for this method lists no method-specific codes; it only refers to the general "Стандартные ошибки" page — concrete codes are `UNCONFIRMED`.
- Note: the docs' Python sample for this method also sends a `deviceWebhook` field, which is **not** documented in the parameter table; it appears only inside that code snippet.

---

## CheckAccount

### Endpoint

`POST {{apiUrl}}/waInstance{{idInstance}}/checkAccount/{{apiTokenInstance}}`

### Request body

Exact examples from the docs (reproduced verbatim, including the trailing comma in the first one):

```json
{
  "phoneNumber": 79991234567,
}
```

```json
{
  "phoneNumber": 79991234567,
  "force": true
}
```

Note: the first example as published is **not valid JSON** (trailing comma). Treat it as a documentation typo; the second example is valid.

| Parameter | Type | Required | Meaning |
| --- | --- | --- | --- |
| `phoneNumber` | integer | **yes** | Recipient phone number in international format: 11 or 12 digits. Only RF and RB numbers with codes `7` and `375` respectively are allowed |
| `force` | boolean | no | Whether to ignore the cache. Default `false` — the method uses cached data. `true` — ignores the cache and queries the MAX server directly |

### Response

Exact examples from the docs:

Number has a MAX account:

```json
{
  "exist": true,
  "chatId": "10000000",
  "fromCache": true
}
```

Number has no MAX account:

```json
{
  "exist": false,
  "chatId": "",
  "fromCache": false
}
```

Instance is in `starting` or `notAuthorized` state:

```json
{
  "status": false,
  "reason": "instance is starting or not authorized"
}
```

Phone-number request limit reached:

```json
{
  "status": false,
  "reason": "User get contact info limit reached"
}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `exist` | boolean | Whether a MAX account exists on the phone number |
| `chatId` | string | The MAX user's `chatId` for the phone number |
| `fromCache` | boolean | `true` — data from cache, `false` — data from the MAX server |

### Notes

- The method checks whether a MAX account exists on a phone number. This is the documented way to validate a phone number before creating a chat / sending: "Если Идентификатор чата неизвестен, то сначала используйте метод CheckAccount, получите значение `chatId`, и далее используйте `chatId` в методах отправки сообщений".
- Warning from the docs: the system records frequent account-existence checks by phone number, "especially suspicious" when the same non-existent number is checked repeatedly; MAX may then impose temporary restrictions.
- Errors:
  - 400 `Bad Request` / `Validation failed`
  - 400 `Validation failed.` / `Details: Wrong format. 'phoneNumber' must contain only digits`
  - 400 `bad phone number, valid 11 or 12 digits`
  - 400 `check phone number timeout limit exceeded`
  - 469 `User get contact info limit reached` — the MAX server returned an error due to frequent requests to different numbers within a few minutes. The docs recommend pausing number checks on the instance **for 2 hours**.
- Note the two shapes of the response: success uses `exist`/`chatId`/`fromCache`, failure uses `status`/`reason` (with no HTTP error necessarily).

---

## Notification: `extendedTextMessage` (incoming text that contains a URL)

Source: <https://green-api.com/v3/docs/api/receiving/notifications-format/incoming-message/ExtendedTextMessage/>

### Endpoint

Not an endpoint — this is the `messageData` shape of an `incomingMessageReceived`
notification whose `typeMessage` is `extendedTextMessage`.

### Request body

Not applicable. The docs state the notification is delivered only when both conditions hold:

- `typeWebhook = incomingMessageReceived`
- `messageData.typeMessage = extendedTextMessage`

### Response

Fields of `messageData`:

| Parameter | Type | Meaning |
| --- | --- | --- |
| `typeMessage` | string | `extendedTextMessage` for this kind |
| `extendedTextMessageData` | object | Data about the received text or URL |
| `quotedMessage` | object | Present only when the message itself is a quote |

Fields of `extendedTextMessageData`:

| Parameter | Type | Meaning |
| --- | --- | --- |
| `text` | string | Link text or plain text |
| `description` | string | Link description, may be empty |
| `title` | string | Link title, may be empty |
| `jpegThumbnail` | string | Base64 image preview, may be absent |
| `isForwarded` | boolean | Whether the message was forwarded (`true`/`false`) |
| `forwardingScore` | integer | Number of times the message was forwarded |

### Notes

- MAX delivers plain text as `textMessage`, but text containing a link as
  `extendedTextMessage`. Both are text, so the app accepts both in `extractText`
  ([src/store/chatStore.ts](../src/store/chatStore.ts)) — otherwise any message with a
  URL would be silently dropped.
- These notifications also require the instance setting "Получать уведомления о входящих
  сообщениях и файлах" (`incomingWebhook: "yes"`).
- The verbatim example body was not captured from the fetched page, so no JSON example is
  given here rather than reconstructing one. `UNCONFIRMED` (example-wise).

---

## Open questions

- **Concrete `apiUrl` host**: the docs never give a canonical host. The request-format page shows only the worked example `https://3100.api.green-api.com` and says `apiUrl`/`mediaUrl` are taken from the cabinet. Whether the host is fixed per instance/cluster or must be read from the console response is `UNCONFIRMED`.
- **Path casing**: the template uses `sendMessage`, the worked URL example uses `SendMessage`. Case sensitivity of the method path (`sendMessage` vs `SendMessage`) is `UNCONFIRMED`.
- **Exact "empty response" of ReceiveNotification on timeout**: the docs say the call "завершается с пустым ответом" but do not show the literal body (empty string vs `null` vs no body). `UNCONFIRMED`.
- **HTTP status codes / Content-Type of successful responses** for ReceiveNotification (200 vs 204 on timeout) are not documented. `UNCONFIRMED`.
- **`receiveTimeout` out-of-range behavior**: values must be 5–60; what happens below 5 or above 60 (clamping vs error) is `UNCONFIRMED`.
- **Rate limits**: the docs reference a per-method ratelimiter section for ReceiveNotification, DeleteNotification, SendMessage, GetStateInstance, SetSettings, CheckAccount, but the concrete requests-per-second values were not read/fetched here. `UNCONFIRMED`.
- **SetSettings-specific error codes**: the page lists no method-specific errors, only a link to the general errors page. `UNCONFIRMED`.
- **`textMessageData.isForwarded` / `forwardingScore` presence**: they appear only in the group-chat example; whether they are always present on `textMessage` notifications is `UNCONFIRMED`.
- **`quotedMessage` presence/format**: documented as present only when the message is a quote; the `textMessageData` page gives no example containing it. `UNCONFIRMED` (example-wise).
- **Chat id character set / guarantees**: individual chat ids are shown as numeric strings and group ids as negative numbers of at most 16 chars, but whether a numeric individual id is guaranteed and what the maximum length for individual ids is, are `UNCONFIRMED`.
- **`chatId` vs `sender` in notifications**: the chat-id page claims the chat id is in `"senderData": "sender"`, while the notification examples show both `chatId` and `sender`. Which to use when they differ (e.g. group chats) is `UNCONFIRMED` beyond the examples.
- **`deviceWebhook`**: appears in the SetSettings Python code sample but not in the parameters table — whether it is a valid field is `UNCONFIRMED`.
- **`phoneNumber` as string vs integer**: the CheckAccount parameter table says `integer`, but the VBA and cURL samples send it as a quoted string (`"79991234567"`). Whether a string is accepted is `UNCONFIRMED`.
- **`typingTime` semantics** (whether it delays the send or only shows the typing indicator) is not stated beyond "time the typing notification is shown". `UNCONFIRMED`.
- **Authentication headers**: the docs mention only `Content-Type: application/json` and place the token in the URL; whether any auth header exists is `UNCONFIRMED` (none documented).
- **GetSettings** was not among the fetched pages, so the settings *read* contract is `UNCONFIRMED` here.
