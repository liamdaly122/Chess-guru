/** Source code and licences. Maia-3's AGPL licence asks that users of the app can get its source. */
export function AboutSection() {
  return (
    <section className="about" aria-label="About">
      <h3>About Chess Guru</h3>
      <p className="muted small">
        A personal chess coaching app by Liam Daly.{' '}
        <a href="https://github.com/liamdaly122/Chess-guru" target="_blank" rel="noreferrer">
          Source code
        </a>
        .
      </p>
      <ul className="muted small licences">
        <li>
          <a href="https://github.com/official-stockfish/Stockfish" target="_blank" rel="noreferrer">
            Stockfish
          </a>{' '}
          (GPL-3.0), via stockfish.js
        </li>
        <li>
          <a href="https://github.com/CSSLab/maia3" target="_blank" rel="noreferrer">
            Maia-3
          </a>{' '}
          by the University of Toronto CSSLab (AGPL-3.0), run with maia3-js (MIT) and ONNX Runtime (MIT)
        </li>
        <li>Opening names and puzzles from Lichess (public domain)</li>
        <li>chess.js (BSD-2-Clause), react-chessboard (MIT)</li>
      </ul>
    </section>
  )
}
