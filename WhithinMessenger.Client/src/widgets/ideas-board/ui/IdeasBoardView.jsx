import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIdeaBoard } from '../../../entities/idea-board/hooks/useIdeaBoard';
import { useServerHubConnection } from '../../../shared/lib/hooks/useServerHubConnection';
import './IdeasBoardView.css';

const formatDate = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const truncateText = (text, maxLength) => {
  const value = String(text || '');
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
};

const cutTitle = (title) =>
  String(title || '')
    .split('')
    .map((char, index) =>
      char === ' ' ? (
        ' '
      ) : (
        <span key={`${char}-${index}`} className="cut">
          {char}
        </span>
      )
    );

const splitChannelTitle = (name) => {
  const text = String(name || 'ИДЕИ').toUpperCase().replace(/\s+/g, '');
  return text.slice(0, 12).split('');
};

const normalizeTag = (tag) => {
  if (!tag) return null;
  const normalized = String(tag).trim().toLowerCase().replace(/^#+/, '');
  return normalized || null;
};

const MIN_CARD_WIDTH = 200;
const ESTIMATED_CARD_HEIGHT = 200;
const MAX_GRID_COLS = 4;
const MAX_GRID_ROWS = 3;

const getPinAnchor = (cardEl, boardRect) => {
  const pin = cardEl?.querySelector('.exhibit-pin');
  if (!pin) return null;
  const rect = pin.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - boardRect.left,
    y: rect.top + rect.height / 2 - boardRect.top,
  };
};

const sortCardsByBoardPosition = (group, board) =>
  [...group].sort((cardA, cardB) => {
    const elA = board.querySelector(`[data-card-id="${cardA.cardId}"]`);
    const elB = board.querySelector(`[data-card-id="${cardB.cardId}"]`);
    if (!elA || !elB) return 0;
    const rectA = elA.getBoundingClientRect();
    const rectB = elB.getBoundingClientRect();
    const rowDelta = rectA.top - rectB.top;
    if (Math.abs(rowDelta) > 24) return rowDelta;
    return rectA.left - rectB.left;
  });

const STRING_COLORS = [
  '#9e1b1b',
  '#1b4d9e',
  '#1b6b3a',
  '#7a4a12',
  '#5b2d82',
  '#a16207',
  '#0f6e7a',
  '#9f1239',
  '#4338ca',
  '#047857',
];

const getTagStringColor = (tag) => {
  let hash = 0;
  for (let i = 0; i < tag.length; i += 1) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return STRING_COLORS[Math.abs(hash) % STRING_COLORS.length];
};

const buildTagLinePairs = (cards, board) => {
  const groups = new Map();
  cards.forEach((card) => {
    const tag = normalizeTag(card.tag);
    if (!tag) return;
    if (!groups.has(tag)) groups.set(tag, []);
    groups.get(tag).push(card);
  });

  const linePairs = [];
  groups.forEach((group, tag) => {
    if (group.length < 2) return;
    const sorted = sortCardsByBoardPosition(group, board);
    const color = getTagStringColor(tag);
    for (let i = 0; i < sorted.length - 1; i += 1) {
      linePairs.push({ from: sorted[i], to: sorted[i + 1], color });
    }
  });
  return linePairs;
};

