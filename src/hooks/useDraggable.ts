import { useState, useRef, useEffect, useCallback } from 'react';

export function useDraggable(initialPosition = { x: 0, y: 0 }) {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const boundsRef = useRef({ left: 0, top: 0, width: 0, height: 0 });
  const initialPositionRef = useRef(initialPosition);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0
  });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Only drag on left click, ignore inputs, buttons, sliders
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (
      ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select')
    ) {
      return;
    }
    e.preventDefault();
    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (rect) boundsRef.current = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y
    };
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      const bounds = boundsRef.current;
      const minX = 8 - bounds.left;
      const minY = 8 - bounds.top;
      const maxX = Math.max(minX, window.innerWidth - bounds.width - bounds.left - 8);
      const maxY = Math.max(minY, window.innerHeight - bounds.height - bounds.top - 8);
      setPosition({
        x: dragStartRef.current.posX + Math.max(minX, Math.min(maxX, dx)),
        y: dragStartRef.current.posY + Math.max(minY, Math.min(maxY, dy))
      });
    };

    const onMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', onMouseUp);
    };
  }, [isDragging]);

  const resetPosition = useCallback(() => setPosition(initialPositionRef.current), []);

  useEffect(() => {
    window.addEventListener('resize', resetPosition);
    return () => window.removeEventListener('resize', resetPosition);
  }, [resetPosition]);

  return { position, onMouseDown, isDragging, resetPosition };
}
