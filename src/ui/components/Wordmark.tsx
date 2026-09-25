/** "Pseudo" upright, "Chess" turned upside down: the rules, inverted. */
export function Wordmark() {
  return (
    <h1 className="text-[1.65rem] leading-none font-extrabold tracking-tight [font-stretch:78%] sm:text-3xl">
      <span className="sr-only">PseudoChess</span>
      <span aria-hidden="true" className="inline-flex items-baseline">
        Pseudo
        <span className="inline-block translate-y-[0.2em] rotate-180">Chess</span>
      </span>
    </h1>
  );
}
