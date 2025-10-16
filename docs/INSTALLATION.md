## Если есть docker

Ввести команду в корне репозитория:

> $ docker-compose up --build -d

После этого можно будет получить доступ к приложению на localhost:8081

## Если docker нет

Необходимо установить и настроить следующие компоненты:

- [PostgreSQL](https://www.postgresql.org/download/)
- [Node.js](https://nodejs.org/en/download)
- [.NET 9](https://dotnet.microsoft.com/en-us/download)


По умолчанию в appSettings.development.json содержатся строки подключения со следующими данными (при необходимости исправить или прокинуть свои):

- PostgreSQL: пользователь - postgres, пароль - root, база данных - whithin_db, порт - 5432

Миграции применяются автоматически при старте приложения или вручную через EF Core CLI.

Дальше необходимо перейти в папку Backend (команды вводятся по очереди из корня проекта):

> $ cd NewProject/WhithinMessenger.Backend/src/WhithinMessenger.Api

> $ dotnet ef database update --project ../WhithinMessenger.Infrastructure

> $ dotnet run

Backend запустится на https://localhost:5117

Теперь запустить Frontend (открыть еще один терминал):

> $ cd NewProject/WhithinMessenger.Client

> $ npm i

> $ npm run dev

Frontend запустится на http://localhost:5173
