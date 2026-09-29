# Telegram-чат на GREEN-API

Репозиторий с одним веб-клиентом чата, построенным на HTTP API сервиса
[GREEN-API](https://green-api.com/telegram) для мессенджера **Telegram**.
Приложение — Vite + React + TypeScript, общается с GREEN-API напрямую из браузера
по HTTP.

| Приложение | Мессенджер | Дизайн-система | Порт dev | Документация |
| --- | --- | --- | --- | --- |
| [`apps/telegram`](apps/telegram) | Telegram | [`@telegram-apps/telegram-ui`](https://www.npmjs.com/package/@telegram-apps/telegram-ui) — официальный UI Kit Telegram | 5174 | [apps/telegram/README.md](apps/telegram/README.md) |

## Что умеет приложение

1. **Вход по учётным данным GREEN-API** — `idInstance` + `apiTokenInstance`
   (хранится в `localStorage`), плюс `getStateInstance` для проверки и, по
   желанию, `setSettings` для перевода инстанса на приём уведомлений по HTTP API.
2. **Создание чата по номеру телефона или `@username`** — `checkAccount`
   возвращает `chatId`, по которому уже идёт отправка.
3. **Отправка текста** — `sendMessage` с оптимистичным сообщением в ленте,
   которое затем сверяется с `idMessage` сервера.
4. **Приём текста** — длинный опрос `receiveNotification` / `deleteNotification`
   в хуке `useNotificationPolling` с экспоненциальной паузой при ошибках.
5. **Только текст** — вложения, медиа, реакции, группы и звонки вне объёма.

Внешний вид повторяет [Telegram Web](https://web.telegram.org/k/): палитра,
геометрия и обои взяты из темы настоящего веб-клиента, а не подобраны на глаз.
Что именно воспроизводится и чем это подтверждено — в
[apps/telegram/README.md](apps/telegram/README.md#оформление).

## Быстрый старт

Нужен Node.js 22.12 или новее (проверено на Node 26; рекомендуется 24 LTS,
версия зафиксирована в [.nvmrc](.nvmrc)).

```bash
nvm use
npm install
npm run dev
```

Vite слушает порт 5174: по умолчанию <http://localhost:5174>. Тот же запуск
доступен скриптом `npm run dev:telegram`.

Проверки:

```bash
npm run typecheck
npm test
npm run build
```

Скриншоты интерфейса для документации (нужен запущенный dev-сервер):

```bash
npm run screenshots
```

## Структура

```
apps/telegram    клиент Telegram — React 18 + официальный UI Kit Telegram
```

Документация лежит рядом с приложением: контракты GREEN-API, референсы по UI Kit,
палитра Telegram Web и снимки экрана — в
[`apps/telegram/docs`](apps/telegram/docs).

Приложение можно запустить и прочитать отдельно: у него собственный API,
собственный набор UI-компонентов и собственный визуальный язык.