const IdeasBoardView = ({
  channelId,
  channelName,
  serverId,
  userId,
  canCreate = true,
  canModerate = false,
}) => {
  const connection = useServerHubConnection(serverId);
  const {
    cards,
    isLoading,
    createCard,
    updateCard,
    deleteCard,
  } = useIdeaBoard(connection, channelId);

  const pinboardRef = useRef(null);
  const stringsRef = useRef(null);
  const [gridLayout, setGridLayout] = useState({ cols: 3, rows: 2, cardMaxHeight: 280 });

  const [sort, setSort] = useState('newest');
  const [unfiledOnly, setUnfiledOnly] = useState(false);
  const [showStrings, setShowStrings] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showCompose, setShowCompose] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [composeForm, setComposeForm] = useState({
    title: '',
    body: '',
    tag: '',
    sourceUrl: '',
  });

  const titleLetters = useMemo(() => splitChannelTitle(channelName), [channelName]);

  const canManageCard = useCallback(
    (card) =>
      canModerate || (userId != null && String(card.authorUserId) === String(userId)),
    [canModerate, userId]
  );

  const openCreateForm = () => {
    setEditingCard(null);
    setComposeForm({ title: '', body: '', tag: '', sourceUrl: '' });
    setShowCompose(true);
  };

  const openEditForm = (card) => {
    setEditingCard(card);
    setComposeForm({
      title: card.title || '',
      body: card.body || '',
      tag: card.tag || '',
      sourceUrl: card.sourceUrl || '',
    });
    setShowCompose(true);
    setSelectedCard(null);
  };

  const closeComposeForm = () => {
    setShowCompose(false);
    setEditingCard(null);
    setComposeForm({ title: '', body: '', tag: '', sourceUrl: '' });
  };

  const visibleCards = useMemo(() => {
    let list = [...cards];
    if (sort === 'newest') {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sort === 'oldest') {
      list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (sort === 'tag') {
      list.sort((a, b) => String(a.tag || '').localeCompare(String(b.tag || ''), 'ru'));
    }
    if (unfiledOnly) {
      list = list.filter((card) => !card.isFiled);
    }
    return list;
  }, [cards, sort, unfiledOnly]);

  const ideasPerPage = Math.max(1, gridLayout.cols * gridLayout.rows);
  const totalPages = Math.max(1, Math.ceil(visibleCards.length / ideasPerPage));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedCards = useMemo(() => {
    const start = (safePage - 1) * ideasPerPage;
    return visibleCards.slice(start, start + ideasPerPage);
  }, [visibleCards, safePage, ideasPerPage]);

  useEffect(() => {
    const node = pinboardRef.current;
    if (!node) return undefined;

    const updateLayout = () => {
      const { width, height } = node.getBoundingClientRect();
      if (width < 40 || height < 40) return;

      const style = getComputedStyle(node);
      const gapX = parseFloat(style.columnGap) || 14;
      const gapY = parseFloat(style.rowGap) || 12;

      const cols = Math.max(
        1,
        Math.min(MAX_GRID_COLS, Math.floor((width + gapX) / (MIN_CARD_WIDTH + gapX)))
      );
      const rows = Math.max(
        1,
        Math.min(MAX_GRID_ROWS, Math.floor((height + gapY) / (ESTIMATED_CARD_HEIGHT + gapY)))
      );

      const cardMaxHeight = Math.max(
        120,
        Math.floor((height - (rows - 1) * gapY) / rows) - 12
      );

      setGridLayout((prev) => {
        if (
          prev.cols === cols &&
          prev.rows === rows &&
          prev.cardMaxHeight === cardMaxHeight
        ) {
          return prev;
        }
        return { cols, rows, cardMaxHeight };
      });
    };

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(updateLayout);
    });
    observer.observe(node);
    updateLayout();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [sort, unfiledOnly, gridLayout.cols, gridLayout.rows]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const goToPage = (page) => {
    const nextPage = Math.min(Math.max(1, page), totalPages);
    setCurrentPage(nextPage);
  };

  const drawStrings = useCallback(() => {
    const svg = stringsRef.current;
    const board = pinboardRef.current;
    if (!svg || !board) return;

    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    if (!showStrings) {
      svg.classList.remove('show');
      return;
    }

    const boardRect = board.getBoundingClientRect();
    const width = Math.max(board.clientWidth, 1);
    const height = Math.max(board.scrollHeight, board.clientHeight, 1);
    const linePairs = buildTagLinePairs(paginatedCards, board);

    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.style.height = `${height}px`;

    linePairs.forEach(({ from, to, color }) => {
      const fromEl = board.querySelector(`[data-card-id="${from.cardId}"]`);
      const toEl = board.querySelector(`[data-card-id="${to.cardId}"]`);
      if (!fromEl || !toEl) return;

      const start = getPinAnchor(fromEl, boardRect);
      const end = getPinAnchor(toEl, boardRect);
      if (!start || !end) return;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(start.x));
      line.setAttribute('y1', String(start.y));
      line.setAttribute('x2', String(end.x));
      line.setAttribute('y2', String(end.y));
      line.setAttribute('stroke', color);
      svg.appendChild(line);
    });

    svg.classList.add('show');
  }, [showStrings, paginatedCards, gridLayout]);

  useEffect(() => {
    let frameId = requestAnimationFrame(() => {
      frameId = requestAnimationFrame(() => drawStrings());
    });

    if (!showStrings) {
      return () => cancelAnimationFrame(frameId);
    }

    let isActive = true;
    const loop = () => {
      if (!isActive) return;
      drawStrings();
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);

    const board = pinboardRef.current;
    const resizeObserver = new ResizeObserver(() => drawStrings());
    if (board) {
      resizeObserver.observe(board);
      board.querySelectorAll('.exhibit').forEach((card) => resizeObserver.observe(card));
    }

    const handleWindowResize = () => drawStrings();
    window.addEventListener('resize', handleWindowResize);

    return () => {
      isActive = false;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [drawStrings, showStrings, paginatedCards, safePage, gridLayout]);

  const handleSaveCompose = async () => {
    if (!composeForm.title.trim()) return;
    const payload = {
      title: composeForm.title,
      body: composeForm.body,
      tag: normalizeTag(composeForm.tag) || composeForm.tag.trim() || null,
      sourceUrl: composeForm.sourceUrl,
    };

    try {
      if (editingCard) {
        await updateCard(editingCard.cardId, {
          ...payload,
          isFiled: editingCard.isFiled,
        });
      } else {
        await createCard(payload);
      }
      closeComposeForm();
    } catch (error) {
      console.error('Failed to save idea', error);
    }
  };

  const handleToggleFiled = async (card) => {
    try {
      await updateCard(card.cardId, {
        title: card.title,
        body: card.body,
        tag: card.tag,
        sourceUrl: card.sourceUrl,
        isFiled: !card.isFiled,
      });
    } catch (error) {
      console.error('Failed to update idea', error);
    }
  };

  const handleDelete = async (card) => {
    if (!window.confirm('Удалить идею с доски?')) return;
    try {
      await deleteCard(card.cardId);
      if (selectedCard?.cardId === card.cardId) setSelectedCard(null);
    } catch (error) {
      console.error('Failed to delete idea', error);
    }
  };

  return (
    <div className="ideas-board-view">
      <div className="board">
        <div className="board-grain" aria-hidden="true" />
        <div className="board-flicker" aria-hidden="true" />

        <header className="case-header">
          <div className="stamp">ДОСКА</div>
          <h1 className="case-title">
            {titleLetters.map((char, index) => (
              <span key={`${char}-${index}`} className={`r r${index + 1}`}>
                {char}
              </span>
            ))}
          </h1>
          <div className="controls">
            <button
              type="button"
              className={`ctrl ${sort === 'newest' ? 'is-active' : ''}`}
              onClick={() => setSort('newest')}
            >
              СНАЧАЛА НОВЫЕ
            </button>
            <button
              type="button"
              className={`ctrl ${sort === 'oldest' ? 'is-active' : ''}`}
              onClick={() => setSort('oldest')}
            >
              СТАРЫЕ
            </button>
            <button
              type="button"
              className={`ctrl ${sort === 'tag' ? 'is-active' : ''}`}
              onClick={() => setSort('tag')}
            >
              ПО ТЕГУ
            </button>
            <button
              type="button"
              className={`ctrl ${unfiledOnly ? 'is-active' : ''}`}
              onClick={() => setUnfiledOnly((value) => !value)}
            >
              ТОЛЬКО АКТИВНЫЕ
            </button>
            <button
              type="button"
              className={`ctrl ${showStrings ? 'is-active' : ''}`}
              onClick={() => setShowStrings((value) => !value)}
            >
              ◆ СВЯЗИ
            </button>
            {canCreate && (
              <button
                type="button"
                className="ctrl ctrl--add"
                onClick={openCreateForm}
              >
                + ИДЕЯ
              </button>
            )}
          </div>
          <p className="hint">
            нажмите на заголовок для заметок · укажите одинаковый тег у идей и нажмите «связи»
          </p>
        </header>

        <div className="ideas-board-stage">
        <main
          className="pinboard"
          id="pinboard"
          ref={pinboardRef}
          aria-live="polite"
          style={{
            '--grid-cols': gridLayout.cols,
            '--card-max-height': `${gridLayout.cardMaxHeight}px`,
          }}
        >
          <svg className={`strings ${showStrings ? 'show' : ''}`} ref={stringsRef} aria-hidden="true" />
          {isLoading && visibleCards.length === 0 && (
            <div className="ideas-board-loading">Загрузка идей…</div>
          )}
          {!isLoading && visibleCards.length === 0 && (
            <div className="ideas-board-empty">
              Пока нет идей. {canCreate ? 'Нажмите «+ ИДЕЯ», чтобы добавить первую.' : ''}
            </div>
          )}
          {paginatedCards.map((card, index) => {
            const rotation = card.rotation ?? (((index * 37) % 9) - 4);
            return (
              <article
                key={card.cardId}
                data-card-id={card.cardId}
                className={`exhibit ${card.isFiled ? 'is-filed' : ''}`}
                style={{ '--rot': `${rotation}deg` }}
              >
                <span className="exhibit-pin" aria-hidden="true" />
                <div className="exhibit-surface">
                  <div className="ex-meta">
                    <span className="ex-meta-author" title={card.authorUsername}>
                      {truncateText(card.authorUsername, 18)}
                    </span>
                    {card.tag && (
                      <span className="ex-meta-tag" title={`#${card.tag}`}>
                        #{truncateText(card.tag, 14)}
                      </span>
                    )}
                    <span className="pub-date">{formatDate(card.createdAt)}</span>
                  </div>
                  <h2
                    className="ex-title"
                    title={card.title}
                    onClick={() => setSelectedCard(card)}
                  >
                    {cutTitle(card.title)}
                  </h2>
                  {card.body ? (
                    <p className="ex-body" title={card.body}>
                      {card.body}
                    </p>
                  ) : null}
                  {canManageCard(card) && (
                    <div className="ex-actions">
                      <button type="button" onClick={() => openEditForm(card)}>
                        РЕДАКТИРОВАТЬ
                      </button>
                      <button type="button" onClick={() => handleToggleFiled(card)}>
                        {card.isFiled ? 'ВЕРНУТЬ' : 'В АРХИВ'}
                      </button>
                      <button type="button" onClick={() => handleDelete(card)}>
                        УДАЛИТЬ
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </main>

        {totalPages > 1 && (
          <nav className="ideas-board-pagination" aria-label="Страницы доски идей">
            <button
              type="button"
              className="ctrl"
              disabled={safePage <= 1}
              onClick={() => goToPage(safePage - 1)}
            >
              ← НАЗАД
            </button>
            <span className="ideas-board-pagination-label">
              СТРАНИЦА {safePage} / {totalPages}
            </span>
            <button
              type="button"
              className="ctrl"
              disabled={safePage >= totalPages}
              onClick={() => goToPage(safePage + 1)}
            >
              ДАЛЕЕ →
            </button>
          </nav>
        )}

        <footer className="case-footer">
          {visibleCards.length} ИДЕЙ НА ДОСКЕ
          {totalPages > 1 && ` · СТР. ${safePage}/${totalPages}`}
        </footer>
        </div>
      </div>

      <div
        className={`ideas-board-notes ${selectedCard ? 'open' : ''}`}
        onClick={() => setSelectedCard(null)}
        aria-hidden={!selectedCard}
      >
        <div className="ideas-board-notes-scroll">
          <div
            className="ideas-board-notes-card ideas-board-notes-card--view"
            role="dialog"
            aria-modal="true"
            aria-label="Заметки по идее"
            onClick={(event) => event.stopPropagation()}
          >
          {selectedCard && (
            <>
              <button
                type="button"
                className="ideas-board-notes-close"
                onClick={() => setSelectedCard(null)}
                aria-label="Закрыть"
              >
                ×
              </button>
              <div className="ideas-board-note-stamp">ДЕЛО № {String(selectedCard.cardId).slice(0, 8)}</div>
              <h3 className="ideas-board-note-title">{selectedCard.title}</h3>
              <div className="ideas-board-note-line">
                <b>Автор:</b> {selectedCard.authorUsername}
              </div>
              <div className="ideas-board-note-line">
                <b>Дата:</b> {formatDate(selectedCard.createdAt)}
              </div>
              {selectedCard.tag && (
                <div className="ideas-board-note-line">
                  <b>Тег:</b> #{selectedCard.tag}
                </div>
              )}
              <p className="ideas-board-note-text">{selectedCard.body || 'Без описания'}</p>
              {selectedCard.sourceUrl && (
                <a
                  href={selectedCard.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ctrl"
                >
                  ОТКРЫТЬ ИСТОЧНИК
                </a>
              )}
              {canManageCard(selectedCard) && (
                <div className="ideas-board-compose-actions">
                  <button type="button" className="ctrl is-active" onClick={() => openEditForm(selectedCard)}>
                    РЕДАКТИРОВАТЬ
                  </button>
                  <button type="button" className="ctrl" onClick={() => handleDelete(selectedCard)}>
                    УДАЛИТЬ
                  </button>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      </div>

      <div
        className={`ideas-board-notes ${showCompose ? 'open' : ''}`}
        onClick={closeComposeForm}
        aria-hidden={!showCompose}
      >
        <div className="ideas-board-notes-scroll">
          <div
            className="ideas-board-notes-card"
            role="dialog"
            aria-modal="true"
            aria-label={editingCard ? 'Редактирование идеи' : 'Новая идея'}
            onClick={(event) => event.stopPropagation()}
          >
          <button
            type="button"
            className="ideas-board-notes-close"
            onClick={closeComposeForm}
            aria-label="Закрыть"
          >
            ×
          </button>
          <div className="ideas-board-note-stamp">{editingCard ? 'РЕДАКТИРОВАНИЕ' : 'НОВАЯ ИДЕЯ'}</div>
          <div className="ideas-board-compose">
            <input
              type="text"
              placeholder="Заголовок"
              value={composeForm.title}
              onChange={(event) => setComposeForm((prev) => ({ ...prev, title: event.target.value }))}
            />
            <textarea
              placeholder="Описание идеи"
              value={composeForm.body}
              onChange={(event) => setComposeForm((prev) => ({ ...prev, body: event.target.value }))}
            />
            <input
              type="text"
              placeholder="Тег (необязательно)"
              value={composeForm.tag}
              onChange={(event) => setComposeForm((prev) => ({ ...prev, tag: event.target.value }))}
            />
            <input
              type="url"
              placeholder="Ссылка (необязательно)"
              value={composeForm.sourceUrl}
              onChange={(event) => setComposeForm((prev) => ({ ...prev, sourceUrl: event.target.value }))}
            />
            <div className="ideas-board-compose-actions">
              <button type="button" className="ctrl is-active" onClick={handleSaveCompose}>
                {editingCard ? 'СОХРАНИТЬ' : 'ЗАКРЕПИТЬ НА ДОСКЕ'}
              </button>
              <button type="button" className="ctrl" onClick={closeComposeForm}>
                ОТМЕНА
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdeasBoardView;
