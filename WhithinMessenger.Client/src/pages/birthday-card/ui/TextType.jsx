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
  const [displayedText, setDisplayedText] = useState("");
  const [charIndex, setCharIndex] = useState(0);
  const [textIndex, setTextIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const finish = useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    const current = textArray[textIndex] ?? "";
    let timeout;

    if (!isDeleting && charIndex === 0 && displayedText === "") {
      timeout = window.setTimeout(() => {
        if (current.length === 0) {
          finish();
          return;
        }
        setDisplayedText(current[0]);
        setCharIndex(1);
      }, initialDelay);
    } else if (isDeleting) {
      if (displayedText === "") {
        if (textIndex === textArray.length - 1 && !loop) {
          finish();
          return undefined;
        }
        timeout = window.setTimeout(() => {
          setIsDeleting(false);
          setTextIndex((prev) => (prev + 1) % textArray.length);
          setCharIndex(0);
        }, pauseDuration);
      } else {
        timeout = window.setTimeout(() => {
          setDisplayedText((prev) => prev.slice(0, -1));
        }, deletingSpeed);
      }
    } else if (charIndex < current.length) {
      timeout = window.setTimeout(() => {
        setDisplayedText((prev) => prev + current[charIndex]);
        setCharIndex((prev) => prev + 1);
      }, typingSpeed);
    } else if (loop || textIndex < textArray.length - 1) {
      timeout = window.setTimeout(() => setIsDeleting(true), pauseDuration);
    } else {
      timeout = window.setTimeout(finish, pauseDuration);
    }

    return () => window.clearTimeout(timeout);
  }, [
    charIndex,
    deletingSpeed,
    displayedText,
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
