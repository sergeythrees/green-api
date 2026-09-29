# GREEN-API: Telegram — HTTP API contract (request format, sending, identifiers)

Engineering reference extracted verbatim from the Russian product docs at
`https://green-api.com/telegram/docs/`, plus supporting pages.

- Retrieved: 2026-09-29 (workspace revision `52c7702`)
- Scope: request format, `SendMessage`, chat id, message id, sending overview, common errors, rate limiter.
- Quoted strings are **verbatim** from the docs (Russian). English glosses added by the author are marked `[EN]`.
- Nothing in this file is inferred from the SDKs; only the doc pages listed per section.

## Contents

| # | Section | Source page |
|---|---------|-------------|
| 1 | Request format / endpoint template | https://green-api.com/telegram/docs/request-format/ |
| 2 | SendMessage | https://green-api.com/telegram/docs/api/sending/SendMessage/ |
| 3 | Chat identifier (`chatId`) | https://green-api.com/telegram/docs/api/chat-id/ |
| 4 | Message identifier (`idMessage`) | https://green-api.com/telegram/docs/api/message-id/ |
| 5 | Sending methods overview | https://green-api.com/telegram/docs/api/sending/ |
| 6 | Common / standard errors | https://green-api.com/telegram/docs/api/common-errors/ |
| 7 | Rate limiter | https://green-api.com/telegram/docs/api/ratelimiter/ |
| A1 | Before you start (access parameters) | https://green-api.com/telegram/docs/before-start/ |
| A2 | Send interval (queue) | https://green-api.com/telegram/docs/api/send-messages-delay/ |
| A3 | Important differences vs WhatsApp | https://green-api.com/telegram/docs/important-differences/ |
| A4 | Developer-tariff limit error (466) | https://green-api.com/telegram/docs/api/466-error-example-body/ |
| A5 | Comparison with WhatsApp / MAX | https://green-api.com/docs/request-format/ |

---

## 1. Request format

**Source:** <https://green-api.com/telegram/docs/request-format/>

> Для выполнения запроса к API мессенджера Telegram необходимо выполнить GET, POST или DELETE запрос на адрес

```text
{{apiUrl}}/waInstance{{idInstance}}/{{method}}/{{apiTokenInstance}}
```

URL is assembled from (verbatim list):

- Хоста API `apiUrl` / `mediaUrl` `[EN: API host apiUrl / mediaUrl]`
- Номера инстанса `idInstance` `[EN: instance number]`
- Метода `method` `[EN: method]`
- Ключа доступа `apiTokenInstance` `[EN: instance access token]`

Example request for `SendMessage` (verbatim):

```text
https://4100.api.green-api.com/waInstance4100000000/SendMessage/abcdef12345fghij67890klmno09876pqrstu54321vwxyz
```

Facts to encode:

| Fact | Value |
|------|-------|
| Path shape | `/waInstance{idInstance}/{method}/{apiTokenInstance}` — **same shape as the WhatsApp product** |
| `/telegram` path prefix | **Not present.** No product prefix in the path; the product is determined by the instance, not by the URL |
| HTTP methods | `GET`, `POST` or `DELETE` |
| Auth | Token is a path segment (`apiTokenInstance`), no auth header documented |
| Method-name casing in the generic template | Example uses `SendMessage` (capital `S`) |
| Method-name casing on the method page | The `SendMessage` page uses `sendMessage` (lower `s`) — see §2 |
| Host examples seen in docs | `https://4100.api.green-api.com` (Telegram request-format page); the WhatsApp/shared request-format page also shows `https://api.green-api.com` |

UNCONFIRMED: whether the method-name segment is case-sensitive (docs show both `SendMessage` and `sendMessage`); whether `https://api.green-api.com` (no instance-number subdomain) is valid for the Telegram product; whether `Content-Type` is mandatory for Telegram (the Telegram request-format page documents no headers at all — only the per-method code samples set `application/json`).

