# GREEN-API: Telegram — receiving contract (HTTP long-poll + notification formats)

Engineering reference extracted **verbatim** from the Russian product docs at
`https://green-api.com/telegram/docs/`.

- Retrieved: 2026-09-29 (same workspace revision as the sibling `contracts-*.md` files).
- Scope: receiving notifications over HTTP API (`ReceiveNotification` / `DeleteNotification`),
  notification formats (incoming, outgoing, outgoing-API, status, service), `typeWebhook` values.
- Quoted strings are **verbatim** from the docs (Russian). English glosses added by the author are
  marked `[EN]`. JSON examples are copied with the docs' own indentation.
- Everything not explicitly stated in the docs is flagged `UNCONFIRMED` in place and collected in the
  final section.

## Contents

| # | Section | Source page |
|---|---------|-------------|
| 1 | Concept — receiving via HTTP API | <https://green-api.com/telegram/docs/api/receiving/technology-http-api/> |
| 2 | `ReceiveNotification` | <https://green-api.com/telegram/docs/api/receiving/technology-http-api/ReceiveNotification/> |
| 3 | `DeleteNotification` | <https://green-api.com/telegram/docs/api/receiving/technology-http-api/DeleteNotification/> |
| 4 | Notification format — overview | <https://green-api.com/telegram/docs/api/receiving/notifications-format/> |
| 5 | Incoming messages (`incomingMessageReceived`) | <https://green-api.com/telegram/docs/api/receiving/notifications-format/incoming-message/Webhook-IncomingMessageReceived/> |
| 6 | Incoming text message | <https://green-api.com/telegram/docs/api/receiving/notifications-format/incoming-message/TextMessage/> |
| 7 | Outgoing messages (`outgoingMessageReceived`) | <https://green-api.com/telegram/docs/api/receiving/notifications-format/outgoing-message/Webhook-OutgoingMessageReceived/> |
| 8 | Outgoing API message (`outgoingAPIMessageReceived`) | <https://green-api.com/telegram/docs/api/receiving/notifications-format/outgoing-message/OutgoingApiMessage/> |
| 9 | Outgoing text message | <https://green-api.com/telegram/docs/api/receiving/notifications-format/outgoing-message/TextMessage/> |
| 10 | Outgoing message status (`outgoingMessageStatus`) | <https://green-api.com/telegram/docs/api/receiving/notifications-format/statuses/OutgoingMessageStatus/> |
| 11 | `typeWebhook` — full value list | <https://green-api.com/telegram/docs/api/receiving/notifications-format/type-webhook/> |
| 12 | Instance state changed (`stateInstanceChanged`) | <https://green-api.com/telegram/docs/api/receiving/notifications-format/service/StateInstanceChanged/> |
| A1 | Quota exceeded (`quotaExceeded`) — extra, corroborating | <https://green-api.com/telegram/docs/api/receiving/notifications-format/service/QuotaExceeded/> |
| A2 | Send-side linkage for matching (`SendMessage`, `GetMessage`, `GetChatHistory`) — extra | see section |
| A3 | Rate limits for the polling methods — extra | <https://green-api.com/telegram/docs/api/ratelimiter/> |
| A4 | Client-facing field-path index | — |
| — | Cross-cutting UNCONFIRMED list | — |

---

## 1. Concept — receiving notifications through HTTP API

**Source:** <https://green-api.com/telegram/docs/api/receiving/technology-http-api/>

Verbatim:

> Получать входящие уведомления (сообщения, статусы) можно через HTTP API запросы по аналогии, как реализованы остальные методы API мессенджера Telegram.
> `[EN: incoming notifications (messages, statuses) are fetched with HTTP API requests, like the other API methods.]`

> При этом гарантируется хронологический порядок следования уведомлений в той последовательности, в которой они были получены FIFO.
> `[EN: chronological order / FIFO of arrival is guaranteed.]`

> Все входящие уведомления сохраняются в очереди и ожидают своего получения в течение 24 часов.
> `[EN: all notifications are queued and await retrieval for 24 hours.]`

> Для получения входящих уведомлений требуется выполнить последовательно вызов двух методов:
> - Метод ReceiveNotification выполняет получение входящего уведомления.
> - Метод DeleteNotification подтверждает успешное получение и обработку уведомления.
> `[EN: two-step protocol — Receive then Delete; Delete is the acknowledgement.]`

Instance setup — verbatim:

> Для настройки получения входящих уведомлений по технологии HTTP API необходимо оставить пустым параметр webhookUrl.
> `[EN: `webhookUrl` MUST be empty to poll over HTTP API.]`

SetSettings request body (verbatim example; note this page's example does **not** include
`outgoingMessageWebhook` / `outgoingAPIMessageWebhook`):

```json
{
    "webhookUrl": "",
    "outgoingWebhook": "yes",
    "stateWebhook": "yes",
    "incomingWebhook": "yes"
}
```

Facts to encode:

| Fact | Value |
|---|---|
| Retrieval model | Client-driven long-poll: `GET receiveNotification` then `DELETE deleteNotification` |
| Ordering | FIFO, chronological — no re-ordering needed |
| Retention | 24 hours in the queue |
| Ack | The notification is **not** removed by reading it; it must be deleted via `DeleteNotification`, otherwise it is returned again |
| Prerequisite | `webhookUrl` empty, and the relevant `SetSettings` flags enabled (`incomingWebhook`, `outgoingMessageWebhook`, `outgoingAPIMessageWebhook`, `outgoingWebhook`, `stateWebhook`) |
| Delivery guarantee | Docs describe the queue and FIFO; no at-least-once / exactly-once wording, and no duplicate-delivery statement → `UNCONFIRMED` |

---

## 2. `ReceiveNotification`

**Source:** <https://green-api.com/telegram/docs/api/receiving/technology-http-api/ReceiveNotification/>

### 2.1 Semantics (verbatim)

> Метод предназначен для получения одного входящего уведомления из очереди уведомлений.
> `[EN: retrieves ONE incoming notification from the queue.]`

> Метод ReceiveNotification ожидает получения уведомления в течение 5 секунд.
> - Если в течение 5 секунд в очереди не появляется уведомление, то вызов метода завершается с пустым ответом.
> - Если в течение 5 секунд в очереди появляется уведомление, то вызов метода завершается, и метод возвращает полученное уведомление.
> - Если после получения уведомления не было вызова DeleteNotification, то следующий вызов ReceiveNotification будет показывать старое уведомление до тех пор, пока оно не будет удалено из очереди.
> `[EN: waits 5 s; on timeout the call finishes with an EMPTY response; on a notification it returns it; without DeleteNotification the same notification is returned again.]`

