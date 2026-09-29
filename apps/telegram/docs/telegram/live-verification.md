# Живая проверка на инстансе GREEN-API (Telegram)

Проверка выполнена на настоящем инстансе в кластере 4100. Учётные данные
передавались только через переменные окружения и в репозиторий не попали;
ниже они не приводятся.

## Что выяснилось сверх документации

Документация GREEN-API показывает `senderData` в уведомлениях одним примером,
и в нём все поля принадлежат **отправителю**. Для входящих сообщений это и есть
собеседник, а для исходящих — нет. Реальные тела, снятые с инстанса:

### Исходящее сообщение другому человеку (`outgoingAPIMessageReceived`)

```json
{
  "typeWebhook": "outgoingAPIMessageReceived",
  "instanceData": { "idInstance": 4100000001, "wid": "79001234567@c.us", "typeInstance": "telegram" },
  "timestamp": 1790000000,
  "idMessage": "live-out-1",
  "senderData": {
    "chatId": "6900000001",
    "chatType": "user",
    "sender": "305000000",
    "chatName": ".",
    "senderName": "Владелец",
    "senderType": "user",
    "senderContactName": "Владелец",
    "senderPhoneNumber": 79001234567
  },
  "messageData": {
    "typeMessage": "textMessage",
    "textMessageData": { "textMessage": "ffff", "forwardingScore": 0, "isForwarded": false }
  }
}
```

Счётчик `79001234567` — это номер **самого аккаунта** (он же в
`getAccountSettings.phone`), `sender: 305000000` — его чат «Избранное», а имя
`Владелец` — владелец аккаунта. Единственное поле собеседника — `chatId`.

Последствия, если читать `senderData` как собеседника:

- заголовок чата — имя владельца аккаунта;
- `phone` чата — собственный номер, и уведомления разных чатов начинают
  находить друг друга по этому номеру (в проверке сообщение в «Избранное»
  попадало в чат с другим собеседником);
- `chatName` у собеседника без display name — литеральная точка `"."`.

### Исходящее сообщение самому себе

Тот же блок, но `sender === chatId` (`305000000`) и `chatName` уже заполнен
именем владельца. Такой чат приложение называет «Избранное».

### Как узнать настоящее имя

`getContactInfo` для `chatId 6900000001`:

```json
{ "chatId": "6900000001", "name": ".", "contactName": ".", "username": "@peer_demo",
  "phoneNumber": 79005556677, "chatType": "user", "isPremium": false, … }
```

Имя — снова точка, поэтому порядок выбора такой: `name` → `contactName` →
`@username` → телефон. Один вызов на вновь обнаруженный чат.

## Ответы методов

| Метод | Ответ |
| --- | --- |
| `getStateInstance` | `{"stateInstance":"authorized"}` (до авторизации — `notAuthorized`, QR берётся методом `QR`) |
| `getAccountSettings` | `{"avatar":"…jpg","phone":"79001234567","stateInstance":"authorized","chatId":"305000000","username":"@my_account","historySyncProgress":24,"logoutProcess":false}` |
| `sendMessage` | `{"idMessage":"1790683577915"}` |
| `receiveNotification` | `{ "receiptId": 1, "body": { … } }`; при пустой очереди — пустой ответ |
| `deleteNotification` | `{"result":true,"reason":""}` |
| `getContactInfo` | см. выше |
| `getChatHistory` | массив сообщений с `type`, `idMessage`, `timestamp`, `textMessage`, `statusMessage`, `sendByApi` (в приложении не используется) |
| `setSettings` | `{"saveSettings":true}`, перезапускает инстанс |

## Прочее, замеченное вживую

- `getSettings` до авторизации отдаёт все `*Webhook` в `"no"`, а у уже
  авторизованного инстанса — в `"yes"`. Приём по HTTP API работает при пустом
  `webhookUrl`.
- Уведомление, прочитанное без `deleteNotification`, на этом инстансе больше не
  возвращалось: документация обещает повторную выдачу, фактического поведения
  удалось проверить только на одном наблюдении, поэтому цикл приложения
  подтверждает уведомления в любом случае.
- `historySyncProgress` сразу после авторизации был `24` — инстанс качает
  историю; приложение этот процент не показывает.