---

## 2. SendMessage

**Source:** <https://green-api.com/telegram/docs/api/sending/SendMessage/>

Description (verbatim): «Метод предназначен для отправки текстового сообщения в чат.» — `[EN: sends a text message to a chat]`
«Сообщение добавляется в очередь на отправку.» — the message is added to the send queue.
«Скорость отправки сообщений из очереди устанавливает интервал отправки сообщений.» — queue drain rate is set by the send interval (§A2).
«Для метода используются ограничения на частоту запросов в секунду.» — the method is subject to per-second request limits (§7).

### Endpoint

```text
POST {{apiUrl}}/waInstance{{idInstance}}/sendMessage/{{apiTokenInstance}}
```

Note the **lowercase** `sendMessage` in the method page (the generic template example uses `SendMessage`).

### Request parameters

| Параметр | Тип | Обязательный | Описание (verbatim) |
| --- | --- | --- | --- |
| `chatId` | **string** | Да | Идентификатор чата |
| `message` | **string** | Да | Текст сообщения. Поддерживаются символы emoji 😃. **Максимальная длина текстового сообщения составляет 4096 символов.** |
| `quotedMessageId` | **string** | Нет | Идентификатор цитируемого сообщения |
| `typingTime` | **integer** | Нет | Время показа уведомления набора сообщения в чате собеседника. Принимает значение в диапазоне от 1000 до 20000 миллисекунд (от 1 до 20 секунд) |
| `typingType` | **string** | Нет | Тип набора сообщения. Возможные значения (see below) |

`typingType` enum (verbatim values):

| Значение | Смысл |
| --- | --- |
| `text` | "печатает..." (по умолчанию) |
| `record_voice_note` | "записывает голосовое..." |
| `upload_voice_note` | "отправляет голосовое..." |
| `record_video_note` | "записывает видео-сообщение.." |
| `upload_video_note` | "отправляет видео-сообщение..." |
| `record_video` | "записывает видео..." |
| `upload_video` | "отправляет видео..." |
| `upload_photo` | "отправляет фото..." |
| `upload_document` | "отправляет файл..." |
| `choose_sticker` | "выбирает стикер..." |
| `choose_location` | "выбирает локацию..." |
| `choose_contact` | "выбирает контакт..." |

UNCONFIRMED: whether `typingTime` must accompany `typingType` (or vice versa); whether `typingTime` outside 1000–20000 is rejected (range is stated, error is not); whether `message` length is counted in Unicode code points or UTF-16 code units.

