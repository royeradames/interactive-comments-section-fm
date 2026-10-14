import { CommentsSection } from "./comments-section";
import { challengeUrl } from "./site";

export default function Home() {
  return (
    <div className="page-shell">
      <CommentsSection />
      <footer className="site-footer">
        <p>
          Practice demo. Fictional comments stay in this browser. Nothing is sent.{" "}
          <button type="submit" form="reset-demo">Reset the demo</button>
        </p>
        <p>Challenge by <a href={challengeUrl}>Frontend Mentor</a>. Built by <a href="https://royeradames.com">Royer Adames</a>.</p>
      </footer>
    </div>
  );
}