> Для метода используются ограничения на частоту запросов в секунду.
> `[EN: per-second rate limits apply — see A3 (100 req/s per instance).]`

**Contradiction to be aware of:** the prose says the wait is 5 seconds, while the parameter table says
`receiveTimeout` accepts 5–60 with default 5. The prose appears copied from the WhatsApp product.
The client must treat the wait as configurable and tolerate both behaviours.

### 2.2 Request

Method and URL (verbatim):

```text
GET {{apiUrl}}/waInstance{{idInstance}}/receiveNotification/{{apiTokenInstance}}?receiveTimeout={{seconds}}
```

URL query parameter (verbatim table):

| Параметр | Тип | Обязательный | Описание |
|---|---|---|---|
| `receiveTimeout` | integer | нет `[EN: no/optional]` | Таймаут ожидания уведомления, принимает значение от 5 до 60 секунд (по умолчанию 5 секунд) `[EN: wait timeout, 5..60 seconds, default 5]` |

### 2.3 Response

Verbatim field table:

| Поле | Тип | Описание |
|---|---|---|
| `receiptId` | integer | Идентификатор доставки для удаления входящего уведомления методом DeleteNotification `[EN: delivery id used by DeleteNotification]` |
| `body` | object | Входящее уведомление согласно Формату входящих уведомлений `[EN: the notification itself, per the notification format]` |

Verbatim response body example (note: this example's `senderData` has **no** `chatType`/`senderType`,
and `idMessage` is 21 characters here):