### Request body examples (verbatim, all four)

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
    "chatId": "79876543210@c.us",
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
    "quotedMessageId": "1769676078000"
}
```

### Response

| Поле | Тип | Описание |
| --- | --- | --- |
| `idMessage` | **string** | Идентификатор отправленного сообщения |

Response body (verbatim):

```json
{
    "idMessage": "1769676078000"
}
```

UNCONFIRMED: any other response field (docs document only `idMessage`); the JSON shape of 4xx error bodies (docs list only the error identifier strings); idempotency/duplicate-send semantics.

### Errors on this page

| Код HTTP | Идентификатор ошибки | Описание |
| --- | --- | --- |
| 400 | `Bad Request` <br>`Validation failed` | Ошибка валидации (see §6) |
| 400 | `Validation failed.` <br>`Details: 'message' length must be less than or equal to 4096 characters long` | Текст сообщения должен быть меньше или равен 4096 символам |

### Service-chat caveat (verbatim, boxed note)

> Отправка в сервисный чат (например, "Сервисные уведомления") будет приводить к ошибке. Система вернёт код 200 и id сообщения, но сообщение не отправится, по нему придет вебхук `outgoingMessageStatus` с `"status": "failed"`.

`[EN: sending into a service chat fails asynchronously: HTTP 200 + idMessage are returned, no message is delivered, and a webhook outgoingMessageStatus with "status": "failed" arrives.]`

### Emoji notes (verbatim summary)

Supported. Recommended encodings: hotkeys, copy-paste, or character codes; «Чтобы отправить смайлики рекомендуем использовать UTF-16», surrogate pair example: `\uD83D\uDE01`.

---

## 3. Chat identifier

**Source:** <https://green-api.com/telegram/docs/api/chat-id/>

Verbatim: «Идентификатор чата (`chatId`) — это уникальный маркер, необходимый для корректной отправки сообщений через GREEN-API. Он может принадлежать как человеку, так и группе. В случае группового чата идентификатор чата может содержать знак минус "-".»

Format rules (verbatim):

| Kind | Format | Example |
| --- | --- | --- |
| Личный чат (personal) | `"10000000"` (положительное число) — positive number, as a **string** | `"10000000"` |
| Группа (group) | `"-10000000000000"` (всегда начинается с минуса) — always starts with a minus | `"-10000000000000"` |

Cross-reference §A3 (important differences), which adds: identifiers **no longer contain** the `@c.us` / `@g.us` prefixes; `@c.us` survives only for backwards-compatible phone-number sending; `chatId` is a positive number for private chats and a negative number for group chats; values are represented as a string, but the docs recommend converting string→number for compact DB storage.

### Sending rules (verbatim intent)

- «Рекомендуется всегда отправлять сообщения по идентификатору чата `chatId`. Номер телефона, имя пользователя или канала в формате `@username` использовать лишь для получения `chatId` методом CheckAccount.»
  `[EN: always send by chatId; use phone number or @username only to resolve chatId via CheckAccount.]`
- If `chatId` is unknown → call `CheckAccount` first, then send with the returned `chatId`.
- Phone-number sending is allowed for backwards compatibility: `phoneNumber@c.us` may be used as `chatId` in send methods, but the docs recommend resolving `chatId` first.

### Where chatId comes from (all four documented sources)

1. Incoming webhook — field `chatId` inside `senderData` (docs text says the field `"sender"`, the example shows `chatId`):

```json
{
  "typeWebhook": "incomingMessageReceived",
  "instanceData": {
    "idInstance": 4100000000,
    "wid": "79876543210@c.us",
    "typeInstance": "telegram"
  },
  "timestamp": 1588091580,
  "idMessage": "1769676078000",
  "senderData": {
    "chatId": "10000000",
    "chatType": "user",
    "sender": "10000000",
    "chatName": "Василиса Премудрая",
    "senderName": "Василиса Премудрая",
    "senderType": "user",
    "senderContactName": "Василиса Премудрая",
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

2. `LastIncomingMessages` journal — field `chatId`:

```json
[
  {
    "type": "incoming",
    "idMessage": "1769676078000",
    "timestamp": 1769676078,
    "typeMessage": "textMessage",
    "chatId": "10000000",
    "chatType": "user",
    "textMessage": "Я использую GREEN-API для отправки этого сообщения!",
    "senderId": "10000000",
    "senderName": "Василиса Премудрая",
    "senderType": "user",
    "senderContactName": "Василиса Премудрая",
    "deletedMessageId": "",
    "editedMessageId": "",
    "isEdited": false,
    "isDeleted": false
  }
]
```

3. `GetContacts` — field `chatId`:

```json
{
  "chatId": "10000002",
  "name": "Царевна Лягушка",
  "contactName": "Царевна Лягушка",
  "type": "user"
}
```

4. `CheckAccount` — field `chatId`:

```json
{
  "exist": true,
  "chatId": "10000000",
  "username": "username",
  "phoneNumber": 79876543210,
  "fromCache": false
}
```

Facts to encode:

| Fact | Value |
|------|-------|
| Private chat id | positive integer **as string**, e.g. `"10000000"` |
| Group chat id | negative integer **as string**, e.g. `"-10000000000000"` |
| `@c.us` suffix | not part of the canonical id; accepted in send methods for backwards compatibility only (`79876543210@c.us`) |
| `@g.us` suffix | **not used** in the Telegram product |
| `@username` | accepted only as input to `CheckAccount` to resolve `chatId`; docs advise against sending to it |
| Size recommendation | store as number (docs recommend string→number conversion) |

UNCONFIRMED: the `chatId` format for **channels** (docs mention "имя пользователя или канала в формате `@username`" but give no channel `chatId` example and no channel-specific rule); the value set of `chatType` (`"user"` is the only value shown; the docs' generic validation message for WhatsApp-style ids mentions `'phone_number@c.us' or 'chatId'`); whether sending directly to `@username` actually works (only "recommended not to" is documented, no explicit error).

---

## 4. Message identifier

**Source:** <https://green-api.com/telegram/docs/api/message-id/>

Verbatim: «Идентификатор сообщения (`idMessage`) — это маркер, который GREEN-API присваивает каждому сообщению. Он присваивается входящим и исходящим сообщениям и позволяет найти конкретное сообщение в чате. Пример: `1769676078000`.»

> Важно: Идентификатор сообщения **НЕ требуется** формировать самостоятельно. Он формируется системой автоматически и возвращается различными методами GREEN-API.
> `[EN: do not generate idMessage client-side; the system assigns it.]`

### Uniqueness

| Scope | Unique? | Composite key recommended by docs |
| --- | --- | --- |
| Within a single chat | Yes («уникален в рамках одного чата») | — |
| Within an instance | No | `chatId` + `idMessage`, e.g. `-10000000000000_1769676078000` |
| Across the messenger | No («В рамках инстанса и в рамках мессенджера значения `idMessage` не уникальны») | — |
| Across instances | No | `idInstance` + `idMessage` + `chatId`, e.g. `4100123456_100000000_1769676078000` |

Session validity (verbatim): «После переавторизации инстанса синхронизация с мессенджером производится заново, и идентификаторы могут сформироваться иначе. Поэтому значения `idMessage` действительны только в рамках текущей сессии.»
`[EN: after instance re-authorization, ids may be regenerated; idMessage is only valid for the current session.]`

### Obtaining

Available from: send methods, journal methods, incoming webhooks — always field `idMessage`. Example (`SendMessage` response, verbatim):

```json
{
    "idMessage": "1769676078000"
}
```

### Uses (verbatim list)

- get a message from the journal — `GetMessage` by the pair `chatId` and `idMessage`;
- edit a message — `EditMessage`;
- delete a message — `DeleteMessage`;
- quote a message — the send methods (i.e. `quotedMessageId`).

Type: **string** (see §6: `'XXX' must be a string` lists `idMessage` among string fields).

UNCONFIRMED: format/semantics of the value (`1769676078000` looks like an epoch-millisecond timestamp; the docs never say so); whether `quotedMessageId` accepts ids from other chats; whether ids survive instance restart without re-authorization.

---

## 5. Sending methods overview

**Source:** <https://green-api.com/telegram/docs/api/sending/>

Verbatim: «В данном разделе представлены методы для отправки сообщений.» — the section lists the send methods; there are **no additional constraints or shared parameter tables** on this page.

Methods listed (nav labels, exact page slugs in parentheses):

| Метод | URL |
| --- | --- |
| Отправить текст (SendMessage) | `/telegram/docs/api/sending/SendMessage/` |
| Отправить видео, аудио, изображение, документ (SendFileByUpload) | `/telegram/docs/api/sending/SendFileByUpload/` |
| Отправить видео, аудио, изображение, документ по URL (SendFileByUrl) | `/telegram/docs/api/sending/SendFileByUrl/` |
| Выгрузить файл (UploadFile) | `/telegram/docs/api/sending/UploadFile/` |
| Отправить геолокацию (SendLocation) | `/telegram/docs/api/sending/SendLocation/` |
| Отправить контакт (SendContact) | `/telegram/docs/api/sending/SendContact/` |
| Отправить опрос (SendPoll) | `/telegram/docs/api/sending/SendPoll/` |
| Переслать сообщения (ForwardMessages) | `/telegram/docs/api/sending/ForwardMessages/` |

Note: `ForwardMessages` exists in the Telegram product but is **not present** in the rate-limiter table (§7) → its limit is UNCONFIRMED.

---

## 6. Common / standard errors

**Source:** <https://green-api.com/telegram/docs/api/common-errors/>

### HTTP errors (verbatim table)

| Код HTTP | Идентификатор ошибки | Описание |
| --- | --- | --- |
| 204 | `No Content` | Использован метод запроса `OPTIONS`, измените метод запроса на `GET` |
| 400 | `instance in starting process try later` | Инстанс находится в процессе запуска/перезапуска. Попробуйте повторить попытку спустя несколько секунд |
| 400 | `instance is starting or not authorized` | Инстанс не авторизован. Для авторизации инстанса перейдите в личный кабинет |
| 400 | `Instance account is expired. Renew your instance from personal area` | Срок действия инстанса истек. Продлите свой инстанс из личного кабинета |
| 400 | `bad request data` | Данные запроса не валидны. Исправьте ошибку в параметрах запроса и повторите попытку |
| 400 | `Instance is deleted` | Инстанс был удалён |
| 400 | `Bad Request` / `Validation failed` | Ошибка валидации, подробнее в таблице ниже |
| 400 | `Validation failed. Details: 'chatId' is required` | Обязательный параметр `chatId` идентификатор чата не указан |
| 400 | `Unexpected token _ in JSON at position ХХ` | Ошибка в структуре JSON |
| 401 | `Unauthorized` | Проблема с авторизацией, проверьте корректность указания `apiTokenInstance`, `partnerToken` |
| 403 | `Forbidden` | Проблема с аутентификацией, проверьте корректность указания `idInstance` и адрес запроса |
| 404 | `Not Found` | Некорректный метод запроса |
| 499 | `Client Closed Request` | Пользователь закрыл соединение, пока сервер обрабатывал запрос. Требуется увеличить время ожидания ответа от сервера и повторить запрос с задержкой. Если ошибка повториться, то информировать оператора и дать возможность повторить отправку |
| 500 | `File from url exceeded max upload size. Size: XXXXmb Limit: 100mb Url:` | Попытка отправки файла размером более 100 МБайт |
| 500 | `request entity too large` | Превышение допустимой длины json (>100кб) |
| 502 | `Bad Gateway` | Сервер не способен получить ответ от целевого сервера. Требуется 3 раза повторить запрос с задержкой. Если ошибка повторится, то информировать оператора и дать возможность повторить отправку |

Retry guidance worth encoding (from the descriptions above): 400 `instance in starting process try later` → retry after a few seconds; 499 → increase timeout, retry with delay, then surface to the operator; 502 → retry up to 3 times with delay, then surface to the operator.

Size limits: JSON body `>100кб` (100 KB) → 500 `request entity too large`; file from URL `>100mb` → 500 upload-size error.

### Validation errors (`400: Validation failed`) (verbatim table)

| Идентификатор ошибки | Описание |
| --- | --- |
| `'chatId' must be one of the next formats: 'phone_number@c.us' or 'chatId'` | Неверный формат поля `chatId`, поле указывается в формате `phone_number@c.us` либо `chatId` |
| `'wrongFieldName' is not allowed` | Недопустимое поле в теле запроса |
| `'{{field}}' is not allowed` | Недопустимое поле в теле запроса |
| `'{{field}}' is required` | Отсутствует обязательное поле в теле запроса |
| `'{{field}}' is not allowed to be empty` | Обязательное поле не может быть пустым |
| `'XXX' must be a string` | Поля данного типа: `message`, `idMessage`, `chatId`, `participantChatId`, `options[X].optionName`, `urlFile` |
| `'XXX' must be a boolean` | Поля данного типа: `multipleAnswers` |
| `'XXX' must be an array` | Поля данного типа: `chatIds`, `options`, `messages` |

UNCONFIRMED: the JSON envelope of error responses (docs show only identifier strings, no body example); a `429` entry in the standard-errors table (rate limiting is described only on §7, and no `Retry-After` / rate-limit headers are documented); the HTTP status of the Developer-tariff limit error described in §A4.

---

## 7. Rate limiter

**Source:** <https://green-api.com/telegram/docs/api/ratelimiter/>

Verbatim: «Система предназначена для предотвращения неверного использования API. Запросы выполненные с частотой выше, чем указано в таблице будут отклонены с ошибкой **429**. Значения применяются к **каждому инстансу**.»

Worked example (verbatim): with 10 instances each doing 50 `SendMessage` requests, 500 requests total are allowed; if one instance issues 51 `SendMessage` in 1 second, the 51st is rejected with `429`.

### Allowed requests per second (verbatim table, all groups)

| Метод | Число запросов в секунду |
| --- | --- |
| **Аккаунт** | |
| `QR` | 3 |
| `SendAuthorizationPassword` | 1 |
| `StartAuthorization` | 1 |
| `SendAuthorizationCode` | 1 |
| `Logout` | 1 |
| `GetStateInstance` | 1 |
| `Reboot` | 1 |
| `GetSettings` | 1 |
| `SetSettings` | 1 |
| `GetAccountSettings` | 1 |
| `SetProfilePicture` | 0.1 |
| **Отправка** | |
| `SendMessage` | **50** |
| `SendFileByUrl` | 50 |
| `SendFileByUpload` | 50 |
| `SendLocation` | 50 |
| `SendContact` | 50 |
| `SendPoll` | 50 |
| **Получение** | |
| `ReceiveNotification` | 100 |
| `DeleteNotification` | 100 |
| `DownloadFile` | 5 |
| **Журналы** | |
| `GetChatHistory` | 1 |
| `GetMessage` | 1 |
| `LastIncomingMessages` | 1 |
| `LastOutgoingMessages` | 1 |
| **Очереди** | |
| `GetMessagesCount` | 1 |
| `ShowMessagesQueue` | 1 |
| `ClearMessagesQueue` | 1 |
| `GetWebhooksCount` | 1 |
| `ClearWebhooksQueue` | 1 |
| **Группы** | |
| `CreateGroup` | 1 |
| `UpdateGroupName` | 1 |
| `GetGroupData` | 1 |
| `UpdateGroupSettings` | 1 |
| `AddGroupParticipant` | 1 |
| `RemoveGroupParticipant` | 1 |
| `SetGroupAdmin` | 1 |
| `RemoveAdmin` | 1 |
| `LeaveGroup` | 1 |
| `SetGroupPicture` | 1 |
| **Отметка прочтения** | |
| `ReadChat` | 10 |
| **Сервисные методы** | |
| `CheckAccount` | 10 |
| `GetChats` | 1 |
| `GetContacts` | 1 |
| `GetAvatar` | 10 |
| `EditMessage` | 50 |
| `DeleteMessage` | 1 |
| `ArchiveChat` | 10 |
| `UnarchiveChat` | 10 |

Limits are per instance, per method. `429` is the only documented rate-limit signal.

UNCONFIRMED: response body/headers for `429`; burst/queue semantics; shared vs separate buckets; the limit for methods absent from the table (e.g. `ForwardMessages`, `UploadFile`, `SendTyping`, `AddContact`, `EditContact`, `DeleteContact`, `GetContactInfo`).

---

## A1. Before you start (access parameters)

**Source:** <https://green-api.com/telegram/docs/before-start/>

Access parameters published in the console (verbatim list):

- `apiUrl` - ссылка на хост API
- `mediaUrl` - ссылка на хост API для отправки файлов
- `idInstance` - уникальный номер инстанса
- `apiTokenInstance` - ключ доступа инстанса

Other constraints worth encoding:

- One instance serves exactly one Telegram account (one phone number); separate instances per account, each billed separately.
- Instance may take up to 2 minutes to become operational after creation.
- Authorization by QR (recommended) or by `StartAuthorization` → `SendAuthorizationCode` (+ optional `password` via `SendAuthorizationPassword`).
- «Версия Telegram разработана на базе текущей версии GREEN-API. Архитектура и логика взаимодействия с API осталась прежней» — same architecture as the base (WhatsApp) product.

---

## A2. Send interval (queue)

**Source:** <https://green-api.com/telegram/docs/api/send-messages-delay/>

- All send methods put messages into a **FIFO queue**; messages are sent strictly in arrival order.
- The interval between queue sends is configured via `SetSettings`, parameter `delaySendMessagesMilliseconds`.
- Interval is measured from the moment the previous message was sent; if more time has already elapsed, the message is sent without delay.
- **Min interval: 500 ms. Max interval: 10 minutes (600000 ms). Recommended: ≤ 5 minutes (300000 ms).**
- Current value read via `GetSettings`, parameter `delaySendMessagesMilliseconds`.
- Setter endpoint (verbatim): `POST {{apiUrl}}/waInstance{{idInstance}}/setSettings/{{apiTokenInstance}}`; body must contain only that parameter:

```json
{
    "delaySendMessagesMilliseconds": 5000
}
```

---

## A3. Important differences of the Telegram version (vs WhatsApp)

**Source:** <https://green-api.com/telegram/docs/important-differences/>

| Area | Telegram product |
| --- | --- |
| `chatId` | No `@c.us` / `@g.us` prefixes. Positive number = private chat (e.g. `1234567890`), negative number = group chat (e.g. `-12345678909876`). `@c.us` kept **only** for backwards-compatible phone-number sending. Value is a string, but the docs recommend converting it to a number for compact DB storage. |
| Messenger type in webhook | `instanceData.typeInstance`: Telegram = `"telegram"`, WhatsApp = `"whatsapp"`, MAX = `"v3"` |
| Multiple clients | Telegram allows unlimited web/mobile clients per phone number, so several instances can be linked to the same number |
| Partner methods | Unchanged, no rework required |
| Sticker messages | Sticker object lives in `stickerMessageData`; `fileMessageData` is not used for stickers in Telegram |
| Errors (see §6) | Some methods return Telegram-specific parameter sets |
| Auth note | Instance initialization can take up to 2 minutes (from §A1) |

UNCONFIRMED: what exactly is not supported in the Telegram product (the page says "ряд отличий" / "Некоторые методы" without an exhaustive list); whether WhatsApp-only features (e.g. `@g.us` group ids, WhatsApp-specific webhook types) are rejected or silently ignored.

---

## A4. Developer-tariff limit error (466)

**Source:** <https://green-api.com/telegram/docs/api/466-error-example-body/>

Warning quoted verbatim: the same recipient addressed in different id formats (phone number `phoneNumber@c.us` vs `chatId`) counts as **different chats** in the chat quota — quota checks are not synchronized between formats.

`466` body fields (verbatim tables):

| Параметр | Тип | Описание |
| --- | --- | --- |
| `invokeStatus` | object | Объект данных о статусе лимита |
| `correspondentsStatus` | object | Объект данных о статусе лимита чатов |

`invokeStatus` fields: `method` (string), `used` (string), `total` (string), `status` (string), `description` (string, present when `status` = `QUOTE_EXCEEDED`).

`correspondentsStatus` fields: `method` (string, default `correspondents`), `used` (string), `total` (string, default `3`), `status` (string), `description` (string, when status = `CORRESPONDENTS_QUOTA_EXCEEDED`).

Example error body (verbatim):

```json
{
    "invokeStatus": {
        "method": "checkAccount",
        "used": 100,
        "total": 100,
        "status": "QUOTE_EXCEEDED",
        "description": "Monthly quota has been exceeded. Please go to your console and change the tariff to business https://console.green-api.com"
    }
}
```

Example quota webhook (verbatim):

```json
{
    "typeWebhook": "quotaExceeded",
    "instanceData": {
        "idInstance": 4100000000,
        "wid": "79876543210@c.us",
        "typeInstance": "telegram"
    },
    "quotaData": {
        "method": "correspondents",
        "used": 3,
        "total": 3,
        "status": "CORRESPONDENTS_QUOTA_EXCEEDED",
        "description": "Monthly quota has been exceeded. You can only send or receive messages from following chats: 10000000, 10000001, 10000002. Please go to the console and change the tariff to business https://console.green-api.com"
    }
}
```

Note: status literals are spelled `QUOTE_EXCEEDED` / `CORRESPONDENTS_QUOTA_EXCEEDED` in the docs (verbatim; `QUOTE` not `QUOTA` in the first one).

---

## A5. Comparison with the WhatsApp / MAX variants

Source for WhatsApp/shared shape: <https://green-api.com/docs/request-format/> (fetched).
Telegram source: <https://green-api.com/telegram/docs/request-format/>.

| Aspect | WhatsApp (base) | Telegram | MAX |
| --- | --- | --- | --- |
| Endpoint template | `{{apiUrl}}/waInstance{{idInstance}}/{{method}}/{{apiTokenInstance}}` | **Identical** | UNCONFIRMED |
| Instance path segment | `/waInstance{id}` | `/waInstance{id}` (the `wa` prefix is legacy, kept for the Telegram product) | UNCONFIRMED |
| `/telegram` path prefix | — | **None** | — |
| Host examples | `https://api.green-api.com`, `https://4100.api.green-api.com` | `https://4100.api.green-api.com` | UNCONFIRMED |
| Product discrimination | — | `instanceData.typeInstance == "telegram"` | `"v3"` (per Telegram docs) |
| Headers section | Documented on the base page: `Content-Type: application/json` | Not documented on the Telegram request-format page; only per-method samples set it | UNCONFIRMED |
| chatId | WhatsApp-style ids with `@c.us` / `@g.us` | no `@c.us` / `@g.us`; signed numeric string; `@c.us` accepted for phone-number back-compat | UNCONFIRMED |

Attempts to find the MAX docs at `https://green-api.com/max/docs/` and `https://green-api.com/max/docs/request-format/` returned HTTP 404, so the MAX endpoint shape is **UNCONFIRMED** from these pages. Nothing on the Telegram pages indicates a separate Telegram host or a `/telegram` URL prefix; Telegram vs WhatsApp is distinguished by the instance type.

---

## Cross-cutting UNCONFIRMED list

1. Method-name casing (`SendMessage` vs `sendMessage`) — case sensitivity unproven.
2. Error response **bodies** and content type (only identifier strings are documented).
3. `429` body/headers, and rate limits for methods missing from the table (`ForwardMessages`, `UploadFile`, `SendTyping`, contacts, `GetContactInfo`).
4. `Content-Type` header requirement for Telegram (inferred only from code samples).
5. Channel (`@username` / channel) `chatId` format; `chatType` value set beyond `"user"`.
6. Whether `message` length is measured in characters/code points/UTF-16 units; behaviour at exactly 4096.
7. Whether `typingTime` and `typingType` are coupled; defaults beyond `typingType = "text"`.
8. `quotedMessageId` scope (same-chat only?) and error when the quoted message is unknown/deleted.
9. HTTP status for the Developer-tariff `466` limit (status code is implied by the page title, body examples only).
10. Any `idInstance`/`apiTokenInstance` validation rules (max length, charset) and whether `apiTokenInstance` can be sent as a header.
