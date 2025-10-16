# Архитектура Whithin Messenger

## Обзор системы

### Высокоуровневая архитектура

```mermaid
graph TB
    Client[Client Layer<br/>React SPA - Feature-Sliced Design<br/>Pages • Widgets • Entities • Shared]
    API[API Gateway Layer<br/>ASP.NET Core<br/>Controllers • Hubs • Middleware • CORS]
    App[Application Layer - CQRS<br/>Commands & Queries - MediatR<br/>Handlers • Validators • Services]
    Domain[Domain Layer<br/>Business Entities & Interfaces<br/>Models • DTOs • Contracts]
    Infra[Infrastructure Layer<br/>Data Access & External Services<br/>EF Core • Repositories • Migrations]
    DB[(Database Layer<br/>PostgreSQL<br/>Tables • Indexes • Constraints)]
    
    Client -->|HTTP/WebSocket<br/>SignalR| API
    API --> App
    App --> Domain
    Domain --> Infra
    Infra --> DB
```

## Backend Architecture

### Clean Architecture Flow

```mermaid
flowchart LR
    subgraph Presentation
        Controllers[Controllers]
        Hubs[SignalR Hubs]
    end
    
    subgraph Application
        Commands[Commands]
        Queries[Queries]
        Handlers[Handlers]
        Validators[Validators]
    end
    
    subgraph Domain
        Entities[Entities]
        Interfaces[Interfaces]
    end
    
    subgraph Infrastructure
        Repos[Repositories]
        DB[(PostgreSQL)]
    end
    
    Controllers --> Commands
    Controllers --> Queries
    Hubs --> Commands
    Hubs --> Queries
    
    Commands --> Handlers
    Queries --> Handlers
    Handlers --> Validators
    Handlers --> Repos
    
    Repos --> Entities
    Repos --> Interfaces
    Repos --> DB
```

### CQRS Pattern

```mermaid
sequenceDiagram
    participant Client
    participant Controller
    participant MediatR
    participant Handler
    participant Validator
    participant Repository
    participant DB
    
    Client->>Controller: HTTP Request
    Controller->>MediatR: Send Command/Query
    MediatR->>Validator: Validate
    Validator-->>MediatR: Valid/Invalid
    MediatR->>Handler: Handle
    Handler->>Repository: Get/Save Data
    Repository->>DB: SQL Query
    DB-->>Repository: Data
    Repository-->>Handler: Entity
    Handler-->>MediatR: Result<T>
    MediatR-->>Controller: Result<T>
    Controller-->>Client: HTTP Response
```

## Frontend Architecture

### Feature-Sliced Design

```mermaid
graph TD
    App[app<br/>Инициализация, провайдеры, роутинг]
    Pages[pages<br/>Страницы приложения]
    Widgets[widgets<br/>Композитные бизнес-блоки]
    Entities[entities<br/>Бизнес-сущности]
    Shared[shared<br/>Переиспользуемый код<br/>UI • Hooks • Utils • API]
    
    App --> Pages
    Pages --> Widgets
    Pages --> Entities
    Pages --> Shared
    Widgets --> Entities
    Widgets --> Shared
    Entities --> Shared
```

### Atomic Design (UI)

```mermaid
graph LR
    Atoms[Atoms<br/>Button, Input<br/>Avatar, Icon]
    Molecules[Molecules<br/>MessageItem<br/>SearchBar]
    Organisms[Organisms<br/>LoginForm<br/>ChatList]
    
    Atoms --> Molecules
    Molecules --> Organisms
```

## Взаимодействие компонентов

### Отправка сообщения

```mermaid
sequenceDiagram
    participant User
    participant React
    participant SignalR
    participant Hub
    participant MediatR
    participant Handler
    participant DB
    participant Clients
    
    User->>React: Ввод сообщения → Enter
    React->>SignalR: sendMessage(chatId, content)
    SignalR->>Hub: SendMessage()
    Hub->>MediatR: Send(SendMessageCommand)
    MediatR->>Handler: Handle(command)
    Handler->>DB: SaveAsync(message)
    DB-->>Handler: Success
    Handler-->>MediatR: Result<MessageDto>
    MediatR-->>Hub: MessageDto
    Hub->>Clients: ReceiveMessage(messageDto)
    Clients->>React: Обновить state
    React->>User: Показать сообщение
```

## Паттерны проектирования

### Backend Patterns

- **CQRS** - разделение команд (изменение) и запросов (чтение)
- **Repository** - абстракция доступа к данным
- **Mediator** - централизованная обработка через MediatR
- **Dependency Injection** - IoC контейнер
- **Result Pattern** - типизированная обработка ошибок

### Frontend Patterns

- **Feature-Sliced Design** - модульная архитектура
- **Atomic Design** - иерархия UI компонентов
- **Custom Hooks** - переиспользование логики
- **Context API** - глобальное состояние
- **Observer** - подписка на SignalR события

## Масштабируемость

### Горизонтальное масштабирование

```mermaid
graph TB
    LB[Load Balancer<br/>Nginx]
    
    subgraph API Instances
        API1[API Instance 1]
        API2[API Instance 2]
        API3[API Instance 3]
    end
    
    subgraph Shared Resources
        Redis[(Redis<br/>Session + SignalR)]
        PG[(PostgreSQL)]
    end
    
    LB --> API1
    LB --> API2
    LB --> API3
    
    API1 --> Redis
    API2 --> Redis
    API3 --> Redis
    
    API1 --> PG
    API2 --> PG
    API3 --> PG
```

## База данных

### Entity Relationship

```mermaid
erDiagram
    ApplicationUsers ||--o{ UserProfiles : has
    ApplicationUsers ||--o{ Messages : sends
    ApplicationUsers ||--o{ ServerMembers : "member of"
    ApplicationUsers ||--o{ Friendships : has
    
    Chats ||--o{ Messages : contains
    Chats ||--o{ Members : has
    Chats }o--|| ChatCategories : "belongs to"
    
    Servers ||--o{ ChatCategories : has
    Servers ||--o{ ServerMembers : has
    Servers ||--o{ ServerRoles : has
    
    Messages ||--o{ MediaFiles : includes
    Messages ||--o{ MessageReads : "read by"
    
    ApplicationUsers {
        uuid Id PK
        string Username
        string Email
        string PasswordHash
    }
    
    Chats {
        uuid Id PK
        string Name
        enum ChatType
        uuid CategoryId FK
    }
    
    Messages {
        uuid Id PK
        uuid ChatId FK
        uuid SenderId FK
        string Content
        datetime CreatedAt
    }
    
    Servers {
        uuid Id PK
        string Name
        uuid OwnerId FK
        bool IsPublic
    }
```

---

