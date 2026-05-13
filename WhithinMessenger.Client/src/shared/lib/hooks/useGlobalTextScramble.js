import { useEffect } from 'react';

const DEFAULT_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789░▒▓█';
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'OPTION']);

const getRandomChar = (charset) => {
  const index = Math.floor(Math.random() * charset.length);
  return charset[index];
};

const shouldSkipNode = (textNode) => {
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return true;

  const text = textNode.nodeValue || '';
  if (!text.trim()) return true;
  if (text.trim().length < 2) return true;

  const parent = textNode.parentElement;
  if (!parent) return true;
  if (SKIP_TAGS.has(parent.tagName)) return true;
  if (parent.closest('[contenteditable="true"]')) return true;
  if (parent.closest('[data-no-scramble="true"]')) return true;

  return false;
};

const animateTextNode = (node, charset, duration, fps, activeAnimations) => {
  if (activeAnimations.has(node)) return;

  const originalText = node.nodeValue || '';
  const chars = originalText.split('');
  const totalChars = chars.length;
  const frameInterval = 1000 / Math.max(1, fps);
  const startedAt = Date.now();

  const interval = window.setInterval(() => {
    if (!node.isConnected) {
      window.clearInterval(interval);
      activeAnimations.delete(node);
      return;
    }

    const elapsed = Date.now() - startedAt;
    const progress = Math.min(1, elapsed / Math.max(1, duration));
    const revealed = Math.floor(progress * totalChars);

    const scrambledText = chars.map((char, index) => {
      if (char.trim() === '') return char;
      if (index < revealed) return char;
      return getRandomChar(charset);
    }).join('');

    node.nodeValue = scrambledText;

    if (progress >= 1) {
      node.nodeValue = originalText;
      window.clearInterval(interval);
      activeAnimations.delete(node);
    }
  }, frameInterval);

  activeAnimations.set(node, interval);
};

export const useGlobalTextScramble = ({
  duration = 700,
  fps = 30,
  charset = DEFAULT_CHARSET
} = {}) => {
  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return () => {};

    const animatedNodes = new WeakSet();
    const activeAnimations = new Map();

    const processTextNode = (textNode) => {
      if (shouldSkipNode(textNode)) return;
      if (animatedNodes.has(textNode)) return;
      animatedNodes.add(textNode);
      animateTextNode(textNode, charset, duration, fps, activeAnimations);
    };

    const scanNode = (node) => {
      if (!node) return;

      if (node.nodeType === Node.TEXT_NODE) {
        processTextNode(node);
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let current = walker.nextNode();
      while (current) {
        processTextNode(current);
        current = walker.nextNode();
      }
    };

    scanNode(root);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          scanNode(node);
        });

        if (mutation.type === 'characterData') {
          processTextNode(mutation.target);
        }
      });
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true
    });

    return () => {
      observer.disconnect();
      activeAnimations.forEach((intervalId) => window.clearInterval(intervalId));
      activeAnimations.clear();
    };
  }, [charset, duration, fps]);
};

