export const DISCOVERY_TAB = {
  SERVERS: 'servers',
  THEMES: 'themes',
  DECORATIONS: 'decorations',
};

export const DISCOVERY_SECTION_META = {
  [DISCOVERY_TAB.SERVERS]: {
    heading: 'Обнаружение серверов',
    subtitle: 'Найдите сообщества Whithin и присоединяйтесь к публичным серверам.',
    searchPlaceholder: 'Поиск по названию или описанию сервера…',
  },
  [DISCOVERY_TAB.THEMES]: {
    heading: 'Темы оформления',
    subtitle: 'Добавляйте темы в коллекцию и применяйте их в настройках.',
    searchPlaceholder: 'Поиск по названию или описанию темы…',
  },
  [DISCOVERY_TAB.DECORATIONS]: {
    heading: 'Украшения профиля',
    subtitle: 'Выберите рамку для аватара. Пока доступны только рамки — таблички и эффекты появятся позже.',
    searchPlaceholder: 'Поиск по названию рамки…',
  },
};
