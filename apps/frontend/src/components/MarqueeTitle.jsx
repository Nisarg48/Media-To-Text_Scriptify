import { useRef, useState, useCallback } from 'react';

/**
 * Renders text truncated with an ellipsis at rest.
 * On mouse enter, if the text overflows its container it scrolls once
 * (right to left) and then stops. Moving the cursor away resets it
 * instantly so the next hover replays the animation from the start.
 */
export default function MarqueeTitle({ text, className = '', title }) {
    const containerRef = useRef(null);
    const textRef = useRef(null);
    const [offset, setOffset] = useState(0);
    const [active, setActive] = useState(false);

    const handleEnter = useCallback(() => {
        const container = containerRef.current;
        const span = textRef.current;
        if (!container || !span) return;
        const overflow = span.scrollWidth - container.clientWidth;
        if (overflow > 0) {
            setOffset(overflow);
            setActive(true);
        }
    }, []);

    const handleLeave = useCallback(() => {
        // Reset without transition so next hover starts fresh from position 0
        setActive(false);
        setOffset(0);
    }, []);

    const activeStyle = {
        display: 'inline-block',
        whiteSpace: 'nowrap',
        transform: `translateX(-${offset}px)`,
        transition: `transform ${Math.max(2, offset / 120)}s linear`,
    };

    const restStyle = {
        display: 'block',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        transition: 'none',
    };

    return (
        <div
            ref={containerRef}
            className={`overflow-hidden cursor-default ${className}`}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
            title={title ?? text}
        >
            <span ref={textRef} style={active ? activeStyle : restStyle}>
                {text}
            </span>
        </div>
    );
}
