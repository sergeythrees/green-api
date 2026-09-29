# GREEN-API Telegram — account & service API contracts

Source of truth: the Russian Telegram docs under <https://green-api.com/telegram/docs/> (fetched 2026-09-29).
Everything below is transcribed from those pages. Anything the docs do not state is explicitly marked **UNCONFIRMED**.
Verbatim JSON examples are reproduced as published (including the source's own typos, which are flagged).

## Common conventions (from request-format)

Ref: <https://green-api.com/telegram/docs/request-format/>

URL shape for every method:

```
{{apiUrl}}/waInstance{{idInstance}}/{{method}}/{{apiTokenInstance}}
```

| Piece | Meaning |
| --- | --- |
| `apiUrl` | API host (and `mediaUrl` for file uploads), from the cabinet |
| `idInstance` | Instance number, integer (example `4100000000`) |
| `method` | Method name, case-insensitive in practice (docs use `SendMessage` and `getStateInstance` interchangeably) |
| `apiTokenInstance` | Instance access key |

Example: `https://4100.api.green-api.com/waInstance4100000000/SendMessage/abcdef12345fghij67890klmno09876pqrstu54321vwxyz`

---

## 1. GetStateInstance — instance state

URL: <https://green-api.com/telegram/docs/api/account/GetStateInstance/>

**Request**

```
GET {{apiUrl}}/waInstance{{idInstance}}/getStateInstance/{{apiTokenInstance}}
```

No body. Rate-limited per second (limits table not reproduced here).

**Response fields**

| Field | Type | Description |
| --- | --- | --- |
| `stateInstance` | **string** | Instance state, enumerated below |

**Full `stateInstance` enumeration (all 6 documented values)**

| Value | Meaning |
| --- | --- |
| `notAuthorized` | Instance is not authorized. This status is also shown while waiting for the code or password to be entered |
| `authorized` | Instance is authorized |
| `blocked` | Instance received a block (permanent, per the GetAccountSettings wording) |
| `suspended` | Temporary restrictions on the account (partial ban on sending messages). End time is in `GetAccountSettings.suspendedUntil` |
| `starting` | Instance is starting (service mode); reboot/server restart/maintenance. May take up to 5 minutes to become `authorized` |
| `pendingPassword` | To finish authorization the 2FA password must be sent via `SendAuthorizationPassword` |

**Verbatim response example**

```json
{
  "stateInstance": "authorized"
}
```

Documented error case: HTTP 200, instance stuck in `starting` for more than 5 minutes → call `reboot`, or contact support.

---

## 2. SetSettings — instance settings / webhook routing

URL: <https://green-api.com/telegram/docs/api/account/SetSettings/>

Notes stated on the page: all settings are off by default after instance creation; **calling this method restarts the instance**; settings take effect within 5 minutes.

**Request**

```
POST {{apiUrl}}/waInstance{{idInstance}}/setSettings/{{apiTokenInstance}}
```

Parameters may be supplied selectively — **at least one parameter must be present**.

**Request body fields**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `webhookUrl` | string | No | URL to send notifications to. To disable notifications pass an empty string. **When receiving notifications via the HTTP API technology, this field must be empty.** |
| `webhookUrlToken` | string | No | Authorization header for notification delivery; empty string if not needed |
| `delaySendMessagesMilliseconds` | integer | No | Send interval in ms. Min 500 (0.5 s), max 600000 (10 min). Recommended ≤ 300000 (5 min) |
| `markIncomingMessagesReaded` | string | No | Mark incoming messages as read: `yes`/`no`. Ignored if `markIncomingMessagesReadedOnReply` is `yes` |
| `markIncomingMessagesReadedOnReply` | string | No | Mark incoming messages read when a message is sent via API: `yes`/`no`. If `yes`, `markIncomingMessagesReaded` is ignored |
| `outgoingWebhook` | string | No | Receive notifications about **statuses** of sent messages: `yes`/`no` |
| `outgoingMessageWebhook` | string | No | Receive notifications about messages sent **from phone / web / desktop**: `yes`/`no` |
| `outgoingAPIMessageWebhook` | string | No | Receive notifications about messages **sent via API**: `yes`/`no` |
| `stateWebhook` | string | No | Receive notifications about changes of instance authorization state: `yes`/`no` |
| `incomingWebhook` | string | No | Receive notifications about incoming messages and files: `yes`/`no` |
| `keepOnlineStatus` | string | No | Keep instance "Online" permanently: `yes`/`no` |
| `editedMessageWebhook` | string | No | Receive notifications when the counterparty edits a message: `yes`/`no` |
| `deletedMessageWebhook` | string | No | Receive notifications when the counterparty deletes a message: `yes`/`no` |

**Verbatim "general request body" example (all fields)**

```json
{
  "webhookUrl": "",
  "webhookUrlToken": "",
  "delaySendMessagesMilliseconds": 500,
  "markIncomingMessagesReaded": "no",
  "markIncomingMessagesReadedOnReply": "no",
  "outgoingWebhook": "yes",
  "outgoingMessageWebhook": "yes",
  "outgoingAPIMessageWebhook": "yes",
  "incomingWebhook": "yes",
  "stateWebhook": "yes",
  "keepOnlineStatus": "no",
  "editedMessageWebhook": "yes",
  "deletedMessageWebhook": "yes"
}
```

**Response fields**

| Field | Type | Description |
| --- | --- | --- |
| `saveSettings` | boolean | Flag that settings were saved |

```json
{
  "saveSettings": true
}
```

**Switching to HTTP-API receiving** (cross-ref <https://green-api.com/telegram/docs/api/receiving/technology-http-api/>): set `webhookUrl` to `""` and enable at least the desired notification kinds, e.g.:

```json
{
  "webhookUrl": "",
  "outgoingWebhook": "yes",
  "stateWebhook": "yes",
  "incomingWebhook": "yes"
}
```

Corroborating error from ReceiveNotification: if `webhookUrl` is not empty, `receiveNotification` fails with *"Message cannot be received because custom webhook url is set. Go to cabinet, clear webhook url for instance: … and wait for about 1 minute"*.

Side note: a VBA sample on the SetSettings page also sends `incomingBlockWebhook`, which is **not** in the parameter table — treat as UNCONFIRMED legacy field.

---

## 3. GetAccountSettings — account info

URL: <https://green-api.com/telegram/docs/api/account/GetAccountSettings/>

**Request**

```
GET {{apiUrl}}/waInstance{{idInstance}}/getAccountSettings/{{apiTokenInstance}}
```

**Response fields**

| Field | Type | Description |
| --- | --- | --- |
| `avatar` | string | Link to the Telegram account avatar. Empty for `notAuthorized`, `blocked`, `starting` |
| `phone` | string | Phone number of the Telegram account. Empty for `notAuthorized`, `blocked`, `starting` |
| `stateInstance` | string | Instance state; same enumeration as GetStateInstance: `notAuthorized`, `authorized`, `blocked`, `suspended`, `starting`, `pendingPassword` |
| `chatId` | string | "Saved messages" / personal chat id of the account; can be used to message yourself or shared with others so they can message you. Empty for `notAuthorized`, `blocked`, `starting` |
| `suspendedUntil` | integer | End time of temporary account restrictions. **Present only when `stateInstance` is `suspended`** |
| `username` | string | Public profile name, starts with `@` |
| `historySyncProgress` | integer | Percent of chat history synchronization on the instance |

**Verbatim response example**

```json
{
  "avatar": "https://4100.api.green-api.com/download/4100/PzBLVNDU6b7cVKfnn9roTFd8icThySLvm2oL.jpg",
  "phone": "79876543210",
  "stateInstance": "authorized",
  "chatId": "10000000",
  "historySyncProgress": 100,
  "username": "@username"
}
```

Note for a login/credentials screen: there is **no** `name` field here — display name must come from `GetContactInfo` with the account's own `chatId`.

---

## 4. CheckAccount — resolve chatId by phone number or username

URL: <https://green-api.com/telegram/docs/api/service/CheckAccount/>

Warning on the page: repeatedly checking non-existent numbers is recorded and Telegram may impose temporary restrictions.

**Request**

```
POST {{apiUrl}}/waInstance{{idInstance}}/checkAccount/{{apiTokenInstance}}
```

**Request body fields**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `phoneNumber` | integer | No* | Phone in international format (*required if `username` is absent) |
| `username` | string | No* | Telegram username starting with `@` (*required if `phoneNumber` is absent) |
| `force` | boolean | No | Whether to ignore the cache. Default `false` = use cached data; `true` = bypass cache and query Telegram directly |

**Verbatim request examples**

```json
{
  "username": "@username"
}
```

```json
{
  "phoneNumber": 79876543210,
  "force": true
}
```

**Response fields (success)**

| Field | Type | Description |
| --- | --- | --- |
| `exist` | boolean | Whether a Telegram account exists for the phone number |
| `chatId` | string | chatId of the Telegram user for the phone number |
| `username` | string | Unique public username |
| `phoneNumber` | integer | Phone number in international format |
| `fromCache` | boolean | `true` = data from cache, `false` = directly from Telegram |

**Verbatim response examples**

Account linked to the number:

```json
{
  "exist": true,
  "chatId": "10000000",
  "username": "@username",
  "phoneNumber": 79876543210,
  "fromCache": true
}
```

No account, or number hidden by privacy settings:

```json
{
  "exist": false,
  "chatId": ""
}
```

Instance in `starting` or `notAuthorized`:

```json
{
  "status": false,
  "reason": "instance is starting or not authorized"
}
```

Rate limit hit for the number:

```json
{
  "status": false,
  "data": {
    "status": "fail",
    "reason": "rate_limit_exceeded",
    "retryAfter": 11930619
  }
}
```

Both a phone number and a username supplied (the doc comment says "both" though the `reason` text says "or"):

```json
{
  "status": false,
  "reason": "request should contain 'phoneNumber' or 'username'"
}
```

Telegram restricted contact search/import on the account (HTTP 469):

```json
{
  "status": false,
  "reason": "Rate limited by messenger"
}
```

Telegram servers temporarily unavailable (HTTP 500):

```json
{
  "status": false,
  "reason": "Messenger is temporarily unavailable"
}
```

**Error table**

| HTTP | Error identifier | Description |
| --- | --- | --- |
| 400 | Bad Request / Validation failed | Validation error |
| 400 | `Validation failed. Details: Wrong format. 'phoneNumber' must contain only digits` | Phone must contain digits only |
| 200 | `rate_limit_exceeded` | Telegram returned an error due to frequent checks of different numbers; pause number checks on the instance for 2 hours |
| 469 | Rate limited by messenger | Telegram-side restriction; wait it out (duration not disclosed), retry in a few hours |
| 500 | Messenger is temporarily unavailable | Retry in a few minutes |

**chatId resolution policy** (from <https://green-api.com/telegram/docs/api/chat-id/>): always send by `chatId`; use phone number / `@username` only to obtain the chatId via CheckAccount. Phone in `phoneNumber@c.us` form is still accepted in send methods for backward compatibility only. "Create chat by phone number" therefore = `checkAccount` → `chatId`, then use that chatId everywhere (send, history, read).

---

## 5. GetChats — chat list

URL: <https://green-api.com/telegram/docs/api/service/GetChats/>

**Request**

```
GET {{apiUrl}}/waInstance{{idInstance}}/getChats/{{apiTokenInstance}}
```

No request body, **no query parameters documented**. Pagination: **UNCONFIRMED / not supported by the docs** — the response is a plain JSON array of all chats; the only documented error is HTTP 200 with an empty array `[]` (support case). Do not assume `count`/`offset` exist.

**Response fields (each array element)**

| Field | Type | Description |
| --- | --- | --- |
| `chatId` | string | Chat or group chat identifier |
| `name` | string | Chat name (group title or contact name) |
| `type` | string | Chat type: `"user"`, `"group"`, `"supergroup"`, `"channel"` |
| `phoneNumber` | integer | Contact phone number; `0` if the number is hidden or the chat is a group |
| `username` | string | Telegram username starting with `@` |

**Verbatim response example**

```json
[
  {
    "chatId": "-10000000000000",
    "name": "GREEN-API Super Group",
    "type": "supergroup",
    "phoneNumber": 0,
    "username": "@green_api_supergroup"
  },
  {
    "chatId": "10000000",
    "name": "Василиса Премудрая",
    "type": "user",
    "phoneNumber": 79876543210,
    "username": "@vasilisa"
  },
  {
    "chatId": "-5098765432",
    "name": "GREEN-API Group",
    "type": "group",
    "phoneNumber": 0,
    "username": ""
  }
]
```

No `avatar`, `unreadCount`, or `lastMessage` fields are documented on this method — for a sidebar avatar use `GetAvatar`/`GetContactInfo`, for unread state there is no documented field (**UNCONFIRMED**).

---

## 6. GetContactInfo — contact details

URL: <https://green-api.com/telegram/docs/api/service/GetContactInfo/>

**Request**

```
POST {{apiUrl}}/waInstance{{idInstance}}/getContactInfo/{{apiTokenInstance}}
```

**Request body fields**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `chatId` | string | Yes | Chat identifier |

```json
{
  "chatId": "10000000"
}
```

Note: the doc's cURL sample (only) uses `"chatId": "71234567890@c.us"`; the parameter table and all other samples use the numeric string form. Group chats are **not** supported here — the API returns *"The method GetContactInfo does not support group chats, to work with groups, use the GetGroupData method"*.

**Response fields**

| Field | Type | Description |
| --- | --- | --- |
| `avatar` | string | Avatar link |
| `name` | string | Contact name |
| `contactName` | string | Contact name from the phone book |
| `chatId` | string | Chat identifier |
| `chatType` | string | Account type (values not enumerated on this page; elsewhere: `user`, `group`, `supergroup`, `channel`, `bot`) |
| `lastSeen` | integer | Last online time; `0` if hidden by privacy settings |
| `phoneNumber` | integer | Contact phone number |
| `username` | string | Public profile name starting with `@` |
| `isPremium` | boolean | Premium account flag |
| `isVerified` | boolean | Verified account flag |
| `isScam` | boolean | `true` if Telegram marked the user as a scammer |
| `description` | string | Account description ("About" / Bio) |

**Verbatim response example**

```json
{
  "avatar": "https://4100.api.green-api.com/download/4100/BTZ4NuB7eCzxAQozwDKYmcUEvgSXr.jpg",
  "name": "Василиса",
  "contactName": "Василиса Премудрая",
  "chatId": "100000000",
  "chatType": "user",
  "lastSeen": 1769681957,
  "phoneNumber": 79876543210,
  "username": "@vasilisa",
  "isPremium": true,
  "isVerified": false,
  "isScam": false,
  "description": ""
}
```

There is **no documented lookup of a contact by phone number or username** other than via `CheckAccount` → `chatId` → `GetContactInfo`. `GetContactInfo` takes `chatId` only (**UNCONFIRMED** whether phone-number strings are accepted).

**Error table**

| HTTP | Error identifier | Description |
| --- | --- | --- |
| 400 | Bad Request / Validation failed | Validation error |
| 400 | `Validation failed. Details: The method GetContactInfo does not support group chats, to work with groups, use the GetGroupData method` | Empty body, wrong chatId, or a groupId was passed |
| 400 | `user with required chatId is deleted` | Account with the given chatId is deleted |

---

## 7. ReadChat — mark a chat as read

URL: <https://green-api.com/telegram/docs/api/marks/ReadChat/>

Precondition, quoted from the page: the instance setting "Receive notifications about incoming messages and files" must be enabled in the cabinet or via `SetSettings` (i.e. `incomingWebhook: "yes"`).

There is **no documented "mark as unread" method**. Unread also appears only as the instance-level setting `markIncomingMessagesReaded` (§2). A `readChat`-style unread operation is **UNCONFIRMED**.

**Request**

```
POST {{apiUrl}}/waInstance{{idInstance}}/readChat/{{apiTokenInstance}}
```

**Request body fields**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `chatId` | string | Yes | Chat identifier |

```json
{
  "chatId": "10000000"
}
```

Discrepancy to be aware of: the Python/cURL/Java code samples on the same page also pass `"idMessage": "115066794584856130"`, but the parameter table lists only `chatId` and the VBA sample matches the table. Whether `idMessage` is accepted is **UNCONFIRMED**; send only `chatId`.

**Response fields**

| Field | Type | Description |
| --- | --- | --- |
| `setRead` | boolean | Flag that messages were marked as read |

**Verbatim response examples**

```json
{
  "setRead": true
}
```

status code 400:

```json
{
  "statusCode": 400,
  "timestamp": "2025-08-21T12:46:15.345Z",
  "path": "/waInstance3100000001/readChat/9ece01c05bbe44768fb674840138bbe6af876fe49b69418fbf",
  "message": "Validation failed. Details: 'chatId' must be a string"
}
```

---

## 8. GetChatHistory — chat history (chat sidebar)

URL: <https://green-api.com/telegram/docs/api/journals/GetChatHistory/>

**Request**

```
POST {{apiUrl}}/waInstance{{idInstance}}/getChatHistory/{{apiTokenInstance}}
```

**Request body fields**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `chatId` | string | Yes | Personal or group chat id whose history is requested |
| `count` | integer | No | Number of messages to return. Default **100** |

**Pagination: there are no pagination parameters** in the published contract. The only knobs are `chatId` and `count`; there is no `offset`, `beforeMessageId`, `afterMessageId` or cursor field, and no documented maximum for `count` (only that it must be a number and must not exceed the max safe integer). Any cursor/older-page loading must therefore be considered **UNCONFIRMED**. Load a larger `count` up front.

```json
{
  "chatId": "10000000",
  "count": 10
}
```

**Response fields (array of message objects)**

| Field | Type | Description |
| --- | --- | --- |
| `type` | string | Message direction: `outgoing` / `incoming` |
| `idMessage` | string | Message identifier |
| `timestamp` | integer | Message acceptance time, UNIX seconds |
| `statusMessage` | string | Status of an outgoing message, only for `type = outgoing`: `delivered`, `read` |
| `sendByApi` | boolean | Sent via API; only for `type = outgoing` |
| `typeMessage` | string | Message type: `textMessage`, `imageMessage`, `videoMessage`, `documentMessage`, `audioMessage`, `pollMessage`, `locationMessage` |
| `chatId` | string | Chat id in which the message was received |
| `chatType` | string | Chat type: `user`, `group`, `supergroup`, `channel`, `bot` |
| `senderName` | string | Sender name; only for `type = incoming` |
| `senderType` | string | Sender type: `user`, `group`, `supergroup`, `channel`, `bot`; only for `type = incoming` |
| `senderContactName` | string | Sender name from the phone book; only for `type = incoming` |
| `isForwarded` | boolean | Forwarded-message flag |
| `forwardingScore` | integer | Number of times the message was forwarded |
| `textMessage` | string | Text, when `typeMessage = textMessage` |
| `downloadUrl` | string | File download link, for image/video/document/audio messages |
| `caption` | string | File caption, for image/video/document/audio messages |
| `fileName` | string | File name, for image/video/document/audio messages |
| `jpegThumbnail` | string | Base64 image preview, for image/video/document/audio messages |
| `mimeType` | string | Media type per the Media Types classification, for image/video/document/audio messages |
| `isAnimated` | boolean | Animated-file flag; present for image/video/document/audio messages |

**Verbatim response example** (note: the example additionally contains `deletedMessageId`, `editedMessageId`, `isEdited`, `isDeleted`, which are **not** in the field table — treat as present-but-undocumented):

```json
[
  {
    "type": "outgoing",
    "idMessage": "1769676078000",
    "timestamp": 1769676078,
    "typeMessage": "textMessage",
    "chatId": "10000000",
    "chatType": "user",
    "textMessage": "Я использую GREEN-API для отправки этого сообщения!",
    "statusMessage": "delivered",
    "sendByApi": true,
    "deletedMessageId": "",
    "editedMessageId": "",
    "isEdited": false,
    "isDeleted": false
  }
]
```

**Error table**

| HTTP | Error identifier | Description |
| --- | --- | --- |
| 400 | Bad Request / Validation failed | Validation error |
| 400 | `Validation failed. Details: 'count' must be a number` | Wrong `count` type, or the value exceeds the max safe integer |

---

## 9. GetWebhooksCount — incoming queue introspection

URL: <https://green-api.com/telegram/docs/api/queues/GetWebhooksCount/>

Stated behaviour: each notification is stored in the queue for 24 hours; drain speed depends on the GREEN-API webhook server response rate or on HTTP-API reads; the value is refreshed **once every 10 seconds**.

**Request**

```
GET {{apiUrl}}/waInstance{{idInstance}}/getWebhooksCount/{{apiTokenInstance}}
```

**Response field**

| Field | Type | Description |
| --- | --- | --- |
| `сount` | сount | Number of notifications in the incoming queue |

> Source caveat: the field name is printed as `сount` with a **Cyrillic "с"** in both the table type column and the JSON example. This looks like a docs typo; the correct ASCII spelling is almost certainly `count`, but the exact wire name is **UNCONFIRMED**. The page also says "array of objects", while the example shows a plain object.

**Verbatim response example**

```json
{
  "сount" : 0
}
```

---

## 10. Before you start — authorization prerequisites

URL: <https://green-api.com/telegram/docs/before-start/>

Steps the user must complete before any request:

1. Install the official Telegram mobile app and sign in (confirmation code goes to the Telegram app, or by SMS).
2. Register in the GREEN-API cabinet (email → country → accept terms → email confirmation code).
3. Create an instance in the cabinet (choose a tariff; pay if required). An instance reaches working state within up to 2 minutes. **One instance serves exactly one Telegram account**; several accounts need separate, separately billed instances.
4. Authorize the instance — one of two ways:
   - **QR (recommended)**: Telegram app → ☰ → Settings → Devices → Connect device → in the cabinet press "Получить QR" and scan.
   - **Authorization code**: `StartAuthorization` returns a code (delivered to the messenger service chat or by SMS) → send it with `SendAuthorizationCode`; if the account has a password, include it in `password` — or send it separately with `SendAuthorizationPassword`.
5. Get access parameters from the cabinet: `apiUrl`, `mediaUrl`, `idInstance`, `apiTokenInstance` (the token can be rotated in the cabinet or via support).
6. Configure incoming data reception (webhooks or HTTP API) — see §2.
7. Read the Telegram-version differences — see §11.

State `pendingPassword` in §1/§3 is exactly the "code sent, 2FA password still required" branch of step 4.

---

## 11. Important differences of the Telegram version

URL: <https://green-api.com/telegram/docs/important-differences/>

Architecture and interaction logic are the same as GREEN-API, with these Telegram-specific differences:

**a) Chat identifier** — chatId no longer contains the `@c.us` / `@g.us` prefixes. The `@c.us` prefix is kept **only** for sending messages by phone number, for backward compatibility. chatId is a positive number for individual chats and a negative number for group chats. Examples: personal `1234567890`, group `-12345678909876`. The value is delivered as a **string**, but the docs recommend converting it to a number for compact DB storage.

**b) Messenger type in the webhook** — distinguish the source messenger via the webhook property `instanceData.typeInstance`: `"telegram"` for Telegram, `"whatsapp"` for WhatsApp, `"v3"` for MAX. (Note: `wid` in examples still shows `79876543210@c.us`.)

**c) Unlimited Telegram clients** — Telegram allows an unlimited number of web/mobile clients on one phone number, so several instances can each hold a separate Telegram client on the same number (e.g. one for manager chats, one for a site chatbot).

**d) Partner methods** — unchanged and require no rework.

**e) Sticker messages** — the sticker object lives in `stickerMessageData`; `fileMessageData` is **not** used for Telegram stickers.

**f) Other** — some methods return Telegram-specific parameter sets; full description in this API documentation.

**Additional chatId facts** (from <https://green-api.com/telegram/docs/api/chat-id/>): chatId can also be sent as `@username` in a body (example `{"chatId": "@username", "message": "test"}`), but the docs recommend getting the numeric chatId via CheckAccount first. chatId sources: incoming webhook `senderData.sender` / `senderData.chatId`, `LastIncomingMessages.chatId`, `GetContacts.chatId`, `CheckAccount.chatId`.
