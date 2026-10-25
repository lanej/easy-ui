import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { CardListItem } from "@easypost/easy-ui/CardListItem";
import { ThemeProvider } from "@easypost/easy-ui/Theme";
import "@easypost/easy-ui/style.css";

const scheme = new URLSearchParams(location.search).get("theme") || "light";
document.documentElement.dataset.scheme = scheme;
const css = `
*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:#f3f6fb;color:#152c52}body:has([data-proof-theme="dark"]){background:#101b2e;color:#eaf0fc}main{max-width:1040px;margin:0 auto;padding:54px 48px 40px}.eyebrow{font-size:12px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;color:#4474c9}h1{margin:12px 0;font-size:32px;letter-spacing:-.8px}header p{font-size:15px;line-height:1.6;color:#52617a;max-width:760px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:32px}section{border:1px solid #d8e1ef;background:#fff;border-radius:12px;padding:24px}h2{font-size:17px;margin:0 0 10px}.explanation{font-size:13px;color:#61708a;min-height:34px;line-height:1.5}ul{list-style:none;margin:20px 0;padding:0}li button,li>div{width:100%;text-align:left}strong{display:block;font-size:16px}.detail{display:block;margin-top:6px;font-size:13px;font-weight:400}.evidence{border-top:1px solid #e1e7f1;padding-top:20px;margin-top:22px}.evidence label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#61708a}pre{white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.7;background:#f2f5fa;border-radius:6px;padding:14px;margin:10px 0 0;color:#23436c}.status{font-size:12px;color:#177752;margin-top:12px}footer{font-size:12px;line-height:1.6;margin-top:25px;color:#61708a} [data-proof-theme="dark"] section{background:#182740;border-color:#31445f}[data-proof-theme="dark"] header p,[data-proof-theme="dark"] .explanation,[data-proof-theme="dark"] footer,[data-proof-theme="dark"] label{color:#afbed5}[data-proof-theme="dark"] pre{background:#101c31;color:#c5dcff}[data-proof-theme="dark"] .evidence{border-color:#31445f}[data-proof-theme="dark"] .status{color:#7cdab0}@media(max-width:680px){main{padding:30px 20px}.grid{grid-template-columns:1fr}h1{font-size:26px}}
`;
function App() {
  const [clicks, setClicks] = useState(0);
  const [markup, setMarkup] = useState({});
  useEffect(() => {
    setMarkup(
      Object.fromEntries(
        ["selectable-card", "read-only-card"].map((id) => {
          const el = document.querySelector(`[data-testid="${id}"]`);
          return [
            id,
            el
              ? `<${el.tagName.toLowerCase()}\n  data-testid="${el.getAttribute("data-testid")}"\n>`
              : "Missing data-testid",
          ];
        }),
      ),
    );
  }, []);
  return (
    <ThemeProvider colorScheme={scheme}>
      <style>{css}</style>
      <main data-proof-theme={scheme}>
        <header>
          <div className="eyebrow">Easy UI · Packed package verification</div>
          <h1>CardListItem test identifiers</h1>
          <p>
            Both card variants retain their public test identifier when rendered
            from an installed npm tarball.
          </p>
        </header>
        <div className="grid">
          <section>
            <h2>Interactive card</h2>
            <div className="explanation">
              The identifier belongs to the button surface.
            </div>
            <ul>
              <CardListItem
                testId="selectable-card"
                onSelect={() => setClicks((n) => n + 1)}
              >
                <strong>Selectable item</strong>
                <span className="detail">
                  Choose this card to inspect details
                </span>
              </CardListItem>
            </ul>
            <div className="status" role="status">
              Selection callback fired: {clicks}
            </div>
            <div className="evidence">
              <label>Observed rendered DOM</label>
              <pre>{markup["selectable-card"]}</pre>
            </div>
          </section>
          <section>
            <h2>Non-interactive card</h2>
            <div className="explanation">
              The identifier belongs to the plain div surface.
            </div>
            <ul>
              <CardListItem testId="read-only-card">
                <strong>Read-only item</strong>
                <span className="detail">
                  Informational content without an action
                </span>
              </CardListItem>
            </ul>
            <div className="status">No button role or keyboard stop</div>
            <div className="evidence">
              <label>Observed rendered DOM</label>
              <pre>{markup["read-only-card"]}</pre>
            </div>
          </section>
        </div>
        <footer>
          ESM public export · @easypost/easy-ui@1.0.0-alpha.137 built with the
          PR fix
          <br />
          DOM snippets are read from the mounted elements. Automated tarball
          tests verify both CommonJS and ESM.
        </footer>
      </main>
    </ThemeProvider>
  );
}
createRoot(document.getElementById("root")).render(<App />);
