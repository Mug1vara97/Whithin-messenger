import { useCallback, useEffect, useMemo, useState } from "react";
import "./TextType.css";

export default function TextType({
  text,
  typingSpeed = 50,
  initialDelay = 0,
  pauseDuration = 2000,
  deletingSpeed = 30,
  loop = true,
  className = "",
  showCursor = true,
  cursorCharacter = "|",
  onComplete,
}) {
  const textArray = useMemo(() => (Array.isArray(text) ? text : [text]), [text]);
  const [charIndex, setCharIndex] = useState(0);
  const [textIndex, setTextIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const finish = useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  const current = textArray[textIndex] ?? "";
  const displayedText = current.slice(0, charIndex);

  useEffect(() => {
    const active = textArray[textIndex] ?? "";
    let timeout;

    if (isDeleting) {
      if (charIndex === 0) {
        if (textIndex === textArray.length - 1 && !loop) {
          finish();
          return undefined;
        }
        timeout = window.setTimeout(() => {
          setIsDeleting(false);
          setTextIndex((prev) => (prev + 1) % textArray.length);
        }, pauseDuration);
      } else {
        timeout = window.setTimeout(() => {
          setCharIndex((prev) => Math.max(0, prev - 1));
        }, deletingSpeed);
      }
    } else if (charIndex < active.length) {
      timeout = window.setTimeout(() => {
        setCharIndex((prev) => prev + 1);
      }, charIndex === 0 ? initialDelay : typingSpeed);
    } else if (loop || textIndex < textArray.length - 1) {
      timeout = window.setTimeout(() => setIsDeleting(true), pauseDuration);
    } else {
      timeout = window.setTimeout(finish, pauseDuration);
    }

    return () => window.clearTimeout(timeout);
  }, [
    charIndex,
    deletingSpeed,
    finish,
    initialDelay,
    isDeleting,
    loop,
    pauseDuration,
    textArray,
    textIndex,
    typingSpeed,
  ]);

  return (
    <div className={`text-type ${className}`.trim()}>
      <span className="text-type__content">{displayedText}</span>
      {showCursor && <span className="text-type__cursor">{cursorCharacter}</span>}
    </div>
  );
}