```json
{
  "receiptId": 1234567,
  "body": {
    "typeWebhook": "incomingMessageReceived",
    "instanceData": {
      "idInstance": 410000001,
      "wid": "79876543210@c.us",
      "typeInstance": "telegram"
    },
    "timestamp": 1763115112,
    "idMessage": "126543123451133331119",
    "senderData": {
      "chatId": "10000000",
      "chatName": "Василиса",
      "sender": "10000000",
      "senderName": "Василиса Премудрая",
      "senderContactName": "Василиса Премудрая",
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

### 2.4 Errors (verbatim)

| Код HTTP | Идентификатор ошибки | Описание |
|---|---|---|
| 400 | `Parameter idInstance not an integer` | Параметр idInstance не задан или содержит нецифровые символы |
| 400 | `Parameter apiTokenInstance not define` | Параметр apiTokenInstance не задан |
| 400 | `Message cannot be received because custom webhook url is set. Go to cabinet, clear webhook url for instance: ХХХХХХХХХХ and wait for about 1 minute for another attempt` | Поле webhookUrl не пустое. Очистите URL-адрес для инстанса и подождите около 1 минуты перед тем, как начать запрашивать уведомления. |

Facts to encode:

| Fact | Value |
|---|---|
| HTTP method | `GET` |
| Success shape | `{ "receiptId": number, "body": <notification> }` — the notification is **nested under `body`** |
| Timeout result | "пустой ответ" — docs never show it (empty body vs `{}` vs `null` all possible) → `UNCONFIRMED` |
| Wait upper bound | 60 s per the parameter table (`receiveTimeout=60`); prose claims 5 s |
| Ack requirement | Reading does not delete; without `DELETE deleteNotification` the same `receiptId` + `body` comes back |
| Rate limit | `ReceiveNotification` = 100 req/s per instance (A3) |

---

## 3. `DeleteNotification`

**Source:** <https://green-api.com/telegram/docs/api/receiving/technology-http-api/DeleteNotification/>

Verbatim:

> Метод предназначен для удаления входящего уведомления из очереди уведомлений. Чтобы указать, какое уведомление следует удалить, используйте параметр receiptId.
> `[EN: removes an incoming notification from the queue; which one is selected by receiptId.]`

> Для метода используются ограничения на частоту запросов в секунду.

> Обратите внимание, что метод использует запрос вида DELETE
> `[EN: the method uses the HTTP DELETE verb.]`

### 3.1 Request

```text
DELETE {{apiUrl}}/waInstance{{idInstance}}/deleteNotification/{{apiTokenInstance}}/{{receiptId}}
```

Request parameter (verbatim):

| Параметр | Тип | Обязательный | Описание |
|---|---|---|---|
| `receiptId` | integer | Да `[EN: yes]` | Идентификатор доставки для удаления входящего уведомления, полученный методом ReceiveNotification |

`receiptId` is a **path segment**, not a query parameter. Verbatim cURL sample:

```text
curl --location --request DELETE '{{apiUrl}}/waInstance{{idInstance}}/deleteNotification/{{apiTokenInstance}}/1234567'
```

### 3.2 Response

Verbatim field table:

| Поле | Тип | Описание |
|---|---|---|
| `result` | boolean | Результат удаления: `true` — уведомление успешно удалено из очереди; `false` — уведомление не удалено (уведомление было удалено ранее или `receiptId` не соответствует ранее полученному значением методом ReceiveNotification) `[EN: false means already deleted or unknown/stale receiptId]` |
| `reason` | string | Причина неудачного выполнения метода `[EN: failure reason]` |

Verbatim response example:

```json
{
    "result": true,
    "reason": ""
}
```

### 3.3 Errors (verbatim)

| Код HTTP | Идентификатор ошибки | Описание |
|---|---|---|
| 400 | `Parameter idInstance not an integer` | Параметр idInstance не задан или содержит нецифровые символы |
| 400 | `Parameter receiptId must be a Number!` | Указанный receiptId не является числом |
| 400 | `Parameter apiTokenInstance not define` | Параметр apiTokenInstance не задан |
| 400 | `Message cannot be received because custom webhook url is set. Go to cabinet, clear webhook url for instance: ХХХХХХХХХХ and wait for about 1 minute for another attempt` | Поле webhookUrl не пустое |
| 500 | `Internal Server Error Cannot read properties of undefined (reading 'findUnAckedMessage')` | Не найдено сообщение, которое пытались удалить `[EN: notification not found]` |

Facts to encode:

| Fact | Value |
|---|---|
| HTTP method | `DELETE` (the docs explicitly stress the verb) |
| URL | `/waInstance{id}/deleteNotification/{token}/{receiptId}` |
| Ack semantics | Call it after **successful processing**; `result: true` = removed, `result: false` = already gone / stale id — both are non-fatal for the poll loop |
| Failure | A stale/unknown id can also produce **HTTP 500** (not only `result: false`) → treat 500 on delete as "nothing to ack", do not abort the loop |
| Rate limit | `DeleteNotification` = 100 req/s per instance (A3) |

---

## 4. Notification format — overview

**Source:** <https://green-api.com/telegram/docs/api/receiving/notifications-format/>

Verbatim: «В данном разделе представлено описание формата входящих уведомлений: сообщений, файлов, статусов отправленных сообщений, статуса инстанса и устройства (телефона).»

Taxonomy as published (nav labels, verbatim):

| Group | Members |
|---|---|
| Входящее сообщение `[EN: incoming]` | текстовое; текстовое с URL; изображение; видео; документ; аудио; геолокация; контакт; опрос; реакция; стикер; отредактированное; удаление |
| Отправленное сообщение `[EN: outgoing]` | с телефона; с API; текстовое; изображение; видео; документ; аудио; геолокация; контакт; опрос; реакция; стикер; отредактированное; удаление |
| Статусы `[EN: statuses]` | статус отправленного сообщения |
| Сервисные уведомления `[EN: service]` | статус инстанса; превышены ограничения на тарифе Telegram Developer |
| Объекты `[EN: objects]` | типы входящих уведомлений |

Note: the receiving index page (<https://green-api.com/telegram/docs/api/receiving/>) lists «входящий
звонок» `[EN: incoming call]` among possible events, but the notification-type list (§11) has **no**
call type → `UNCONFIRMED` / doc inconsistency.

---

## 5. Incoming messages — `incomingMessageReceived`

**Source:** <https://green-api.com/telegram/docs/api/receiving/notifications-format/incoming-message/Webhook-IncomingMessageReceived/>

Verbatim: «В данном разделе приводится описание общего формата входящих уведомлений с типом
incomingMessageReceived.»

### 5.1 Envelope fields (verbatim table)

| Параметр | Тип | Описание |
|---|---|---|
| `typeWebhook` | string | Тип входящего уведомления. Для уведомления данного типа поле принимает значение `incomingMessageReceived` |
| `instanceData` | object | Данные об инстансе |
| `timestamp` | integer | Время наступления события в UNIX-формате `[EN: event time, UNIX format]` |
| `idMessage` | string | Идентификатор входящего сообщения |
| `senderData` | object | Данные об отправителе сообщения или файла |
| `messageData` | object | Данные о принятом сообщении или файле |

### 5.2 `instanceData` (verbatim)

| Параметр | Тип | Описание |
|---|---|---|
| `idInstance` | integer | Идентификатор инстанса. Значение типа uint64, 10 разрядов |
| `wid` | string | Идентификатор аккаунта |
| `typeInstance` | string | Тип мессенджера: `telegram` для Telegram, `whatsapp` для WhatsApp, `v3` для MAX |

### 5.3 `senderData` (verbatim)

| Параметр | Тип | Описание |
|---|---|---|
| `chatId` | string | Идентификатор чата, в котором получено сообщение или файл |
| `chatType` | string | Тип чата. Возможные значения: `"user"`, `"group"`, `"supergroup"`, `"channel"`, `"bot"` |
| `sender` | string | Идентификатор отправителя сообщения или файла |
| `chatName` | string | Имя чата |
| `senderName` | string | Имя отправителя |
| `senderType` | string | Тип отправителя. Возможные значения: `"user"`, `"group"`, `"supergroup"`, `"channel"`, `"bot"` |
| `senderContactName` | string | Имя отправителя из списка контактов телефонной книги |
| `senderPhoneNumber` | integer | Номер телефона отправителя. Если номер телефона скрыт, или контакт является группой, принимает значение `0` |

### 5.4 `messageData`

Verbatim: «Объект messageData имеет разные поля в зависимости от типа входящего сообщения» — the
discriminator is `messageData.typeMessage`; the concrete sub-object depends on it (see §6 and the
sibling pages for images/video/document/audio/reaction/location/contact/poll/sticker).

### 5.5 Verbatim example — private chat

```json
{
  "typeWebhook": "incomingMessageReceived",
  "instanceData": {
    "idInstance": 4100000000,
    "wid": "79876543210@c.us",
    "typeInstance": "telegram"
  },
  "timestamp": 1763115112,
  "idMessage": "1763115112345",
  "senderData": {
    "chatId": "10000000",
    "chatType": "user",
    "sender": "10000000",
    "chatName": "Василиса Премудрая",
    "senderName": "Василиса Премудрая",
    "senderType": "user",
    "senderContactName": "Василиса Премудрая",
    "senderPhoneNumber": 79998887766
  },
  "messageData": {
    "typeMessage": "textMessage",
    "textMessageData": {
      "textMessage": "Я использую GREEN-API для отправки этого сообщения!"
    }
  }
}
```

### 5.6 Verbatim example — group chat

```json
{
  "typeWebhook": "incomingMessageReceived",
  "instanceData": {
    "idInstance": 4100000000,
    "wid": "79876543210@c.us",
    "typeInstance": "telegram"
  },
  "timestamp": 1763115112,
  "idMessage": "1763115112345",
  "senderData": {
    "chatId": "-10000000000000",
    "chatType": "channel",
    "sender": "10000000",
    "chatName": "Тридесятое царство",
    "senderName": "Василиса",
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

Notes: group `chatId` is a negative string (`-10000000000000`); in the group example `chatType` is
`"channel"`; `senderPhoneNumber` is `0` when hidden/inapplicable; `senderContactName` can be `""`.
`chatType` and `senderType` are **absent** in the §2.3 `ReceiveNotification` example → treat both as
optional in the parser.

---

## 6. Incoming text message

**Source:** <https://green-api.com/telegram/docs/api/receiving/notifications-format/incoming-message/TextMessage/>

Verbatim recognition conditions:

> Для получения входящих уведомлений данного вида требуется выполнение двух условий:
> - `typeWebhook = incomingMessageReceived`
> - `messageData.typeMessage = textMessage`

Enable via: cabinet toggle «Получать уведомления о входящих сообщениях и файлах» or `SetSettings`
`incomingWebhook`.

### 6.1 `messageData` fields (verbatim)

| Параметр | Тип | Описание |
|---|---|---|
| `typeMessage` | string | Тип полученного сообщения. Для сообщений данного типа поле принимает значение `textMessage` |
| `textMessageData` | object | Объект данных о текстовом сообщении |
| `quotedMessage` | object | Объект данных о цитируемом сообщении. Присутствует, только если само сообщение является цитатой `[EN: present only if this message is a quote]` |

### 6.2 `textMessageData` fields (verbatim)

| Параметр | Тип | Описание |
|---|---|---|
| `textMessage` | string | Текстовое сообщение `[EN: the message text]` |
| `isForwarded` | boolean | Является ли сообщение пересланным, принимает значения `true`/`false` |
| `forwardingScore` | integer | Количество пересылок сообщения |

### 6.3 `quotedMessage` fields (verbatim)

| Параметр | Тип | Описание |
|---|---|---|
| `stanzaId` | string | id цитируемого сообщения |
| `participant` | string | id отправителя цитируемого сообщения |

### 6.4 Verbatim example — private chat

```json
{
  "typeWebhook": "incomingMessageReceived",
  "instanceData": {
    "idInstance": 4100000000,
    "wid": "79876543210@c.us",
    "typeInstance": "telegram"
  },
  "timestamp": 1763115112,
  "idMessage": "1763115112345",
  "senderData": {
    "chatId": "10000000",
    "chatType": "user",
    "sender": "10000000",
    "chatName": "Василиса Премудрая",
    "senderName": "Василиса Премудрая",
    "senderType": "user",
    "senderContactName": "Василиса Премудрая",
    "senderPhoneNumber": 79998887766
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

### 6.5 Verbatim example — group chat

```json
{
  "typeWebhook": "incomingMessageReceived",
  "instanceData": {
    "idInstance": 4100000000,
    "wid": "79876543210@c.us",
    "typeInstance": "telegram"
  },
  "timestamp": 1763115112,
  "idMessage": "1763115112345",
  "senderData": {
    "chatId": "-10000000000000",
    "chatType": "supergroup",
    "sender": "10000000",
    "chatName": "Тридесятое царство",
    "senderName": "Василиса",
    "senderType": "user",
    "senderContactName": "",
    "senderPhoneNumber": 0
  },
  "messageData": {
    "typeMessage": "textMessage",
    "textMessageData": {
      "textMessage": "Я использую GREEN-API для отправки этого сообщения!",
      "forwardingScore": 1,
      "isForwarded": true
    }
  }
}
```

**Incoming text field path (canonical):**
`body.messageData.textMessageData.textMessage`, gated by
`body.typeWebhook === "incomingMessageReceived"` **and** `body.messageData.typeMessage === "textMessage"`.

---

## 7. Outgoing messages — `outgoingMessageReceived`

**Source:** <https://green-api.com/telegram/docs/api/receiving/notifications-format/outgoing-message/Webhook-OutgoingMessageReceived/>

Verbatim: «В данном разделе приводится описание общего формата входящих уведомлений с типом
outgoingMessageReceived и outgoingAPIMessageReceived.»

### 7.1 Envelope fields (verbatim table — identical to §5.1 apart from `typeWebhook`)

| Параметр | Тип | Описание |
|---|---|---|
| `typeWebhook` | string | Тип входящего уведомления. Для уведомления данного типа поле принимает значение `outgoingMessageReceived` |
| `instanceData` | object | Данные об инстансе |
| `timestamp` | integer | Время наступления события в UNIX-формате |
| `idMessage` | string | Идентификатор отправленного сообщения |
| `senderData` | object | Данные об отправителе сообщения или файла |
| `messageData` | object | Данные об отправленном сообщении или файле |

`instanceData` and `senderData` tables are repeated verbatim from §5.2 / §5.3 (same field names,
types, enums and `senderPhoneNumber = 0` rule).

### 7.2 `messageData`

Verbatim inline comment in the examples: «В зависимости от typeMessage = textMessage || imageMessage ||
videoMessage || documentMessage || audioMessage || locationMessage || pollMessage».

### 7.3 Verbatim example — outgoing message

```json
{
  "typeWebhook": "outgoingMessageReceived",
  "instanceData": {
    "idInstance": 4100000000,
    "wid": "79876543210@c.us",
    "typeInstance": "telegram"
  },
  "timestamp": 1763115112,
  "idMessage": "1763115112345",
  "senderData": {
    "chatId": "10000000",
    "chatType": "user",
    "sender": "20000000",
    "chatName": "Иван Царевич",
    "senderName": "Василиса Премудрая",
    "senderType": "user",
    "senderContactName": "Василиса Премудрая",
    "senderPhoneNumber": 79876543210
  },
  "messageData": {
    // В зависимости от typeMessage = textMessage || imageMessage || videoMessage || documentMessage || audioMessage || locationMessage || pollMessage
  }
}
```

### 7.4 Verbatim example — outgoing message in a group chat

```json
{
  "typeWebhook": "outgoingMessageReceived",
  "instanceData": {
    "idInstance": 4100000000,
    "wid": "79876543210@c.us",
    "typeInstance": "telegram"
  },
  "timestamp": 1763115112,
  "idMessage": "1763468266381",
  "senderData": {
    "chatId": "-10000000000000",
    "chatType": "channel",
    "sender": "10000000",
    "chatName": "Тридесятое царство",
    "senderName": "Василиса",
    "senderType": "user",
    "senderContactName": "",
    "senderPhoneNumber": 79876543210
  },
  "messageData": {
    // В зависимости от typeMessage = textMessage || imageMessage || videoMessage || documentMessage || audioMessage || locationMessage || pollMessage
  }
}
```

**Caution:** the docs never explain the semantics of `sender` for outgoing notifications. In the
private example `sender` (`20000000`) differs from `chatId` (`10000000`), while `senderName` /
`senderContactName` name the instance owner — i.e. `sender` may be the outgoing message's author,
yet the recipient identity is ambiguous. `UNCONFIRMED` which of `chatId` / `sender` is the
counterpart; use `chatId` as the conversation key (it matches the `chatId` used by send methods).

---

## 8. Outgoing API message — `outgoingAPIMessageReceived`

**Source:** <https://green-api.com/telegram/docs/api/receiving/notifications-format/outgoing-message/OutgoingApiMessage/>

Verbatim (key statement):

> Формат сообщения, отправленного с API, идентичен формату входящего сообщения, при этом тип входящего уведомления принимает значение outgoingAPIMessageReceived.
> `[EN: the body format of an API-sent message is IDENTICAL to the incoming-message format; only typeWebhook differs.]`

Enable via: cabinet toggle «Получать уведомления о сообщениях, отправленных через API» (plus
«Получать уведомления о статусах отправки/доставки/прочтении исходящих сообщений» for statuses) or
`SetSettings` `outgoingAPIMessageWebhook` (plus `outgoingWebhook` for statuses).

### 8.1 Verbatim example — API message to a private chat

```json
{
  "typeWebhook": "outgoingAPIMessageReceived",
  "instanceData": {
    "idInstance": 4100000000,
    "wid": "79876543210@c.us",
    "typeInstance": "telegram"
  },
  "timestamp": 1763115112,
  "idMessage": "1763115112345",
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
    // В зависимости от typeMessage = textMessage || imageMessage || videoMessage || documentMessage || audioMessage
    ...
    ...
    ...
  }
}
```

### 8.2 Verbatim example — API message to a group chat

```json
{
  "typeWebhook": "outgoingAPIMessageReceived",
  "instanceData": {
    "idInstance": 4100000000,
    "wid": "79876543210@c.us",
    "typeInstance": "telegram"
  },
  "timestamp": 1763115112,
  "idMessage": "1763468266381",
  "senderData": {
    "chatId": "-10000000000000",
    "chatType": "supergroup",
    "sender": "10000000",
    "chatName": "Тридесятое царство",
    "senderName": "Василиса",
    "senderType": "user",
    "senderContactName": "",
    "senderPhoneNumber": 79876543210
  },
  "messageData": {
    // В зависимости от typeMessage = textMessage || imageMessage || videoMessage || documentMessage || audioMessage
    ...
    ...
    ...
  }
}
```

### 8.3 Matching an API-sent message to the request that sent it

| Question | Answer from the docs |
|---|---|
| Is there an `idMessage` on the notification? | **Yes** — `idMessage` (string) is part of the envelope (top level, not inside `messageData`) |
| Is a client-supplied / local id echoed? | **No field for it.** A corpus-wide search of all 1238 documented sections finds no `localId`; there is no request-echo / correlation-id field anywhere in the Telegram docs |
| How is id produced? | Server-side: «Идентификатор сообщения (`idMessage`) … присваивается входящим и исходящим сообщениям… Идентификатор сообщения **НЕ требуется** формировать самостоятельно» (see `contracts-sending.md` §4) |
| Explicit statement that `outgoingAPIMessageReceived.idMessage` equals the `SendMessage` response `idMessage` | **Not stated** on this page → `UNCONFIRMED`, but it is the only available correlation key and the status page ties `idMessage` to the send methods (§10, A2) |
| Uniqueness / lifetime | Unique **within a chat only**; use `chatId` + `idMessage`; ids are valid only within the current instance session (`contracts-sending.md` §4) |

---

## 9. Outgoing text message

**Source:** <https://green-api.com/telegram/docs/api/receiving/notifications-format/outgoing-message/TextMessage/>

Verbatim recognition conditions:

> Для получения входящих уведомлений данного вида требуется выполнение двух условий:
> - `typeWebhook = outgoingMessageReceived || outgoingAPIMessageReceived`
> - `messageData.typeMessage = textMessage`

Enable via: «Получать уведомления о сообщениях, отправленных с телефона» **and** «Получать
уведомления о сообщениях, отправленных через API» (plus the outgoing-status toggle for statuses), or
`SetSettings` `outgoingMessageWebhook` + `outgoingAPIMessageWebhook` (+ `outgoingWebhook`).

### 9.1 `messageData` fields (verbatim)

| Параметр | Тип | Описание |
|---|---|---|
| `typeMessage` | string | Тип отправленного сообщения. Для сообщений данного типа поле принимает значение `textMessage` |
| `textMessageData` | object | Объект данных о текстовом сообщении |
| `quotedMessage` | object | Объект данных о цитируемом сообщении. Присутствует, только если само сообщение является цитатой |

### 9.2 `textMessageData` fields (verbatim — note: **only** `textMessage` here)

| Параметр | Тип | Описание |
|---|---|---|
| `textMessage` | string | Текстовое сообщение |

`isForwarded` / `forwardingScore` are documented **only** for the incoming variant (§6.2). Treat them
as optional on outgoing text → `UNCONFIRMED` whether they ever appear there.

### 9.3 `quotedMessage` fields (verbatim)

| Параметр | Тип | Описание |
|---|---|---|
| `stanzaId` | string | id цитируемого сообщения |
| `participant` | string | id отправителя цитируемого сообщения |

### 9.4 Verbatim example — outgoing text message

```json
{
  "typeWebhook": "outgoingMessageReceived",
  "instanceData": {
    "idInstance": 4100000000,
    "wid": "79876543210@c.us",
    "typeInstance": "telegram"
  },
  "timestamp": 1763115112,
  "idMessage": "1763115112345",
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

### 9.5 Verbatim example — outgoing text message to a group chat

```json
{
  "typeWebhook": "outgoingMessageReceived",
  "instanceData": {
    "idInstance": 4100000000,
    "wid": "79876543210@c.us",
    "typeInstance": "telegram"
  },
  "timestamp": 1763115112,
  "idMessage": "1763468266381",
  "senderData": {
    "chatId": "-10000000000000",
    "chatType": "supergroup",
    "sender": "10000000",
    "chatName": "Тридесятое царство",
    "senderName": "Василиса",
    "senderType": "user",
    "senderContactName": "",
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

**Outgoing API text field path (canonical):**
`body.messageData.textMessageData.textMessage`, gated by
`body.typeWebhook === "outgoingAPIMessageReceived"` **and** `body.messageData.typeMessage === "textMessage"`.
The phone-sent variant uses the same path with `typeWebhook === "outgoingMessageReceived"`.
Note both doc examples on this page use `typeWebhook: "outgoingMessageReceived"` even though the
conditions also admit `outgoingAPIMessageReceived`.

---

## 10. Outgoing message status — `outgoingMessageStatus`

**Source:** <https://green-api.com/telegram/docs/api/receiving/notifications-format/statuses/OutgoingMessageStatus/>

Verbatim: «Входящее уведомление данного типа содержит статус ранее отправленного сообщения:
отправлено, прочитано.» `[EN: contains the status of a previously sent message.]`

Enable via: «Получать уведомления о сообщениях, отправленных с телефона», «…через API» **and**
«Получать уведомления о статусах отправленных сообщений», or `SetSettings`
`outgoingMessageWebhook` + `outgoingAPIMessageWebhook` + `outgoingWebhook`.

### 10.1 Fields (verbatim table)

| Параметр | Тип | Описание |
|---|---|---|
| `typeWebhook` | string | Тип входящего уведомления. Для уведомлений данного типа поле принимает значение `outgoingMessageStatus` |
| `chatId` | string | Идентификатор чата. Чат с сообщением по которому получили статус. `[EN: chat of the message the status refers to]` |
| `instanceData` | object | Данные об инстансе (same table as §5.2) |
| `timestamp` | integer | Время наступления события в UNIX-формате |
| `idMessage` | string | Идентификатор отправленного сообщения или файла. **Идентификатор отправленного сообщения возвращается методами: SendMessage, SendFileByUrl** `[EN: this is the same id returned by SendMessage / SendFileByUrl]` |
| `status` | string | Статус отправленного сообщения или файла (values below) |
| `description` | string | Описание ошибки (recommended to surface to an operator) (values below) |

### 10.2 `status` — exact value list (verbatim)

| Значение | Описание |
|---|---|
| `delivered` | сообщение доставлено до получателя `[EN: delivered to the recipient]` |
| `read` | сообщение прочитано/просмотрено/прослушано `[EN: read / viewed / listened]` |
| `failed` | произошла ошибка при отправке сообщения на сервер Telegram (данный статус невозможно отключить в настройках SetSettings, необходимо обязательно реализовать обработку данного уведомления) `[EN: send error; cannot be disabled; must be handled]` |
| `noAccount` | на номере телефона получателя не зарегистрирован аккаунт Telegram или номер скрыт настройками приватности (данный статус невозможно отключить в настройках SetSettings, необходимо обязательно реализовать обработку данного уведомления) `[EN: recipient has no Telegram account or number is hidden; cannot be disabled; must be handled]` |

That is the complete set as published: **`delivered`, `read`, `failed`, `noAccount`**. No `sent`,
`pending`, `undelivered` etc. are documented for Telegram → `UNCONFIRMED` whether additional values
can occur.

### 10.3 `description` — documented values (verbatim)

| Значение | Описание |
|---|---|
| `media caption too long` | превышена длина описания медиа сообщения |
| `chatId unresolvable on this session` | ранее не было переписки с указанным идентификатором чата, поэтому получатель не определён. Получите актуальный `chatId` методом CheckAccount и повторите отправку |

### 10.4 Verbatim examples

Status `delivered` (note the **trailing comma** before `}` — the doc example is not strict JSON):

```json
{
  "typeWebhook": "outgoingMessageStatus",
  "chatId": "10000000",
  "instanceData": {
    "idInstance": 4100000000,
    "wid": "79876543210@c.us",
    "typeInstance": "telegram"
  },
  "timestamp": 1755591519,
  "idMessage": "115054445839974415",
  "status": "delivered",
}
```

Status `read` (also trailing comma):

```json
{
  "typeWebhook": "outgoingMessageStatus",
  "chatId": "10000000",
  "instanceData": {
    "idInstance": 4100000000,
    "wid": "79876543210@c.us",
    "typeInstance": "telegram"
  },
  "timestamp": 1755591519,
  "idMessage": "115054445839974415",
  "status": "read",
}
```

Media caption too long — **no `idMessage` in this example**:

```json
{
  "typeWebhook": "outgoingMessageStatus",
  "chatId": "10000000",
  "instanceData": {
    "idInstance": 4100000000,
    "wid": "79876543210@c.us",
    "typeInstance": "telegram"
  },
  "timestamp": 1755591519,
  "status": "failed",
  "description": "media caption too long"
}
```

Recipient not resolvable — **no `idMessage`**:

```json
{
  "typeWebhook": "outgoingMessageStatus",
  "chatId": "10000000",
  "instanceData": {
    "idInstance": 4100000000,
    "wid": "79876543210@c.us",
    "typeInstance": "telegram"
  },
  "timestamp": 1755591519,
  "status": "failed",
  "description": "chatId unresolvable on this session"
}
```

No Telegram account / hidden number — **no `idMessage`, `chatId` is a `@c.us` phone form**:

```json
{
  "typeWebhook": "outgoingMessageStatus",
  "chatId": "77777777777@c.us",
  "instanceData": {
    "idInstance": 4100000000,
    "wid": "79876543210@c.us",
    "typeInstance": "telegram"
  },
  "timestamp": 1755591519,
  "status": "noAccount"
}
```

Facts to encode:

| Fact | Value |
|---|---|
| Match key | `chatId` + `idMessage`; `idMessage` is documented as the value returned by `SendMessage` / `SendFileByUrl` |
| `idMessage` presence | **Optional** — absent in some `failed` / `noAccount` examples; parser must not assume it |
| `description` presence | Optional; only meaningful with `failed` (and the two documented strings) |
| Terminal states | No documented ordering or "final" flag; `delivered` then `read` is implied by the status list order only → `UNCONFIRMED` |
| Strict JSON | Two published examples contain a trailing comma → parse tolerantly or expect real-world payloads to differ from docs |

---

## 11. `typeWebhook` — full list of notification types

**Source:** <https://green-api.com/telegram/docs/api/receiving/notifications-format/type-webhook/>

Verbatim list (this is the complete enumeration on the page):

| `typeWebhook` | Verbatim description |
|---|---|
| `incomingMessageReceived` | уведомление о входящих сообщениях и файлах |
| `outgoingMessageReceived` | уведомление об исходящих сообщениях и файлах |
| `outgoingAPIMessageReceived` | уведомление о сообщении, отправленного из API |
| `outgoingMessageStatus` | уведомление о статусах отправки/доставки/прочтении исходящих сообщений |
| `stateInstanceChanged` | уведомление об изменении состояния авторизации инстанса |
| `quotaExceeded` | уведомление о превышении ограничений на тарифе Разработчик |

Verbatim SetSettings example (note the **trailing comma** after the last member):

```json
{
  "outgoingWebhook": "yes",
  "outgoingMessageWebhook": "yes",
  "stateWebhook": "yes",
  "incomingWebhook": "yes",
}
```

Enable-flag mapping (`SetSettings`):

| `typeWebhook` | Enabling flag |
|---|---|
| `incomingMessageReceived` | `incomingWebhook` |
| `outgoingMessageReceived` | `outgoingMessageWebhook` |
| `outgoingAPIMessageReceived` | `outgoingAPIMessageWebhook` |
| `outgoingMessageStatus` | `outgoingWebhook` |
| `stateInstanceChanged` | `stateWebhook` |
| `quotaExceeded` | not stated on these pages → `UNCONFIRMED` |

---

## 12. Instance state changed — `stateInstanceChanged`

**Source:** <https://green-api.com/telegram/docs/api/receiving/notifications-format/service/StateInstanceChanged/>

Verbatim: «Входящее уведомление данного типа содержит данные о состоянии авторизации инстанса.»

Enable via cabinet toggle «Получать уведомления об изменении состояния авторизации аккаунта» or
`SetSettings` `stateWebhook`.

### 12.1 Fields (verbatim table)

| Параметр | Тип | Описание |
|---|---|---|
| `typeWebhook` | string | Тип входящего уведомления. Для уведомлений данного типа поле принимает значение `stateInstanceChanged` |
| `instanceData` | object | Данные об инстансе (same table as §5.2) |
| `timestamp` | integer | Время наступления события в UNIX-формате |
| `stateInstance` | string | Состояние инстанса (values below) |

### 12.2 `stateInstance` — exact value list (verbatim)

| Значение | Описание |
|---|---|
| `notAuthorized` | Инстанс не авторизован. Для авторизации инстанса обратитесь к разделу Перед началом работы |
| `authorized` | Инстанс авторизован |
| `blocked` | Инстанс получил блокировку |
| `starting` | Инстанс в процессе запуска (сервисный режим). Происходит перезагрузка инстанса, сервера или инстанс в режиме обслуживания. Может потребоваться до 5 минут для перевода состояния инстанса в значение authorized |
| `pendingCode` | Поле устарело. `[EN: deprecated]` Для завершения авторизации необходимо отправить код авторизации методом SendAuthorizationCode |
| `pendingPassword` | Для завершения авторизации необходимо отправить пароль двухфакторной аутентификации (2fa) методом SendAuthorizationPassword |

(The page's table ends with an empty row after `pendingPassword`.)

### 12.3 Verbatim example

```json
{
  "typeWebhook": "stateInstanceChanged",
  "instanceData": {
    "idInstance": 4100000000,
    "wid": "79876543210@c.us",
    "typeInstance": "telegram"
  },
  "timestamp": 1755589527,
  "stateInstance": "authorized"
}
```

This notification has **no `idMessage` and no `chatId`**.

---

## A1. Quota exceeded — `quotaExceeded` (extra page, for completeness of `typeWebhook`)

**Source:** <https://green-api.com/telegram/docs/api/receiving/notifications-format/service/QuotaExceeded/>

Verbatim: «Входящее уведомление quotaExceeded содержит данные о превышении ограничений чатов на
тарифе Telegram Developer.»

| Параметр | Тип | Описание |
|---|---|---|
| `typeWebhook` | string | `quotaExceeded` |
| `instanceData` | object | Данные об инстансе |
| `timestamp` | integer | Время наступления события в UNIX-формате — **listed in the table but absent from the example** |
| `quotaData` | object | Данные о превышении ограничений |

`quotaData` fields (verbatim table):

| Параметр | Тип | Описание |
|---|---|---|
| `method` | string | Название метода или ограничения. По умолчанию принимает значение `correspondents` |
| `used` | string | Количество использованных чатов за месяц — table says `string`, example shows a **number** |
| `total` | string | Общее количество чатов в месяц. По умолчанию `3` — table says `string`, example shows a **number** |
| `status` | string | Статус ограничения |
| `description` | string | Описание превышения ограничения |

Verbatim example:

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
    "description": "Monthly quota has been exceeded. You can only send or receive messages from following chats: 10000000, 10000001, 10000002. Please go to your personal account and change the tariff to business https://console.green-api.com"
  }
}
```

Parser implications: `timestamp` may be missing; `used`/`total` arrive as numbers although documented
as strings; `status` is an uppercase enum-like code.

---

## A2. Send-side linkage for matching a sent message to its notification (extra)

Sources: `SendMessage` <https://green-api.com/telegram/docs/api/sending/SendMessage/>,
`GetMessage` <https://green-api.com/telegram/docs/api/journals/GetMessage/>,
`GetChatHistory` <https://green-api.com/telegram/docs/api/journals/GetChatHistory/>.
See also `contracts-sending.md` §2 and §4 in this directory.

`SendMessage` request: `POST {{apiUrl}}/waInstance{{idInstance}}/sendMessage/{{apiTokenInstance}}`
with body `{ "chatId": string, "message": string, "quotedMessageId"?: string, "typingTime"?: integer, "typingType"?: string }`.

`SendMessage` response (verbatim field table and example):

| Поле | Тип | Описание |
|---|---|---|
| `idMessage` | string | Идентификатор отправленного сообщения |

```json
{
    "idMessage": "1769676078000"
}
```

`GetMessage` (verbatim: response of an incoming text message partly shown; field table) — corroborates
the same identifier space and distinguishes API-sent outgoing messages:

| Поле | Тип | Описание |
|---|---|---|
| `type` | string | `outgoing` — исходящее; `incoming` — входящее |
| `idMessage` | string | Идентификатор входящего сообщения |
| `timestamp` | integer | Время принятия сообщения в UNIX-формате |
| `statusMessage` | string | Статус исходящего сообщения. Только для `type = outgoing`. Возможные значения: `delivered` (доставлено), `read` (прочитано/просмотрено/прослушано) |
| `sendByApi` | boolean | **Флаг отправки через API. Только для `type = outgoing`** `[EN: true when the message was sent through the API]` |
| `typeMessage` | string | `textMessage` / `imageMessage` / `videoMessage` / `documentMessage` / `audioMessage` / `pollMessage` / `locationMessage` |
| `chatId` | string | Идентификатор чата, в котором получено сообщение |
| `chatType` | string | `"user"`, `"group"`, `"supergroup"`, `"channel"`, `"bot"` |
| `senderName`, `senderType`, `senderContactName` | string | only for `type = incoming` |
| `isForwarded`, `forwardingScore` | boolean, integer | forward flags |
| `textMessage` | string | Текст сообщения, если `typeMessage = textMessage` (flat here, **not** nested in `textMessageData`) |

`GetMessage` request example (verbatim) — note it uses exactly the `idMessage` that `SendMessage`
returned:

```json
{
    "chatId": "10000000",
    "idMessage": "1769676078000"
}
```

Matching strategy that the docs support:

1. Capture `idMessage` from the `SendMessage` (or `SendFileByUrl`) HTTP response.
2. Correlate the `outgoingMessageStatus` notification by `chatId` + `idMessage` — the status page
   explicitly says `idMessage` «возвращается методами: SendMessage, SendFileByUrl».
3. Correlate `outgoingAPIMessageReceived` by `idMessage` as well; the docs never state this equality
   explicitly → `UNCONFIRMED`, verify against a live instance. `GetMessage`/`GetChatHistory`
   (`sendByApi: true`, same `idMessage`) are the documented fallback if you must confirm authorship.
4. There is **no local correlation id**: no `localId`, no request echo. The only handle is the
   server-assigned `idMessage` (session-scoped, unique per chat only).

---

## A3. Rate limits relevant to the receive loop (extra)

**Source:** <https://green-api.com/telegram/docs/api/ratelimiter/> (also `contracts-sending.md` §7).

Verbatim: limits are per instance, per method; requests above the limit are rejected with **429**
(«будут отклонены с ошибкой 429»). Verbatim table rows:

| Метод | Число запросов в секунду |
|---|---|
| `ReceiveNotification` | **100** |
| `DeleteNotification` | **100** |

Implication for a long-poll client: 100 polls/s per instance is far above a sane loop rate; the
binding constraint is the long-poll wait itself. `429` is the only documented rate-limit signal; the
`429` body/headers (`Retry-After`) are undocumented → `UNCONFIRMED`.

---

## A4. Field-path index for the parser

| Notification | Discriminator | Payload path | Other top-level fields |
|---|---|---|---|
| Incoming text | `typeWebhook = "incomingMessageReceived"` AND `messageData.typeMessage = "textMessage"` | `messageData.textMessageData.textMessage` (`isForwarded`, `forwardingScore` alongside) | `instanceData`, `timestamp`, `idMessage`, `senderData` |
| Incoming (other kinds) | `typeWebhook = "incomingMessageReceived"` AND `messageData.typeMessage` ∈ {`imageMessage`, `videoMessage`, `documentMessage`, `audioMessage`, `locationMessage`, `contactMessage`, `pollMessage`, `reactionMessage`, `stickerMessage`, …} | kind-specific sub-object of `messageData` | as above |
| Outgoing from phone text | `typeWebhook = "outgoingMessageReceived"` AND `messageData.typeMessage = "textMessage"` | `messageData.textMessageData.textMessage` | `instanceData`, `timestamp`, `idMessage`, `senderData` |
| Outgoing via API text | `typeWebhook = "outgoingAPIMessageReceived"` AND `messageData.typeMessage = "textMessage"` | `messageData.textMessageData.textMessage` | `instanceData`, `timestamp`, `idMessage`, `senderData` |
| Outgoing status | `typeWebhook = "outgoingMessageStatus"` | `status` (enum), `chatId`, optional `idMessage`, optional `description` | `instanceData`, `timestamp` |
| Instance state | `typeWebhook = "stateInstanceChanged"` | `stateInstance` (enum) | `instanceData`, `timestamp` |
| Quota | `typeWebhook = "quotaExceeded"` | `quotaData.{method,used,total,status,description}` | `instanceData`, optional `timestamp` |

Envelope of an HTTP-API poll: the above payloads arrive as `response.body`; `response.receiptId` is the
ack handle.

```text
PollResponse = { receiptId: number; body: Notification }
```

---

## Cross-cutting UNCONFIRMED list

1. **Empty-response shape on timeout** — docs only say «пустым ответом»; whether the body is empty,
   `{}`, `null`, or a 200 with zero-length content is not stated. Implement all three checks.
2. **Wait duration** — prose says 5 s but `receiveTimeout` documents 5–60 s (default 5). Which bound
   actually applies when `receiveTimeout` is omitted/large is not reconciled in the docs.
3. **Timestamp unit** — docs say only «в UNIX-формате» (integer). Every example is a 10-digit value
   consistent with **seconds** (`1763115112`, `1755591519`, `1755589527`), but seconds vs milliseconds
   is never stated explicitly; `idMessage` values that look like milliseconds are a different field.
4. **`outgoingAPIMessageReceived.idMessage` = `SendMessage` response `idMessage`** — not stated on the
   notification pages (only the status page ties `idMessage` to the send methods).
5. **No local/correlation id exists** — a corpus-wide search finds no `localId`/echo field; whether
   any undocumented field is ever added is unknown.
6. **`sender` semantics on outgoing notifications** — which of `chatId` / `sender` identifies the
   counterpart is not explained; the examples are mutually inconsistent.
7. **Additional `status` values** — only `delivered`, `read`, `failed`, `noAccount` are documented; no
   `sent`/`pending`, no ordering/finality guarantees.
8. **Additional `typeWebhook` values** — the complete published list is the 6 in §11; the receiving
   index page mentions an "incoming call" event with no corresponding type.
9. **`isForwarded` / `forwardingScore` on outgoing text** — documented only for incoming.
10. **`quotaExceeded` enabling flag and its `timestamp`** — enabling flag not stated; `timestamp`
    listed in the field table but missing from the example.
11. **Doc examples are not always strict JSON** — trailing commas appear in `outgoingMessageStatus`
    and `type-webhook` examples; `quotaExceeded` shows numbers where the table says strings.
12. **`chatType`/`senderType` optionality** — present in the format pages but absent from the
    `ReceiveNotification` example; treat as optional.
13. **Delivery guarantees / duplicates** — FIFO and 24 h retention are documented; at-least-once,
    duplicate suppression and behaviour after the 24 h expiry are not.
14. **`429` body/headers and retry guidance** for `ReceiveNotification`/`DeleteNotification`.
