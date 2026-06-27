export const insertTextAtCursor = (element, text) => {
  if (!element || typeof text !== 'string' || !text) {
    return null;
  }

  const { value, selectionStart, selectionEnd } = element;
  const start = selectionStart ?? value.length;
  const end = selectionEnd ?? value.length;
  const nextValue = `${value.slice(0, start)}${text}${value.slice(end)}`;
  const caret = start + text.length;

  element.value = nextValue;
  element.setSelectionRange(caret, caret);
  element.dispatchEvent(new Event('input', { bubbles: true }));

  return nextValue;
};
