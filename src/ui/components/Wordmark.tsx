interface WordmarkProps {
  size?: 'sm' | 'lg';
  /** Start with "Chess" upright and flip it over, for the landing sequence. */
  animate?: boolean;
}

/** "Pseudo" upright, "Chess" turned upside down: the rules, inverted. */
export function Wordmark({ size = 'sm', animate = false }: WordmarkProps) {
  const scale = size === 'lg' ? 'text-[3.6rem] sm:text-7xl xl:text-[5.5rem]' : 'text-[1.65rem] sm:text-3xl';
  return (
    <span className={`block leading-none font-extrabold tracking-tight [font-stretch:78%] ${scale}`}>
      <span className="sr-only">PseudoChess</span>
      <span aria-hidden="true" className="inline-flex items-baseline">
        Pseudo
        <span className={`inline-block ${animate ? 'animate-flip' : 'translate-y-[0.2em] rotate-180'}`}>Chess</span>
      </span>
    </span>
  );
}
